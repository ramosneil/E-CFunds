-- Budgets + liquidation (Neil, 2026-11-15). The usual school process: an activity budget is approved first, money is
-- released against it, and after the activity the treasurer liquidates (shows what was spent, with receipts).
--  • Every release REQUEST names an approved budget and stays within what is left of it.
--  • Liquidation is due 15 days after the activity date. Reminders on day 7 and on the due date; after that the
--    budget is OVERDUE and the org/club gets no new releases until it is liquidated.
--  • Expenses can be tagged to a budget (budget vs actual). Unspent released cash just stays as cash on hand.
--  • SAS direct releases may name a budget; they are blocked while the org has an overdue budget.
--  • Turnover (close school year) is refused while a budget is still open.
-- Budgets are filed whole (title, date, items); to change one, cancel it and file again.

create table public.budgets (
  id bigint generated always as identity primary key,
  entity_id bigint not null references public.entities(id) on delete restrict,
  school_year_id bigint not null references public.school_years(id) on delete restrict,
  title text not null check (length(title) between 3 and 120),
  purpose text,
  activity_date date not null,
  liquidation_due date not null,
  total numeric(12,2) not null check (total > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'liquidation_submitted', 'liquidated')),
  filed_by uuid references public.profiles(id), filed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, remarks text,
  liquidation_note text, liquidation_submitted_at timestamptz,
  liquidated_by uuid references public.profiles(id), liquidated_at timestamptz,
  reminded_7 boolean not null default false, reminded_due boolean not null default false, overdue_notified boolean not null default false
);
create index budgets_entity on public.budgets (entity_id, status);

create table public.budget_items (
  id bigint generated always as identity primary key,
  budget_id bigint not null references public.budgets(id) on delete cascade,
  item text not null check (length(item) between 1 and 120),
  qty numeric(10,2) not null check (qty > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0)
);
create index budget_items_budget on public.budget_items (budget_id);

alter table public.fund_requests add column budget_id bigint references public.budgets(id) on delete restrict;
alter table public.ledger_entries add column budget_id bigint references public.budgets(id) on delete restrict;
create index fund_requests_budget on public.fund_requests (budget_id) where budget_id is not null;
create index ledger_entries_budget on public.ledger_entries (budget_id) where budget_id is not null;

alter table public.budgets enable row level security;
alter table public.budget_items enable row level security;
create policy "SAS reads all, treasurer reads own org's budgets" on public.budgets for select to authenticated
  using ((select private.is_admin()) or entity_id = (select private.my_entity_id()));
create policy "items follow their budget" on public.budget_items for select to authenticated
  using (exists (select 1 from public.budgets b where b.id = budget_id));
grant select on public.budgets, public.budget_items to authenticated;

create trigger audit_budgets after insert or update or delete on public.budgets for each row execute function private.audit_row();
create trigger live_tick after insert or update or delete on public.budgets for each statement execute function private.live_tick();

create or replace function private.manila_today() returns date language sql stable set search_path = '' as
$$ select (now() at time zone 'Asia/Manila')::date $$;

-- Money moved against a budget (reversed entries don't count).
create or replace function private.budget_moved(p_budget_id bigint, p_kind public.ledger_kind) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.amount), 0) from public.ledger_entries l
   where l.budget_id = p_budget_id and l.kind = p_kind
     and not exists (select 1 from public.ledger_entries x where x.reverses_id = l.id)
$$;

