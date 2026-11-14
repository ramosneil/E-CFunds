-- "Where the money goes" (Neil, 2026-11-14): every org/club shows its spending to everyone signed in, so no student
-- has to ask where the fees went. Treasurers pick a category for each expense (SAS may change it on approval).
-- Students see charts + approved expenses (date, purpose, category, amount) — never names, receipts, remits/releases,
-- and not the "receipt checked" mark (Neil: SAS and the org's own treasurer only).

create type public.expense_category as enum ('events', 'supplies', 'food', 'transport', 'printing', 'outreach', 'other');

alter table public.fund_requests  add column category public.expense_category;
alter table public.ledger_entries add column category public.expense_category;   -- old rows stay null = "Other"

-- ---------- filing: category for expenses ----------
drop function public.file_request(bigint, public.request_kind, numeric, text, text);
drop function private.file_request(bigint, public.request_kind, numeric, text, text);
create function private.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; v_id bigint; v_year bigint := private.current_school_year_id();
begin
  if (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer can file its requests.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than ₱0.'; end if;
  if p_kind = 'expense' and p_attachment_path is null then raise exception 'Attach the receipt for an expense.'; end if;
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = v_year) then
    raise exception 'This school year is already closed for your org/club.';
  end if;
  perform private.lock_entity(p_entity_id);
  select cash, saved into c, s from private.pockets(p_entity_id);

  if p_kind in ('remittance', 'expense')
     and p_amount > c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense') then
    raise exception 'Amount is more than the cash available (₱%).',
      c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense');
  end if;
  if p_kind = 'release' and p_amount > s - private.pending(p_entity_id, 'release') then
    raise exception 'Amount is more than the saved funds available (₱%).', s - private.pending(p_entity_id, 'release');
  end if;

  insert into public.fund_requests (entity_id, school_year_id, kind, amount, description, attachment_path, filed_by, category)
  values (p_entity_id, v_year, p_kind, round(p_amount, 2), trim(p_description), p_attachment_path, (select auth.uid()),
          case when p_kind = 'expense' then coalesce(p_category, 'other') end)   -- old app builds send no category
  returning id into v_id;
  return v_id;
end $$;
create function public.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null)
returns bigint language sql security invoker set search_path = '' as $$
  select private.file_request(p_entity_id, p_kind, p_amount, p_description, p_attachment_path, p_category) $$;

-- ---------- approving: SAS may change the category; it goes into the ledger ----------
drop function public.review_request(bigint, boolean, text);
drop function private.review_request(bigint, boolean, text);
create function private.review_request(p_request_id bigint, p_approve boolean, p_remarks text default null,
  p_category public.expense_category default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r record; c numeric; s numeric; v_entry bigint; v_cat public.expense_category;
begin
  perform private.require_admin();
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already %.', r.status; end if;
  perform private.lock_entity(r.entity_id);

  if not p_approve then
    if coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say why the request is rejected.'; end if;
    update public.fund_requests
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = trim(p_remarks)
     where id = r.id;
    return null;
  end if;

  select cash, saved into c, s from private.pockets(r.entity_id);
  if r.kind in ('remittance', 'expense') and r.amount > c then
    raise exception 'Not enough cash on hand (₱%).', c;
  end if;
  if r.kind = 'release' and r.amount > s then
    raise exception 'Not enough saved with SAS (₱%).', s;
  end if;

  v_cat := case when r.kind = 'expense' then coalesce(p_category, r.category, 'other') end;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path, category)
  values (r.entity_id, r.school_year_id, r.kind::text::public.ledger_kind, r.amount, r.description, r.id, r.attachment_path, v_cat)
  returning id into v_entry;

  update public.fund_requests
     set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = nullif(trim(p_remarks), ''),
         category = v_cat
   where id = r.id;
  return v_entry;
end $$;
create function public.review_request(p_request_id bigint, p_approve boolean, p_remarks text default null,
  p_category public.expense_category default null)
returns bigint language sql security invoker set search_path = '' as $$
  select private.review_request(p_request_id, p_approve, p_remarks, p_category) $$;

revoke all on function private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category),
  private.review_request(bigint, boolean, text, public.expense_category),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category),
  public.review_request(bigint, boolean, text, public.expense_category) from public, anon;
grant execute on function private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category),
  private.review_request(bigint, boolean, text, public.expense_category),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category),
  public.review_request(bigint, boolean, text, public.expense_category) to authenticated;

