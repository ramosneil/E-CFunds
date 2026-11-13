-- In-app notifications (Neil, 2026-11-13). SAS admins are told about every org/club action: money requests filed,
-- dues payments recorded, new accounts to approve, messages from treasurers. Treasurers are told when SAS decides on
-- their request and when SAS writes to them. Each row goes to ONE person (RLS: own rows only) and is delivered live
-- (Realtime) → pop-up + sound + bell. Part D later sends the same rows as phone/browser push notifications.

create table public.notifications (
  id           bigint generated always as identity primary key,
  recipient    uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('request','request_decision','payment','account','message')),
  title        text not null,
  body         text,
  link         text,                          -- in-app route, e.g. /approvals
  group_key    text,                          -- similar events within 60 s are merged into one row
  count        integer not null default 1,
  amount       numeric(12,2),                 -- running total for grouped payments
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient, created_at desc);
create index notifications_group_idx on public.notifications (recipient, group_key, updated_at desc) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (recipient = (select auth.uid())) with check (recipient = (select auth.uid()));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------- helpers ----------
create or replace function private.peso(n numeric)
returns text language sql immutable set search_path = '' as $$
  select '₱' || to_char(coalesce(n, 0), 'FM999,999,990.00')
$$;

-- One row per recipient. With a group key, an unread row of the same group updated in the last 60 s is merged
-- (count + 1, amount added) instead of creating a new pop-up for every single payment.
create or replace function private.notify(p_recipients uuid[], p_kind text, p_title text, p_body text, p_link text,
                                          p_group text default null, p_amount numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  foreach r in array coalesce(p_recipients, '{}') loop
    if p_group is not null then
      update public.notifications n
         set count = n.count + 1, amount = coalesce(n.amount, 0) + coalesce(p_amount, 0), updated_at = now()
       where n.id = (select x.id from public.notifications x
                      where x.recipient = r and x.group_key = p_group and x.read_at is null
                        and x.updated_at > now() - interval '60 seconds'
                      order by x.updated_at desc limit 1);
      if found then continue; end if;
    end if;
    insert into public.notifications (recipient, kind, title, body, link, group_key, amount)
    values (r, p_kind, p_title, p_body, p_link, p_group, p_amount);
  end loop;
end $$;

create or replace function private.admin_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin' and status = 'approved'
$$;
create or replace function private.treasurer_ids(p_entity bigint)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.profiles
   where role = 'treasurer' and status = 'approved' and (p_entity is null or entity_id = p_entity)
$$;

-- ---------- triggers ----------
-- Money request filed → admins. Decision → that org/club's treasurer.
create or replace function private.notify_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text; what text;
begin
  select short_name into org from public.entities where id = new.entity_id;
  what := case new.kind when 'remittance' then 'remittance' when 'release' then 'release request' else 'expense' end;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(private.admin_ids(), 'request',
      org || ' filed a ' || what, private.peso(new.amount) || coalesce(' · ' || left(new.description, 80), ''), '/approvals');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision',
      'SAS ' || new.status::text || ' your ' || what,
      private.peso(new.amount) || coalesce(' · ' || left(new.remarks, 80), ''), '/requests');
  end if;
  return null;
end $$;
create trigger notify_request after insert or update of status on public.fund_requests
  for each row execute function private.notify_request();

-- Dues payment recorded (collection line) → admins, merged per org within 60 s.
create or replace function private.notify_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text;
begin
  if new.kind <> 'collection' then return null; end if;
  select short_name into org from public.entities where id = new.entity_id;
  perform private.notify(private.admin_ids(), 'payment',
    org || ' recorded a dues payment', private.peso(new.amount) || coalesce(' · ' || new.description, ''),
    '/orgs/' || new.entity_id, 'payment:' || new.entity_id, new.amount);
  return null;
end $$;
create trigger notify_payment after insert on public.ledger_entries
  for each row execute function private.notify_payment();

-- Someone asked to join (role chosen) → admins.
create or replace function private.notify_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' and new.requested_role is not null
     and (tg_op = 'INSERT' or old.requested_role is null) then
    perform private.notify(private.admin_ids(), 'account',
      'New account to approve',
      coalesce(new.full_name, new.email, 'Someone') || ' · ' || new.requested_role::text, '/approvals');
  end if;
  return null;
end $$;
create trigger notify_account after insert or update of requested_role on public.profiles
  for each row execute function private.notify_account();

-- Messages: treasurer → admins; admin → that org's treasurer (or every treasurer for a broadcast).
create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare s record; org text;
begin
  select role, entity_id, full_name into s from public.profiles where id = new.sender_id;
  if s.role = 'treasurer' then
    select short_name into org from public.entities where id = new.entity_id;
    perform private.notify(private.admin_ids(), 'message', 'Message from ' || coalesce(org, 'a treasurer'),
      left(new.body, 120), '/messages/' || new.entity_id, 'msg:' || new.entity_id);
  elsif s.role = 'admin' then
    perform private.notify(private.treasurer_ids(new.entity_id), 'message',
      case when new.entity_id is null then 'SAS sent everyone a message' else 'Message from SAS' end,
      left(new.body, 120), case when new.entity_id is null then '/messages' else '/messages/' || new.entity_id end,
      'msg:' || coalesce(new.entity_id::text, 'all'));
  end if;
  return null;
end $$;
create trigger notify_message after insert on public.messages
  for each row execute function private.notify_message();

-- Mark all of mine read.
create or replace function private.mark_notifications_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.notifications set read_at = now() where recipient = (select auth.uid()) and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
create function public.mark_notifications_read()
returns integer language sql volatile security invoker set search_path = '' as $$
  select private.mark_notifications_read()
$$;

revoke all on function private.notify(uuid[], text, text, text, text, text, numeric), private.admin_ids(),
  private.treasurer_ids(bigint), private.notify_request(), private.notify_payment(), private.notify_account(),
  private.notify_message(), private.mark_notifications_read(), private.peso(numeric) from public, anon;
grant execute on function private.mark_notifications_read() to authenticated;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;