-- Status of each budget with the money figures (runs under the reader's RLS).
create view public.budget_status with (security_invoker = true) as
select b.*,
       private.budget_moved(b.id, 'release') as released,
       private.budget_moved(b.id, 'expense') as spent,
       coalesce((select sum(r.amount) from public.fund_requests r where r.budget_id = b.id and r.kind = 'release' and r.status = 'pending'), 0) as pending_release,
       (b.status = 'approved' and b.liquidation_due < private.manila_today()) as is_overdue
  from public.budgets b;
grant select on public.budget_status to authenticated;

create or replace function private.has_overdue_budget(p_entity_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.budgets where entity_id = p_entity_id and status = 'approved'
                 and liquidation_due < private.manila_today())
$$;

-- Checks a release against its budget; raises a plain-language error if it doesn't fit.
create or replace function private.check_release(p_entity_id bigint, p_budget_id bigint, p_amount numeric, p_exclude bigint default null)
returns void language plpgsql stable security definer set search_path = '' as $$
declare b record; left_ numeric;
begin
  if private.has_overdue_budget(p_entity_id) then
    raise exception 'A budget''s liquidation is overdue. Liquidate it first; no new releases until then.';
  end if;
  if p_budget_id is null then return; end if;
  select * into b from public.budgets where id = p_budget_id;
  if b.id is null or b.entity_id <> p_entity_id then raise exception 'Budget not found for this org/club.'; end if;
  if b.status <> 'approved' then raise exception 'Releases need an approved budget (this one is %).', replace(b.status, '_', ' '); end if;
  left_ := b.total - private.budget_moved(b.id, 'release')
           - coalesce((select sum(amount) from public.fund_requests where budget_id = b.id and kind = 'release'
                        and status = 'pending' and id is distinct from p_exclude), 0);
  if p_amount > left_ then raise exception 'That is more than what is left of the budget (₱%).', greatest(left_, 0); end if;
end $$;

-- ── Treasurer: file / cancel a budget ─────────────────────────────────────────────────────────────────────────
create or replace function private.file_budget(p_entity_id bigint, p_title text, p_purpose text, p_activity_date date, p_items jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_total numeric := 0; it jsonb; v_year bigint := private.current_school_year_id();
begin
  if (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer can file its budgets.' using errcode = '42501';
  end if;
  if v_year is null then raise exception 'SAS hasn''t opened the school year yet.'; end if;
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = v_year) then
    raise exception 'This school year is already closed for your org/club.';
  end if;
  if coalesce(length(trim(p_title)), 0) < 3 then raise exception 'Name the activity (at least 3 characters).'; end if;
  if p_activity_date is null then raise exception 'Pick the activity date.'; end if;
  if p_activity_date < private.manila_today() - 30 then raise exception 'The activity date is too far in the past.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Up to 50 items per budget.'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce(length(trim(it->>'item')), 0) = 0 then raise exception 'Every item needs a name.'; end if;
    if (it->>'qty')::numeric <= 0 or (it->>'unit_cost')::numeric < 0 then raise exception 'Check the quantity and cost of "%".', it->>'item'; end if;
    v_total := v_total + round((it->>'qty')::numeric * (it->>'unit_cost')::numeric, 2);
  end loop;
  if v_total <= 0 then raise exception 'The budget total must be more than ₱0.'; end if;
  insert into public.budgets (entity_id, school_year_id, title, purpose, activity_date, liquidation_due, total, filed_by)
  values (p_entity_id, v_year, trim(p_title), nullif(trim(p_purpose), ''), p_activity_date, p_activity_date + 15, v_total, (select auth.uid()))
  returning id into v_id;
  insert into public.budget_items (budget_id, item, qty, unit_cost)
  select v_id, trim(value->>'item'), (value->>'qty')::numeric, round((value->>'unit_cost')::numeric, 2) from jsonb_array_elements(p_items);
  return v_id;
end $$;

create or replace function private.cancel_budget(p_budget_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if (select private.my_entity_id()) is distinct from b.entity_id then raise exception 'Only this org/club''s treasurer can cancel it.' using errcode = '42501'; end if;
  if b.status not in ('pending', 'approved') then raise exception 'This budget can''t be cancelled (it is %).', replace(b.status, '_', ' '); end if;
  if exists (select 1 from public.ledger_entries where budget_id = b.id)
     or exists (select 1 from public.fund_requests where budget_id = b.id and status = 'pending') then
    raise exception 'Money was already requested or moved under this budget. Submit its liquidation instead.';
  end if;
  update public.budgets set status = 'cancelled', reviewed_at = now() where id = b.id;
end $$;

-- ── SAS: approve / reject a budget ────────────────────────────────────────────────────────────────────────────
create or replace function private.review_budget(p_budget_id bigint, p_approve boolean, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  perform private.require_admin();
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if b.status <> 'pending' then raise exception 'This budget was already %.', replace(b.status, '_', ' '); end if;
  if not p_approve and coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say why the budget is rejected.'; end if;
  update public.budgets set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = nullif(trim(p_remarks), '')
   where id = b.id;
end $$;

-- ── Liquidation ───────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.submit_liquidation(p_budget_id bigint, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if (select private.my_entity_id()) is distinct from b.entity_id then raise exception 'Only this org/club''s treasurer can liquidate it.' using errcode = '42501'; end if;
  if b.status <> 'approved' then raise exception 'Only an approved budget can be liquidated (this one is %).', replace(b.status, '_', ' '); end if;
  if exists (select 1 from public.fund_requests where budget_id = b.id and status = 'pending') then
    raise exception 'Wait for SAS to decide the pending requests under this budget first.';
  end if;
  if coalesce(length(trim(p_note)), 0) < 3 then raise exception 'Write a short report of the activity (what was bought, what was left).'; end if;
  update public.budgets set status = 'liquidation_submitted', liquidation_note = trim(p_note), liquidation_submitted_at = now(), remarks = null
   where id = b.id;
end $$;

create or replace function private.review_liquidation(p_budget_id bigint, p_approve boolean, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b record;
begin
  perform private.require_admin();
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if b.status <> 'liquidation_submitted' then raise exception 'There is no liquidation waiting for this budget.'; end if;
  if not p_approve and coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say what to fix in the liquidation.'; end if;
  if p_approve then
    update public.budgets set status = 'liquidated', liquidated_by = (select auth.uid()), liquidated_at = now(), remarks = nullif(trim(p_remarks), '')
     where id = b.id;
  else   -- returned: back to approved, the treasurer fixes and submits again (still due on the same date)
    update public.budgets set status = 'approved', remarks = trim(p_remarks) where id = b.id;
  end if;
end $$;

-- ── Requests now carry a budget ───────────────────────────────────────────────────────────────────────────────
drop function public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category);
drop function private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category);

create function private.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null, p_budget_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; v_id bigint; v_year bigint := private.current_school_year_id(); b record;
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

  if p_kind = 'release' then
    if p_budget_id is null then raise exception 'Pick the approved budget this release is for. No budget yet? File one under Budgets.'; end if;
    perform private.check_release(p_entity_id, p_budget_id, p_amount);
  elsif p_kind = 'expense' and p_budget_id is not null then
    select * into b from public.budgets where id = p_budget_id;
    if b.id is null or b.entity_id <> p_entity_id or b.status <> 'approved' then
      raise exception 'Expenses can only be tagged to an approved budget that isn''t liquidated yet.';
    end if;
  elsif p_kind = 'remittance' and p_budget_id is not null then
    raise exception 'A remittance isn''t tied to a budget.';
  end if;

  if p_kind in ('remittance', 'expense')
     and p_amount > c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense') then
    raise exception 'Amount is more than the cash available (₱%).',
      c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense');
  end if;
  if p_kind = 'release' and p_amount > s - private.pending(p_entity_id, 'release') then
    raise exception 'Amount is more than the saved funds available (₱%).', s - private.pending(p_entity_id, 'release');
  end if;

  insert into public.fund_requests (entity_id, school_year_id, kind, amount, description, attachment_path, filed_by, category, budget_id)
  values (p_entity_id, v_year, p_kind, round(p_amount, 2), trim(p_description), p_attachment_path, (select auth.uid()),
          case when p_kind = 'expense' then coalesce(p_category, 'other') end, p_budget_id)
  returning id into v_id;
  return v_id;
end $$;

create function public.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null, p_budget_id bigint default null)
returns bigint language sql set search_path = '' as $$
  select private.file_request(p_entity_id, p_kind, p_amount, p_description, p_attachment_path, p_category, p_budget_id) $$;

create or replace function private.review_request(p_request_id bigint, p_approve boolean, p_remarks text default null, p_category public.expense_category default null)
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
  -- Releases filed before budgets existed (budget_id null) are still decided as before.
  if r.kind = 'release' and r.budget_id is not null then perform private.check_release(r.entity_id, r.budget_id, r.amount, r.id); end if;

  v_cat := case when r.kind = 'expense' then coalesce(p_category, r.category, 'other') end;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path, category, budget_id)
  values (r.entity_id, r.school_year_id, r.kind::text::public.ledger_kind, r.amount, r.description, r.id, r.attachment_path, v_cat, r.budget_id)
  returning id into v_entry;

  update public.fund_requests
     set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = nullif(trim(p_remarks), ''),
         category = v_cat
   where id = r.id;
  return v_entry;
end $$;

drop function public.admin_release(bigint, numeric, text);
drop function private.admin_release(bigint, numeric, text);
create function private.admin_release(p_entity_id bigint, p_amount numeric, p_description text, p_budget_id bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare s numeric; v_entry bigint;
begin
  perform private.require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than ₱0.'; end if;
  if coalesce(length(trim(p_description)), 0) < 3 then raise exception 'Describe what the release is for.'; end if;
  perform private.lock_entity(p_entity_id);
  perform private.check_release(p_entity_id, p_budget_id, p_amount);
  select saved into s from private.pockets(p_entity_id);
  if p_amount > s - private.pending(p_entity_id, 'release') then
    raise exception 'Amount is more than the saved funds available (₱%).', s - private.pending(p_entity_id, 'release');
  end if;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, budget_id)
  values (p_entity_id, private.current_school_year_id(), 'release', round(p_amount, 2), trim(p_description), p_budget_id)
  returning id into v_entry;
  return v_entry;
end $$;
create function public.admin_release(p_entity_id bigint, p_amount numeric, p_description text, p_budget_id bigint default null)
returns bigint language sql set search_path = '' as $$ select private.admin_release(p_entity_id, p_amount, p_description, p_budget_id) $$;

-- ── Notifications on every budget step ────────────────────────────────────────────────────────────────────────
create or replace function private.notify_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text;
begin
  select short_name into org from public.entities where id = new.entity_id;
  if tg_op = 'INSERT' then
    perform private.notify(private.admin_ids(), 'request', org || ' filed a budget', new.title || ' · ' || private.peso(new.total), '/approvals?tab=budgets');
  elsif new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') and old.status = 'pending' then
      perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision', 'SAS ' || new.status || ' your budget',
        new.title || coalesce(' · ' || left(new.remarks, 80), ''), '/requests?tab=budgets');
    elsif new.status = 'liquidation_submitted' then
      perform private.notify(private.admin_ids(), 'request', org || ' submitted a liquidation', new.title, '/approvals?tab=budgets');
    elsif new.status = 'liquidated' then
      perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision', 'Liquidation approved', new.title, '/requests?tab=budgets');
    elsif new.status = 'approved' and old.status = 'liquidation_submitted' then
      perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision', 'SAS returned your liquidation',
        new.title || coalesce(' · ' || left(new.remarks, 80), ''), '/requests?tab=budgets');
    end if;
  end if;
  return null;
