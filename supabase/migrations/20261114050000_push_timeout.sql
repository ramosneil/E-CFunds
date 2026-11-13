-- Push requests: wait up to 20 s for the push function (its first start fetches a Google token; 5 s was too short).
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
    timeout_milliseconds := 20000);
  return null;
end $$;
