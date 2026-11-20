-- Unpaid-dues reminders + scheduled jobs (Neil, 2026-11-15).
--  • Treasurer (own org/club) or SAS presses "Remind unpaid": every student with an account who still owes this
--    org/club for the current semester (or school year) gets a bell + phone note with their amount.
--    Max once per Manila day per org/club; each send is logged (who, when, how many).
--  • pg_cron: every Monday 8:00 AM Manila the same reminder goes out automatically for every org/club, and every day
--    at 8:00 AM the budget liquidation reminders run (private.budget_reminders, migration 32).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'request', 'request_decision', 'payment', 'account', 'message', 'receipt', 'fees', 'account_decision', 'announcement',
  'members', 'semester', 'fee_change', 'app_update', 'dues_reminder']));

create table public.dues_reminders (
  id bigint generated always as identity primary key,
  entity_id bigint not null references public.entities(id) on delete cascade,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.profiles(id),     -- null = the weekly automatic run
  students int not null,
  unique (entity_id, sent_on)
);
alter table public.dues_reminders enable row level security;
create policy "SAS reads all, treasurer reads own org's reminders" on public.dues_reminders for select to authenticated
  using ((select private.is_admin()) or entity_id = (select private.my_entity_id()));
grant select on public.dues_reminders to authenticated;

-- Sends the reminder for one org/club. Returns how many students were reminded; -1 if already sent today.
create or replace function private.send_dues_reminder(p_entity_id bigint, p_by uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare v_year bigint; v_sem bigint; v_term int; e record; s record; n int := 0; today date := private.manila_today();
begin
  select id into v_year from public.school_years where is_current;
  if v_year is null then return 0; end if;
  select id, term into v_sem, v_term from public.semesters where is_current and school_year_id = v_year;
  select * into e from public.entities where id = p_entity_id;
  if e.id is null or not e.is_active then return 0; end if;
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = v_year) then return 0; end if;
  if exists (select 1 from public.dues_reminders where entity_id = p_entity_id and sent_on = today) then return -1; end if;

  for s in
    select p.id as profile_id, sum(m.amount_due) as owed
      from public.memberships m
      join public.profiles p on p.student_id = m.student_id and p.role = 'student' and p.status = 'approved'
     where m.entity_id = p_entity_id and m.school_year_id = v_year and not m.is_paid and m.amount_due > 0
       and (m.semester_id is null or m.semester_id = v_sem)
     group by p.id
  loop
    perform private.notify(array[s.profile_id], 'dues_reminder', 'Reminder: ' || e.short_name || ' dues',
      'You still owe ' || private.peso(s.owed) || ' to ' || e.short_name
        || case when e.dues_period = 'semester' and v_term is not null then ' for the ' || case v_term when 1 then '1st' else '2nd' end || ' semester' else ' this school year' end
        || '. Pay your treasurer to get your receipt.', '/');
    n := n + 1;
  end loop;
  insert into public.dues_reminders (entity_id, sent_on, sent_by, students) values (p_entity_id, today, p_by, n);
  return n;
end $$;

create or replace function private.remind_unpaid(p_entity_id bigint)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not (select private.is_admin()) and (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer or SAS can send reminders.' using errcode = '42501';
  end if;
  perform private.lock_entity(p_entity_id);
  n := private.send_dues_reminder(p_entity_id, (select auth.uid()));
  if n = -1 then raise exception 'A reminder already went out today. You can send the next one tomorrow.'; end if;
  return n;
end $$;
create or replace function public.remind_unpaid(p_entity_id bigint)
returns int language sql volatile security invoker set search_path = '' as $$ select private.remind_unpaid(p_entity_id) $$;
revoke all on function private.remind_unpaid(bigint), public.remind_unpaid(bigint) from public, anon;
grant execute on function private.remind_unpaid(bigint), public.remind_unpaid(bigint) to authenticated;

-- Weekly automatic run for every active org/club (skips any that already sent one today).
create or replace function private.remind_unpaid_all()
returns int language plpgsql security definer set search_path = '' as $$
declare e record; total int := 0; n int;
begin
  for e in select id from public.entities where is_active loop
    n := private.send_dues_reminder(e.id, null);
    if n > 0 then total := total + n; end if;
  end loop;
  return total;
end $$;
revoke all on function private.send_dues_reminder(bigint, uuid), private.remind_unpaid_all() from public, anon, authenticated;

-- Scheduled jobs (pg_cron runs in UTC; Manila is UTC+8, so 00:00 UTC = 8:00 AM Manila).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('weekly-dues-reminders', '0 0 * * 1', $$select private.remind_unpaid_all()$$);
select cron.schedule('daily-budget-reminders', '0 0 * * *', $$select private.budget_reminders()$$);
