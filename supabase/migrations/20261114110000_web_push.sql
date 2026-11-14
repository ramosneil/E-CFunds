-- Web Push (Neil, 2026-11-14): notifications on computers and on the iPhone Home Screen app, even when E-CFunds is
-- closed. A browser "token" is its push subscription (JSON: endpoint + keys), stored in push_devices with
-- platform 'web' (already allowed). The push Edge Function sends Android via FCM (as before) and web via Web Push,
-- signed with the VAPID key pair kept in private.push_config (written by a local script — never in git).

alter table private.push_config
  add column if not exists vapid_public text,
  add column if not exists vapid_private text,
  add column if not exists vapid_subject text not null default 'mailto:no-reply@ecfunds.omsc.edu.ph';

-- Web subscriptions must be real JSON with an https endpoint and both keys.
create or replace function private.save_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = '' as $$
declare j jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if coalesce(length(p_token), 0) < 20 or length(p_token) > 4096 then raise exception 'Invalid push token.'; end if;
  if coalesce(p_platform, 'android') = 'web' then
    begin j := p_token::jsonb; exception when others then raise exception 'Invalid push token.'; end;
    if coalesce(j->>'endpoint', '') !~ '^https://' or j->'keys'->>'p256dh' is null or j->'keys'->>'auth' is null then
      raise exception 'Invalid push token.';
    end if;
  end if;
  insert into public.push_devices (token, profile_id, platform, updated_at)
  values (p_token, (select auth.uid()), coalesce(p_platform, 'android'), now())
  on conflict (token) do update set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end $$;

-- The job now says which device is which, and carries the VAPID keys when there is a browser to reach.
create or replace function private.push_job(p_id bigint, p_secret text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare n record; c record; d jsonb;
begin
  select * into c from private.push_config;
  if p_secret is distinct from c.secret then raise exception 'not allowed'; end if;
  select * into n from public.notifications where id = p_id;
  if n.id is null then return null; end if;
  d := coalesce((select jsonb_agg(jsonb_build_object('token', token, 'platform', platform))
                   from public.push_devices where profile_id = n.recipient), '[]'::jsonb);
  return jsonb_build_object('title', n.title, 'body', coalesce(n.body, ''), 'link', coalesce(n.link, '/'), 'kind', n.kind,
    'tokens', coalesce((select jsonb_agg(token) from public.push_devices where profile_id = n.recipient and platform = 'android'), '[]'::jsonb),
    'devices', d,
    'vapid', case when exists (select 1 from jsonb_array_elements(d) x where x->>'platform' = 'web') and c.vapid_private is not null
                  then jsonb_build_object('public', c.vapid_public, 'private', c.vapid_private, 'subject', c.vapid_subject) end);
end $$;

revoke all on function private.save_push_token(text, text) from public, anon;
grant execute on function private.save_push_token(text, text) to authenticated;
revoke all on function private.push_job(bigint, text) from public, anon, authenticated;
grant execute on function private.push_job(bigint, text) to service_role;
