-- Fix (live, 2026-11-15): through the Supabase API the report failed with "DELETE requires a WHERE clause" —
-- PostgREST connections load pg_safeupdate, which the rehearsal's direct connection doesn't. Same function as
-- migration 35 with `where true` on the temp-table clear.
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
  delete from fr_l where true;   -- the API connection (pg_safeupdate) refuses a DELETE without WHERE
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
      'title', k.title, 'budget_id', k.budget_id, 'first_date', min(f.occurred_on),
      'subtotal', sum((it->>'total')::numeric),
      'items', jsonb_agg(it order by f.occurred_on, f.id) ) as g
    from fr_l f left join public.budgets b on b.id = f.budget_id
    cross join lateral (select coalesce(b.title, nullif(trim(f.description), ''), 'Other expenses') as title, f.budget_id) k
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
    group by k.budget_id, k.title
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
