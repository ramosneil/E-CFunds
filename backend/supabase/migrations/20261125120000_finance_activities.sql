-- Insights "Budget vs actual" (Neil, 2026-11-25): one org/club's finance report now also lists its activities —
-- approved resolution requests and activity budgets — with how much was approved, spent and returned. Students see it
-- like the rest of the report (it's their dues); only these numbers and titles go out: no files, names or remarks.
-- private.finance_json is recreated exactly as before, plus the 'activities' key (one org/club only).
create or replace function private.finance_json(p_school_year_id bigint, p_entity_id bigint, p_with_list boolean, p_staff boolean)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
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
     where expense_id is not null and expense_id not in (select reverses_id from reversed)),
  -- Activities: approved resolution requests (amount released → liquidation) and approved/liquidated budgets.
  acts as (
    select coalesce(nullif(btrim(r.activity_title), ''), nullif(btrim(r.file_name), ''), r.description, 'Resolution') as title,
           coalesce(r.reviewed_at, r.filed_at)::date as on_date,
           'resolution' as source,
           r.amount as approved,
           r.amount as released,
           case when r.liquidation_status = 'approved' then coalesce(r.liquidation_spent, 0) end as spent,
           case when r.liquidation_status = 'approved' then greatest(r.amount - coalesce(r.liquidation_spent, 0), 0) end as returned,
           case when r.liquidation_status = 'approved' then 'liquidated'
                when r.liquidation_status = 'pending' then 'liquidation_sent'
                else 'waiting_liquidation' end as state
      from public.fund_requests r
     where p_with_list and r.entity_id = p_entity_id and r.school_year_id = p_school_year_id
       and r.kind = 'resolution' and r.status = 'approved' and r.amount is not null
    union all
    -- Budget spent = expenses tagged to it; once liquidated, at least released − returned (older expenses weren't tagged).
    select b.title, coalesce(b.activity_date, b.reviewed_at::date), 'budget', b.total, m.rel,
           case when b.status = 'liquidated' then greatest(m.exp, m.rel - m.ret) else m.exp end, m.ret,
           case when b.status = 'liquidated' then 'liquidated'
                when b.liquidation_due < private.manila_today() then 'overdue'
                else 'open' end
      from public.budgets b
      cross join lateral (select private.budget_moved(b.id, 'release') as rel, private.budget_moved(b.id, 'expense') as exp,
                                 private.budget_moved(b.id, 'remittance') as ret) m
     where p_with_list and b.entity_id = p_entity_id and b.school_year_id = p_school_year_id
       and b.status in ('approved', 'liquidated'))
  select jsonb_build_object(
    'money_in',  (select coalesce(sum(amount) filter (where flow = 'in'), 0) from f),
    'money_out', (select coalesce(sum(amount) filter (where flow = 'out'), 0) from f),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'money_in', money_in, 'money_out', money_out) order by month) from monthly), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'amount', amount) order by amount desc) from cats), '[]'::jsonb),
    'expenses', case when p_with_list then coalesce((select jsonb_agg(
        jsonb_build_object('date', occurred_on, 'description', description, 'category', category, 'amount', amount)
        || case when p_staff then jsonb_build_object('receipt_checked', has_receipt) else '{}'::jsonb end
        order by occurred_on desc, expense_id desc) from list), '[]'::jsonb) end,
    'activities', case when p_with_list then coalesce((select jsonb_agg(jsonb_build_object(
        'title', title, 'date', on_date, 'source', source, 'approved', approved, 'released', released,
        'spent', spent, 'returned', returned, 'state', state) order by on_date desc nulls last, title) from acts), '[]'::jsonb) end)
$function$;
