-- Official Financial Report (Neil, 2026-11-15) — the SAS form orgs used to fill by hand (FR as of 9.15.25.xlsx),
-- now generated from what each org recorded. Neil's choices: no IGP line; each expense lists its items (particular,
-- unit, qty, unit price) grouped by activity (budget); the treasurer types the cash count at download (not stored);
-- signatory names are saved once per term.

-- ── Items on each expense (the receipt's lines) ───────────────────────────────────────────────────────────────
create table public.expense_items (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.fund_requests(id) on delete cascade,
  line_no smallint not null,
  particular text not null check (length(particular) between 1 and 120),
  unit text not null default 'pc' check (length(unit) between 1 and 20),
  qty numeric(10,2) not null check (qty > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unique (request_id, line_no)
);
alter table public.expense_items enable row level security;
create policy "items follow their request" on public.expense_items for select to authenticated
  using (exists (select 1 from public.fund_requests r where r.id = request_id));
grant select on public.expense_items to authenticated;

-- file_request gains p_items (expenses): the amount becomes the items' total.
drop function public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint);
drop function private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint);

create function private.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null, p_budget_id bigint default null,
  p_items jsonb default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; v_id bigint; v_year bigint := private.current_school_year_id(); b record; it jsonb; v_total numeric := 0;
begin
  if (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer can file its requests.' using errcode = '42501';
  end if;
  if p_items is not null then
    if p_kind <> 'expense' then raise exception 'Only expenses have item lines.'; end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one item from the receipt.'; end if;
    if jsonb_array_length(p_items) > 30 then raise exception 'Up to 30 items per expense.'; end if;
    for it in select value from jsonb_array_elements(p_items) loop
      if coalesce(length(trim(it->>'particular')), 0) = 0 then raise exception 'Every item needs a name (particular).'; end if;
      if coalesce((it->>'qty')::numeric, 0) <= 0 or coalesce((it->>'unit_price')::numeric, -1) < 0 then
        raise exception 'Check the quantity and unit price of "%".', it->>'particular';
      end if;
      v_total := v_total + round((it->>'qty')::numeric * (it->>'unit_price')::numeric, 2);
    end loop;
    p_amount := v_total;
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
  if p_items is not null then
    insert into public.expense_items (request_id, line_no, particular, unit, qty, unit_price)
    select v_id, ordinality, trim(value->>'particular'), coalesce(nullif(trim(value->>'unit'), ''), 'pc'),
           (value->>'qty')::numeric, round((value->>'unit_price')::numeric, 2)
      from jsonb_array_elements(p_items) with ordinality;
  end if;
  return v_id;
end $$;

create function public.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric, p_description text,
  p_attachment_path text default null, p_category public.expense_category default null, p_budget_id bigint default null,
  p_items jsonb default null)
returns bigint language sql set search_path = '' as $$
  select private.file_request(p_entity_id, p_kind, p_amount, p_description, p_attachment_path, p_category, p_budget_id, p_items) $$;

