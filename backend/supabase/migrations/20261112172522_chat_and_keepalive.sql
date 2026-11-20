-- Phase 6 (Neil, 2026-11-13): AI chatbot daily quota (30 questions per person per Manila day; admin unlimited)
-- and an anonymous keep-alive ping so the free project is not paused after 7 idle days.

create table private.chat_usage (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  count      integer not null default 0 check (count >= 0),
  primary key (profile_id, day)
);
alter table private.chat_usage enable row level security;          -- no policies: only the function below
revoke all on private.chat_usage from public, anon, authenticated;

-- Counts one question for the caller and returns how many are left today (null = unlimited, i.e. admin).
create or replace function private.use_chat_quota()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r public.app_role := (select private.my_role());
  today date := (now() at time zone 'Asia/Manila')::date;
  used integer;
  daily constant integer := 30;
begin
  if r is null then raise exception 'Only approved accounts can use the assistant.' using errcode = '42501'; end if;
  if r = 'admin' then return null; end if;
  insert into private.chat_usage (profile_id, day, count) values (me, today, 1)
  on conflict (profile_id, day) do update set count = private.chat_usage.count + 1
  where private.chat_usage.count < daily
  returning count into used;
  if used is null then
    raise exception 'You have used all % questions for today. They reset at midnight (Manila time).', daily
      using errcode = 'P0001';
  end if;
  return daily - used;
end $$;

create function public.use_chat_quota()
returns integer
language sql volatile security invoker set search_path = '' as $$
  select private.use_chat_quota()
$$;

revoke all on function private.use_chat_quota() from public, anon;
revoke all on function public.use_chat_quota() from public, anon;
grant execute on function private.use_chat_quota() to authenticated;
grant execute on function public.use_chat_quota() to authenticated;

-- Keep-alive: the only function anonymous callers may run. It touches the database and reveals nothing.
create or replace function public.keep_alive()
returns text language sql stable security invoker set search_path = '' as $$
  select case when count(*) >= 0 then 'ok' end from pg_catalog.pg_class where oid = 'pg_catalog.pg_class'::regclass
$$;
revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