-- ---------- transparency: what came in, what went out, and on what ----------
-- Money in = opening + collections; money out = expenses. A reversal counts against what it reverses (an undone
-- payment lowers "in"; an undone expense lowers "out" and leaves the expense list). Remits/releases only move money
-- between pockets, so they are not shown. Every approved user may read every org (transparency); the receipt mark
-- is only for SAS and that org's treasurer.
create function private.entity_flows(p_school_year_id bigint, p_entity_id bigint default null)
returns table (entity_id bigint, occurred_on date, flow text, amount numeric, category public.expense_category,
               expense_id bigint, description text, has_receipt boolean)
language sql stable security definer set search_path = '' as $$
  select l.entity_id, l.occurred_on,
         case when coalesce(o.kind, l.kind) in ('opening', 'collection') then 'in' else 'out' end,
         case when l.kind = 'reversal' then -l.amount else l.amount end,
         case when coalesce(o.kind, l.kind) = 'expense' then coalesce(o.category, l.category, 'other') end,
         case when l.kind = 'expense' then l.id end,
         case when l.kind = 'expense' then l.description end,
         l.attachment_path is not null
    from public.ledger_entries l
    left join public.ledger_entries o on o.id = l.reverses_id
   where l.school_year_id = p_school_year_id
     and (p_entity_id is null or l.entity_id = p_entity_id)
     and (l.kind in ('opening', 'collection', 'expense') or (l.kind = 'reversal' and o.kind in ('opening', 'collection', 'expense')))
$$;
revoke all on function private.entity_flows(bigint, bigint) from public, anon, authenticated;

create function private.finance_json(p_school_year_id bigint, p_entity_id bigint, p_with_list boolean, p_staff boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  with f as (select * from private.entity_flows(p_school_year_id, p_entity_id)),
  y as (select starts_on, ends_on from public.school_years where id = p_school_year_id),
  months as (
    select to_char(m, 'YYYY-MM') as month
      from y, generate_series(date_trunc('month', y.starts_on), date_trunc('month', least(y.ends_on, (now() at time zone 'Asia/Manila')::date)), interval '1 month') m),
  monthly as (
    select ms.month,
           coalesce(sum(f.amount) filter (where f.flow = 'in'), 0) as money_in,
           coalesce(sum(f.amount) filter (where f.flow = 'out'), 0) as money_out
      from months ms left join f on to_char(f.occurred_on, 'YYYY-MM') = ms.month
     group by ms.month),
  cats as (select category, sum(amount) as amount from f where flow = 'out' group by category having sum(amount) > 0),
  reversed as (select reverses_id from public.ledger_entries where kind = 'reversal' and reverses_id is not null),
  list as (
    select occurred_on, description, category, amount, has_receipt, expense_id from f
     where expense_id is not null and expense_id not in (select reverses_id from reversed))
  select jsonb_build_object(
    'money_in',  (select coalesce(sum(amount) filter (where flow = 'in'), 0) from f),
    'money_out', (select coalesce(sum(amount) filter (where flow = 'out'), 0) from f),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'money_in', money_in, 'money_out', money_out) order by month) from monthly), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'amount', amount) order by amount desc) from cats), '[]'::jsonb),
    'expenses', case when p_with_list then coalesce((select jsonb_agg(
        jsonb_build_object('date', occurred_on, 'description', description, 'category', category, 'amount', amount)
        || case when p_staff then jsonb_build_object('receipt_checked', has_receipt) else '{}'::jsonb end
        order by occurred_on desc, expense_id desc) from list), '[]'::jsonb) end)
$$;
revoke all on function private.finance_json(bigint, bigint, boolean, boolean) from public, anon, authenticated;

create function private.get_entity_finance(p_entity_id bigint, p_school_year_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_approved()) then raise exception 'Your account is not approved yet.' using errcode = '42501'; end if;
  return private.finance_json(p_school_year_id, p_entity_id, true,
    (select private.is_admin()) or (select private.my_entity_id()) = p_entity_id);
end $$;
create function private.get_school_finance(p_school_year_id bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_approved()) then raise exception 'Your account is not approved yet.' using errcode = '42501'; end if;
  return private.finance_json(p_school_year_id, null, false, false);
end $$;
create function public.get_entity_finance(p_entity_id bigint, p_school_year_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.get_entity_finance(p_entity_id, p_school_year_id) $$;
create function public.get_school_finance(p_school_year_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.get_school_finance(p_school_year_id) $$;

revoke all on function private.get_entity_finance(bigint, bigint), private.get_school_finance(bigint),
  public.get_entity_finance(bigint, bigint), public.get_school_finance(bigint) from public, anon;
grant execute on function private.get_entity_finance(bigint, bigint), private.get_school_finance(bigint),
  public.get_entity_finance(bigint, bigint), public.get_school_finance(bigint) to authenticated;
