-- Notifications (Neil, 2026-11-19): everyone can delete their own notifications (one, or all), and each new
-- notification links to the exact thing it is about instead of a general page.
grant delete on public.notifications to authenticated;
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (recipient = (select auth.uid()));

create or replace function private.clear_notifications() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  delete from public.notifications where recipient = (select auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function public.clear_notifications() returns integer
language sql volatile security invoker set search_path = '' as $$ select private.clear_notifications() $$;
revoke all on function private.clear_notifications(), public.clear_notifications() from public, anon;
grant execute on function private.clear_notifications(), public.clear_notifications() to authenticated;

-- ── Exact links ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.notify_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' and new.requested_role is not null
     and (tg_op = 'INSERT' or old.requested_role is null) then
    perform private.notify(private.admin_ids(), 'account',
      'New account to approve',
      coalesce(new.full_name, new.email, 'Someone') || ' · ' || new.requested_role::text,
      '/approvals?tab=accounts&user=' || new.id);
  end if;
  return null;
end $$;

create or replace function private.notify_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org text; what text;
begin
  select short_name into org from public.entities where id = new.entity_id;
  what := case new.kind when 'remittance' then 'remittance' when 'release' then 'release request' else 'expense' end;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(private.admin_ids(), 'request',
      org || ' filed a ' || what, private.peso(new.amount) || coalesce(' · ' || left(new.description, 80), ''),
      '/approvals?request=' || new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision',
      'SAS ' || new.status::text || ' your ' || what,
      private.peso(new.amount) || coalesce(' · ' || left(new.remarks, 80), ''), '/requests?id=' || new.id);
  end if;
  return null;
end $$;

create or replace function private.notify_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org text; m record;
begin
  if new.kind <> 'collection' then return null; end if;
  select short_name into org from public.entities where id = new.entity_id;
  perform private.notify(private.admin_ids(), 'payment',
    org || ' recorded a dues payment', private.peso(new.amount) || coalesce(' · ' || new.description, ''),
    '/orgs/' || new.entity_id, 'payment:' || new.entity_id, new.amount);
  select student_id, semester_id into m from public.memberships where id = new.membership_id;
  if m.student_id is not null then
    -- the receipt number is issued right after this entry, so link to "the receipt of this membership"
    perform private.notify(private.student_account(m.student_id), 'receipt',
      org || ' recorded your ' || private.peso(new.amount) || ' payment',
      coalesce(private.sem_label(coalesce(new.semester_id, m.semester_id)), 'this school year') || ' · thank you!',
      '/receipt/m/' || new.membership_id);
  end if;
  return null;
end $$;