end $$;
create trigger notify_budget after insert or update of status on public.budgets for each row execute function private.notify_budget();

-- Daily (pg_cron, migration 33): day-7 reminder, due-date reminder, then overdue (treasurer + SAS), once each.
create or replace function private.budget_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare b record; n int := 0; today date := private.manila_today(); org text;
begin
  for b in select * from public.budgets where status = 'approved' loop
    select short_name into org from public.entities where id = b.entity_id;
    if today > b.liquidation_due and not b.overdue_notified then
      perform private.notify(private.treasurer_ids(b.entity_id) || private.admin_ids(), 'request', 'Liquidation overdue: ' || org,
        b.title || ' was due ' || to_char(b.liquidation_due, 'Mon DD') || '. No new releases until it is liquidated.', '/requests?tab=budgets');
      update public.budgets set overdue_notified = true, reminded_due = true, reminded_7 = true where id = b.id; n := n + 1;
    elsif today >= b.liquidation_due and not b.reminded_due then
      perform private.notify(private.treasurer_ids(b.entity_id), 'request', 'Liquidation due today',
        b.title || ' · submit it today to keep releases open.', '/requests?tab=budgets');
      update public.budgets set reminded_due = true, reminded_7 = true where id = b.id; n := n + 1;
    elsif today >= b.activity_date + 7 and not b.reminded_7 then
      perform private.notify(private.treasurer_ids(b.entity_id), 'request', 'Liquidation due ' || to_char(b.liquidation_due, 'Mon DD'),
        b.title || ' · submit the liquidation with the receipts.', '/requests?tab=budgets');
      update public.budgets set reminded_7 = true where id = b.id; n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── Turnover: every budget closed first ───────────────────────────────────────────────────────────────────────
