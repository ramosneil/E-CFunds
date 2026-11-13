-- Screens update themselves (Neil, 2026-11-13). Every change batch writes one tiny "tick" (topic only, no data);
-- every approved signed-in user receives ticks over Realtime and their open screens re-fetch — still only what RLS
-- lets them read. Statement-level triggers: one tick per statement, even when it touches thousands of rows.

create table public.live_changes (
  id    bigint generated always as identity primary key,
  topic text not null,
  at    timestamptz not null default now()
);
create index live_changes_at_idx on public.live_changes (at);
alter table public.live_changes enable row level security;
revoke all on public.live_changes from anon, authenticated;
grant select on public.live_changes to authenticated;
create policy "approved users read ticks" on public.live_changes
  for select to authenticated using ((select private.is_approved()));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_changes;
  end if;
end $$;

create or replace function private.live_tick()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.live_changes (topic) values (tg_table_name);
  -- keep the table tiny: drop ticks older than a day (cheap, indexed)
  delete from public.live_changes where at < now() - interval '1 day';
  return null;
end $$;
revoke all on function private.live_tick() from public, anon;

do $$
declare t text;
begin
  foreach t in array array['ledger_entries','fund_requests','memberships','students','entities','profiles',
                           'school_years','semesters','accredited_entries','courses','course_orgs'] loop
    execute format('create trigger live_tick after insert or update or delete on public.%I
                    for each statement execute function private.live_tick()', t);
  end loop;
end $$;
