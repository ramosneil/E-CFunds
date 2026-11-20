-- Push notifications when the app is closed (Neil, 2026-11-14). Firebase Cloud Messaging.
-- The phone registers a push token after sign-in (save_push_token) and removes it on sign-out (drop_push_token),
-- so signed-out phones get nothing. Every NEW notification row asks Edge Function `push` (via pg_net) to send it to
-- the recipient's phones. The call carries a random secret kept in private.push_config; the function proves itself
-- with it before it may read the job (push_job) — nothing else can trigger pushes.

create extension if not exists pg_net with schema extensions;

create table public.push_devices (
  token      text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'android' check (platform in ('android', 'web')),
  updated_at timestamptz not null default now()
);
create index push_devices_profile_idx on public.push_devices (profile_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;
grant select on public.push_devices to authenticated;
create policy "own push devices" on public.push_devices for select to authenticated using (profile_id = (select auth.uid()));

create table private.push_config (id boolean primary key default true check (id), secret text not null, url text not null);
alter table private.push_config enable row level security;
insert into private.push_config (secret, url)
values (encode(extensions.gen_random_bytes(32), 'hex'), 'https://nvmlawpojydnouzqilaf.supabase.co/functions/v1/push');

-- ---------- the phone's token ----------
create or replace function private.save_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if coalesce(length(p_token), 0) < 20 or length(p_token) > 4096 then raise exception 'Invalid push token.'; end if;
  insert into public.push_devices (token, profile_id, platform, updated_at)
  values (p_token, (select auth.uid()), coalesce(p_platform, 'android'), now())
  on conflict (token) do update set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end $$;
create or replace function private.drop_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_devices where token = p_token and profile_id = (select auth.uid())
$$;
create function public.save_push_token(p_token text, p_platform text default 'android')
returns void language sql volatile security invoker set search_path = '' as $$ select private.save_push_token(p_token, p_platform) $$;
create function public.drop_push_token(p_token text)
returns void language sql volatile security invoker set search_path = '' as $$ select private.drop_push_token(p_token) $$;

-- ---------- new notification → ask the push function ----------
create or replace function private.push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if new.read_at is not null then return null; end if;                          -- e.g. "app updated" notes
  if not exists (select 1 from public.push_devices where profile_id = new.recipient) then return null; end if;
  select secret, url into c from private.push_config;
  perform net.http_post(
    url := c.url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret),
    timeout_milliseconds := 5000);
  return null;
end $$;
create trigger push_on_notification after insert on public.notifications
  for each row execute function private.push_on_notification();

-- ---------- for the push function only (service role + secret) ----------
create or replace function private.push_job(p_id bigint, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n record;
begin
  if p_secret is distinct from (select secret from private.push_config) then raise exception 'not allowed'; end if;
  select * into n from public.notifications where id = p_id;
  if n.id is null then return null; end if;
  return jsonb_build_object('title', n.title, 'body', coalesce(n.body, ''), 'link', coalesce(n.link, '/'), 'kind', n.kind,
    'tokens', coalesce((select jsonb_agg(token) from public.push_devices where profile_id = n.recipient), '[]'::jsonb));
end $$;
create or replace function private.push_drop_dead(p_token text, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is distinct from (select secret from private.push_config) then raise exception 'not allowed'; end if;
  delete from public.push_devices where token = p_token;
end $$;

revoke all on function private.save_push_token(text, text), private.drop_push_token(text), private.push_on_notification()
  from public, anon;
grant execute on function private.save_push_token(text, text), private.drop_push_token(text) to authenticated;
revoke all on function public.save_push_token(text, text), public.drop_push_token(text) from public, anon;
grant execute on function public.save_push_token(text, text), public.drop_push_token(text) to authenticated;
create function public.push_job(p_id bigint, p_secret text)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.push_job(p_id, p_secret) $$;
create function public.push_drop_dead(p_token text, p_secret text)
returns void language sql volatile security invoker set search_path = '' as $$ select private.push_drop_dead(p_token, p_secret) $$;
revoke all on function private.push_job(bigint, text), private.push_drop_dead(text, text),
  public.push_job(bigint, text), public.push_drop_dead(text, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.push_job(bigint, text), private.push_drop_dead(text, text),
  public.push_job(bigint, text), public.push_drop_dead(text, text) to service_role;