create or replace function private.close_school_year(p_entity_id bigint, p_school_year_id bigint)
returns numeric language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; t uuid[];
begin
  perform private.require_admin();
  perform private.lock_entity(p_entity_id);
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = p_school_year_id) then
    raise exception 'This school year is already closed for this org/club.';
  end if;
  if exists (select 1 from public.fund_requests
             where entity_id = p_entity_id and status = 'pending') then
    raise exception 'Resolve all pending requests first.';
  end if;
  if exists (select 1 from public.budgets where entity_id = p_entity_id
             and status in ('pending', 'approved', 'liquidation_submitted')) then
    raise exception 'Every budget must be liquidated (or cancelled/decided) before turnover.';
  end if;
  select cash, saved into c, s from private.pockets(p_entity_id);
  if c <> 0 then raise exception 'All cash must be remitted before turnover (₱% still on hand).', c; end if;
  insert into public.year_closures (entity_id, school_year_id, closed_by, closing_total)
  values (p_entity_id, p_school_year_id, (select auth.uid()), c + s);

  select array_agg(id) into t from public.profiles where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id;
  if t is not null then
    perform private.notify(t, 'account_decision', 'Your term as treasurer has ended',
      'SAS closed the school year. Thank you! The saved funds carry over to the next officers.', '/');
    update public.profiles set status = 'disabled', reviewed_by = (select auth.uid()), reviewed_at = now(),
           review_remarks = 'Term ended — school year closed'
     where id = any(t);
    delete from public.push_devices where profile_id = any(t);
  end if;
  return c + s;