-- ── Signatories (per org/club per school year) + report header settings ───────────────────────────────────────
create table public.signatories (
  entity_id bigint not null references public.entities(id) on delete cascade,
  school_year_id bigint not null references public.school_years(id) on delete cascade,
  head_title text not null default 'Mayor' check (length(head_title) between 2 and 40),
  head_name text check (length(head_name) <= 80),
  auditor_name text check (length(auditor_name) <= 80),
  adviser_name text check (length(adviser_name) <= 80),
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now(),
  primary key (entity_id, school_year_id)
);
alter table public.signatories enable row level security;
-- Everyone signed in may read names (needed to print the SSG officers on every org's report).
create policy "signed-in users read signatories" on public.signatories for select to authenticated using (true);
grant select on public.signatories to authenticated;
create trigger audit_signatories after insert or update or delete on public.signatories for each row execute function private.audit_row();

create table public.report_settings (
  id boolean primary key default true check (id),
  republic_line text not null default 'Republic of the Philippines',
  school_name text not null default 'OCCIDENTAL MINDORO STATE COLLEGE',
  campus_line text not null default 'Mamburao, Occidental Mindoro',
  website text default 'www.omsc.edu.ph',
  email text default 'sasofficemamburao@omsc.ph.education',
  phone text default '+99660225543',
  coordinator_name text,
  coordinator_title text not null default 'SAS Coordinator',
  updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
insert into public.report_settings (id) values (true);
alter table public.report_settings enable row level security;
create policy "signed-in users read report settings" on public.report_settings for select to authenticated using (true);
grant select on public.report_settings to authenticated;
create trigger audit_report_settings after insert or update or delete on public.report_settings for each row execute function private.audit_row();

create or replace function private.save_signatories(p_entity_id bigint, p_head_title text, p_head_name text, p_auditor_name text, p_adviser_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_year bigint := private.current_school_year_id();
begin
  if not (select private.is_admin()) and (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer or SAS can change its signatories.' using errcode = '42501';
  end if;
  if v_year is null then raise exception 'SAS hasn''t opened the school year yet.'; end if;
  insert into public.signatories (entity_id, school_year_id, head_title, head_name, auditor_name, adviser_name, updated_by, updated_at)
  values (p_entity_id, v_year, coalesce(nullif(trim(p_head_title), ''), 'Mayor'), nullif(trim(p_head_name), ''),
          nullif(trim(p_auditor_name), ''), nullif(trim(p_adviser_name), ''), (select auth.uid()), now())
  on conflict (entity_id, school_year_id) do update set head_title = excluded.head_title, head_name = excluded.head_name,
    auditor_name = excluded.auditor_name, adviser_name = excluded.adviser_name, updated_by = excluded.updated_by, updated_at = now();
end $$;

create or replace function private.save_report_settings(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.report_settings set
    republic_line = coalesce(nullif(trim(p->>'republic_line'), ''), republic_line),
    school_name = coalesce(nullif(trim(p->>'school_name'), ''), school_name),
    campus_line = coalesce(nullif(trim(p->>'campus_line'), ''), campus_line),
    -- Only the keys sent are changed (a sent empty value clears an optional line).
    website = case when p ? 'website' then nullif(trim(p->>'website'), '') else website end,
    email = case when p ? 'email' then nullif(trim(p->>'email'), '') else email end,
    phone = case when p ? 'phone' then nullif(trim(p->>'phone'), '') else phone end,
    coordinator_name = case when p ? 'coordinator_name' then nullif(trim(p->>'coordinator_name'), '') else coordinator_name end,
    coordinator_title = coalesce(nullif(trim(p->>'coordinator_title'), ''), coordinator_title),
    updated_by = (select auth.uid()), updated_at = now()
  where id;
end $$;

-- ── The report ────────────────────────────────────────────────────────────────────────────────────────────────
-- p_semester_id null = whole school year. Everything comes from the ledger (reversed entries are left out of the
-- item lists; any SAS correction that isn't a fee or expense shows as one "Adjustments" line so totals always add up).
create or replace function private.get_financial_report(p_entity_id bigint, p_semester_id bigint default null, p_as_of date default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  e record; sem record; y record; v_start date; v_end date; v_year bigint;
  prev numeric; chg numeric; coll numeric; listed numeric; cash numeric; saved numeric;
  paid int; unpaid int; rate numeric; groups jsonb; sig jsonb; ssg jsonb; st jsonb; tre text; v_term int;
begin
  if not (select private.is_admin()) and (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer or SAS can open its financial report.' using errcode = '42501';
  end if;
  select * into e from public.entities where id = p_entity_id;
  if e.id is null then raise exception 'Org/club not found.'; end if;
  if p_semester_id is not null then
    select * into sem from public.semesters where id = p_semester_id;
    if sem.id is null then raise exception 'Semester not found.'; end if;
    v_year := sem.school_year_id; v_start := sem.starts_on; v_term := sem.term;
  else
    v_year := private.current_school_year_id();
  end if;
  select * into y from public.school_years where id = v_year;
  if y.id is null then raise exception 'No school year.'; end if;
  if v_start is null then v_start := y.starts_on; end if;
  v_end := coalesce(p_as_of, private.manila_today());
  if v_end < v_start then raise exception 'The "as of" date is before the period starts.'; end if;

  -- Entries with their effective kind (a reversal counts as the kind it reverses).
  create temp table if not exists fr_l (id bigint, kind text, eff numeric, dcash numeric, dsaved numeric, occurred_on date,
    budget_id bigint, request_id bigint, description text, amount numeric, reversed boolean) on commit drop;
  delete from fr_l;
  insert into fr_l
  select l.id, coalesce(o.kind, l.kind)::text,
         private.d_cash(l.kind, l.amount, l.pocket, l.direction) + private.d_saved(l.kind, l.amount, l.pocket, l.direction),
         private.d_cash(l.kind, l.amount, l.pocket, l.direction), private.d_saved(l.kind, l.amount, l.pocket, l.direction),
         l.occurred_on, l.budget_id, l.request_id, l.description, l.amount,
         exists (select 1 from public.ledger_entries x where x.reverses_id = l.id and x.occurred_on <= v_end)
    from public.ledger_entries l left join public.ledger_entries o on o.id = l.reverses_id
   where l.entity_id = p_entity_id and l.occurred_on <= v_end;

  select coalesce(sum(eff), 0) into prev from fr_l where occurred_on < v_start;
  select coalesce(sum(eff), 0), coalesce(sum(dcash), 0), coalesce(sum(dsaved), 0) into chg, cash, saved from fr_l where occurred_on >= v_start;
  cash := cash + (select coalesce(sum(dcash), 0) from fr_l where occurred_on < v_start);
  saved := saved + (select coalesce(sum(dsaved), 0) from fr_l where occurred_on < v_start);
  select coalesce(sum(eff), 0) into coll from fr_l where occurred_on >= v_start and kind = 'collection';
  select coalesce(sum(amount), 0) into listed from fr_l where occurred_on >= v_start and kind = 'expense' and eff < 0 and not reversed;

  -- Membership counts for the period (fees per semester, or per school year).
  select count(*) filter (where m.is_paid and (m.paid_at at time zone 'Asia/Manila')::date <= v_end),
         count(*) filter (where not (m.is_paid and (m.paid_at at time zone 'Asia/Manila')::date <= v_end)),
         case when count(distinct m.amount_due) = 1 then max(m.amount_due) end
    into paid, unpaid, rate
    from public.memberships m
   where m.entity_id = p_entity_id and m.school_year_id = v_year
     and (p_semester_id is null or m.semester_id is null or m.semester_id = p_semester_id);

  -- Expenses grouped by activity (budget), each with its item lines.
  select coalesce(jsonb_agg(g order by g->>'first_date', g->>'title'), '[]'::jsonb) into groups from (
    select jsonb_build_object(
      'title', coalesce(b.title, 'Other expenses'), 'budget_id', f.budget_id, 'first_date', min(f.occurred_on),
      'subtotal', sum((it->>'total')::numeric),
      'items', jsonb_agg(it order by f.occurred_on, f.id) ) as g
    from fr_l f left join public.budgets b on b.id = f.budget_id
    cross join lateral (
      select coalesce(
        (select jsonb_agg(jsonb_build_object('particular', i.particular, 'unit', i.unit, 'qty', i.qty, 'unit_price', i.unit_price,
                 'total', round(i.qty * i.unit_price, 2), 'date', f.occurred_on) order by i.line_no)
           from public.expense_items i where i.request_id = f.request_id),
        jsonb_build_array(jsonb_build_object('particular', f.description, 'unit', 'lot', 'qty', 1, 'unit_price', f.amount, 'total', f.amount, 'date', f.occurred_on))
      ) as lines
    ) li
    cross join lateral jsonb_array_elements(li.lines) it
    where f.occurred_on >= v_start and f.kind = 'expense' and f.eff < 0 and not f.reversed
    group by f.budget_id, b.title
  ) q;

  select to_jsonb(s) - 'updated_by' into sig from public.signatories s where s.entity_id = p_entity_id and s.school_year_id = v_year;
  select to_jsonb(s) - 'updated_by' into ssg from public.signatories s join public.entities x on x.id = s.entity_id
   where x.is_school_wide and s.school_year_id = v_year order by x.id limit 1;
  select to_jsonb(r) - 'updated_by' - 'id' into st from public.report_settings r where r.id;
  select full_name into tre from public.profiles where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id limit 1;

  return jsonb_build_object(
    'entity', jsonb_build_object('id', e.id, 'name', e.name, 'short_name', e.short_name, 'logo_path', e.logo_path, 'is_school_wide', e.is_school_wide),
    'school_year', y.label, 'semester_term', v_term, 'period_start', v_start, 'as_of', v_end,
    'previous_fund', prev,
    'membership', jsonb_build_object('paid', coalesce(paid, 0), 'unpaid', coalesce(unpaid, 0), 'rate', rate, 'amount', coll),
    'total_collection', coll, 'subtotal', prev + coll,
    'expense_groups', groups, 'total_expenses', listed,
    'adjustments', round(chg - coll + listed, 2),
    'remaining_fund', prev + chg, 'cash_on_hand', cash, 'saved_with_sas', saved,
    'signatories', sig, 'ssg_signatories', ssg, 'settings', st, 'treasurer_name', tre);
end $$;

create or replace function public.get_financial_report(p_entity_id bigint, p_semester_id bigint default null, p_as_of date default null)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.get_financial_report(p_entity_id, p_semester_id, p_as_of) $$;
create or replace function public.save_signatories(p_entity_id bigint, p_head_title text, p_head_name text, p_auditor_name text, p_adviser_name text)
returns void language sql volatile security invoker set search_path = '' as $$ select private.save_signatories(p_entity_id, p_head_title, p_head_name, p_auditor_name, p_adviser_name) $$;
create or replace function public.save_report_settings(p jsonb)
returns void language sql volatile security invoker set search_path = '' as $$ select private.save_report_settings(p) $$;

revoke all on function
  private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint, jsonb),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint, jsonb),
  private.get_financial_report(bigint, bigint, date), public.get_financial_report(bigint, bigint, date),
  private.save_signatories(bigint, text, text, text, text), public.save_signatories(bigint, text, text, text, text),
  private.save_report_settings(jsonb), public.save_report_settings(jsonb)
from public, anon;
grant execute on function
  private.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint, jsonb),
  public.file_request(bigint, public.request_kind, numeric, text, text, public.expense_category, bigint, jsonb),
  private.get_financial_report(bigint, bigint, date), public.get_financial_report(bigint, bigint, date),
  private.save_signatories(bigint, text, text, text, text), public.save_signatories(bigint, text, text, text, text),
  private.save_report_settings(jsonb), public.save_report_settings(jsonb)
to authenticated;