end $$;

-- ── Public wrappers + grants ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.file_budget(p_entity_id bigint, p_title text, p_purpose text, p_activity_date date, p_items jsonb)
returns bigint language sql volatile security invoker set search_path = '' as $$ select private.file_budget(p_entity_id, p_title, p_purpose, p_activity_date, p_items) $$;
create or replace function public.cancel_budget(p_budget_id bigint)
returns void language sql volatile security invoker set search_path = '' as $$ select private.cancel_budget(p_budget_id) $$;
create or replace function public.review_budget(p_budget_id bigint, p_approve boolean, p_remarks text default null)
returns void language sql volatile security invoker set search_path = '' as $$ select private.review_budget(p_budget_id, p_approve, p_remarks) $$;
create or replace function public.submit_liquidation(p_budget_id bigint, p_note text)
returns void language sql volatile security invoker set search_path = '' as $$ select private.submit_liquidation(p_budget_id, p_note) $$;
create or replace function public.review_liquidation(p_budget_id bigint, p_approve boolean, p_remarks text default null)
returns void language sql volatile security invoker set search_path = '' as $$ select private.review_liquidation(p_budget_id, p_approve, p_remarks) $$;

revoke all on function
  private.file_budget(bigint, text, text, date, jsonb), public.file_budget(bigint, text, text, date, jsonb),
  private.cancel_budget(bigint), public.cancel_budget(bigint),
  private.review_budget(bigint, boolean, text), public.review_budget(bigint, boolean, text),
  private.submit_liquidation(bigint, text), public.submit_liquidation(bigint, text),
  private.review_liquidation(bigint, boolean, text), public.review_liquidation(bigint, boolean, text),
  private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint),
  private.admin_release(bigint, numeric, text, bigint), public.admin_release(bigint, numeric, text, bigint)
from public, anon;
grant execute on function
  private.file_budget(bigint, text, text, date, jsonb), public.file_budget(bigint, text, text, date, jsonb),
  private.cancel_budget(bigint), public.cancel_budget(bigint),
  private.review_budget(bigint, boolean, text), public.review_budget(bigint, boolean, text),
  private.submit_liquidation(bigint, text), public.submit_liquidation(bigint, text),
  private.review_liquidation(bigint, boolean, text), public.review_liquidation(bigint, boolean, text),
  private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint),
  private.admin_release(bigint, numeric, text, bigint), public.admin_release(bigint, numeric, text, bigint)
to authenticated;
-- Internal helpers: no direct calls from the app.
revoke all on function private.budget_reminders(), private.notify_budget(), private.check_release(bigint, bigint, numeric, bigint)
  from public, anon, authenticated;
grant execute on function private.budget_moved(bigint, public.ledger_kind), private.manila_today(), private.has_overdue_budget(bigint) to authenticated;
