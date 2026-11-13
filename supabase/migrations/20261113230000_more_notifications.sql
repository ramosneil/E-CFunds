-- Notifications for students and treasurers too (Neil, 2026-11-13).
-- Students: payment recorded (receipt), new fees to pay, account approved/rejected, SAS announcements, app updates.
-- Treasurers: new members to collect, account approved/rejected, semester started, fee changed by SAS, app updates.
-- Builds on migration 19 (private.notify, Realtime, bell, pop-up). A student is reached only through an approved
-- account linked to their roster entry (profiles.student_id).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'request','request_decision','payment','account','message',
  'receipt','fees','account_decision','announcement','members','semester','fee_change','app_update'));

-- notify(): optional p_append — when merging, add p_body to the existing body ("SSG" → "SSG, PADC, LSC").
drop function private.notify(uuid[], text, text, text, text, text, numeric);
create function private.notify(p_recipients uuid[], p_kind text, p_title text, p_body text, p_link text,
                               p_group text default null, p_amount numeric default null, p_append boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  foreach r in array coalesce(p_recipients, '{}') loop
    if r is null then continue; end if;
    if p_group is not null then
      update public.notifications n
         set count = n.count + 1, amount = coalesce(n.amount, 0) + coalesce(p_amount, 0), updated_at = now(),
             body = case when p_append and p_body is not null then left(coalesce(n.body || ', ', '') || p_body, 300) else n.body end
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
revoke all on function private.notify(uuid[], text, text, text, text, text, numeric, boolean) from public, anon;

-- The approved student account linked to a roster student (or nobody).
create or replace function private.student_account(p_student bigint)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(id), '{}') from public.profiles
   where student_id = p_student and role = 'student' and status = 'approved'
$$;
create or replace function private.sem_label(p_sem bigint)
returns text language sql stable security definer set search_path = '' as $$
  select case s.term when 1 then '1st semester' when 2 then '2nd semester' else 'semester ' || s.term end
    from public.semesters s where s.id = p_sem
$$;

-- ---------- 1. Payment recorded → the student's receipt (the admin notice from migration 19 stays) ----------
create or replace function private.notify_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text; m record;
begin
  if new.kind <> 'collection' then return null; end if;
  select short_name into org from public.entities where id = new.entity_id;
  perform private.notify(private.admin_ids(), 'payment',
    org || ' recorded a dues payment', private.peso(new.amount) || coalesce(' · ' || new.description, ''),
    '/orgs/' || new.entity_id, 'payment:' || new.entity_id, new.amount);
  select student_id, semester_id into m from public.memberships where id = new.membership_id;
  if m.student_id is not null then
    perform private.notify(private.student_account(m.student_id), 'receipt',
      org || ' recorded your ' || private.peso(new.amount) || ' payment',
      coalesce(private.sem_label(coalesce(new.semester_id, m.semester_id)), 'this school year') || ' · thank you!', '/');
  end if;
  return null;
end $$;

-- ---------- 2. Automatic (unpaid) membership → student "fees to pay" + that org's treasurer "members to collect" ----
create or replace function private.notify_new_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text; sem text;
begin
  if new.is_paid or not (new.via_course or new.carried_over) then return null; end if;
  -- The treasurer adding the student right now pays their own org at once ("Add & record") — no fee/collect notice.
  if new.entity_id = (select private.my_entity_id()) then return null; end if;
  select short_name into org from public.entities where id = new.entity_id;
  sem := coalesce(new.semester_id::text, 'y' || new.school_year_id);
  perform private.notify(private.student_account(new.student_id), 'fees',
    'New fees to pay', org, '/', 'fees:' || new.student_id || ':' || sem, new.amount_due, true);
  perform private.notify(private.treasurer_ids(new.entity_id), 'members',
    'New member to collect', null, '/members', 'members:' || new.entity_id || ':' || sem, new.amount_due);
  return null;
end $$;
create trigger notify_new_membership after insert on public.memberships
  for each row execute function private.notify_new_membership();

-- ---------- 3. Account approved / rejected → that person ----------
create or replace function private.notify_account_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text;
begin
  if old.status <> 'pending' or new.status not in ('approved', 'rejected') then return null; end if;
  if new.status = 'approved' then
    select short_name into org from public.entities where id = new.entity_id;
    perform private.notify(array[new.id], 'account_decision', 'SAS approved your account',
      case new.role when 'treasurer' then 'Treasurer · ' || coalesce(org, '') when 'admin' then 'SAS admin' else 'Student' end
      || ' — welcome to E-CFunds!', '/');
  else
    perform private.notify(array[new.id], 'account_decision', 'SAS did not approve your account',
      coalesce(new.review_remarks, 'Visit the Office of Student Affairs for details.'), '/');
  end if;
  return null;
end $$;
create trigger notify_account_decision after update of status on public.profiles
  for each row execute function private.notify_account_decision();

-- ---------- 4. Semester started → every treasurer ----------
create or replace function private.notify_semester()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.is_current then return null; end if;
  perform private.notify(private.treasurer_ids(null), 'semester',
    'SAS started the ' || private.sem_label(new.id),
    'Members were re-listed to collect. Check that your fee is right for this semester.', '/members',
    'semester:' || new.id);
  return null;
end $$;
create trigger notify_semester after insert or update of is_current on public.semesters
  for each row when (new.is_current) execute function private.notify_semester();

-- ---------- 5. Fee changed by SAS → that org/club's treasurer ----------
create or replace function private.notify_fee_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dues_amount is not distinct from old.dues_amount and new.dues_period is not distinct from old.dues_period then
    return null;
  end if;
  if (select private.my_entity_id()) is not distinct from new.id then return null; end if;   -- the treasurer did it
  perform private.notify(private.treasurer_ids(new.id), 'fee_change',
    'SAS set your fee to ' || private.peso(new.dues_amount) || case new.dues_period when 'semester' then ' per semester' else ' per school year' end,
    'New members are listed at this amount.', '/members');
  return null;
end $$;
create trigger notify_fee_change after update of dues_amount, dues_period on public.entities
  for each row execute function private.notify_fee_change();

-- ---------- 6. SAS announcement (admin only) ----------
create or replace function private.announce(p_audience text, p_title text, p_body text)
returns integer language plpgsql security definer set search_path = '' as $$
declare ids uuid[];
begin
  if not coalesce((select private.is_admin()), false) then raise exception 'Only SAS can send announcements.' using errcode = '42501'; end if;
  if p_audience not in ('students', 'treasurers', 'everyone') then raise exception 'Choose who should receive it.'; end if;
  if coalesce(btrim(p_title), '') = '' then raise exception 'Write a title.'; end if;
  select coalesce(array_agg(id), '{}') into ids from public.profiles
   where status = 'approved' and id <> (select auth.uid())
     and (p_audience = 'everyone' or (p_audience = 'students' and role = 'student') or (p_audience = 'treasurers' and role = 'treasurer'));
  perform private.notify(ids, 'announcement', left(btrim(p_title), 120), left(btrim(p_body), 500), '/');
  return coalesce(array_length(ids, 1), 0);
end $$;
create function public.announce(p_audience text, p_title text, p_body text)
returns integer language sql volatile security invoker set search_path = '' as $$
  select private.announce(p_audience, p_title, p_body)
$$;

-- ---------- 7. App updated → a bell entry for the person (once per version) ----------
create or replace function private.note_app_updated(p_build text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); k text := 'app:' || left(coalesce(p_build, ''), 40);
begin
  if me is null or coalesce(p_build, '') = '' then return; end if;
  if exists (select 1 from public.notifications where recipient = me and group_key = k) then return; end if;
  insert into public.notifications (recipient, kind, title, body, link, group_key, read_at)
  values (me, 'app_update', 'E-CFunds was updated', 'You have the newest version.', null, k, now());
end $$;
create function public.note_app_updated(p_build text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.note_app_updated(p_build)
$$;

revoke all on function private.student_account(bigint), private.sem_label(bigint), private.notify_new_membership(),
  private.notify_account_decision(), private.notify_semester(), private.notify_fee_change(),
  private.announce(text, text, text), private.note_app_updated(text) from public, anon;
grant execute on function private.announce(text, text, text), private.note_app_updated(text) to authenticated;
revoke all on function public.announce(text, text, text), public.note_app_updated(text) from public, anon;
grant execute on function public.announce(text, text, text), public.note_app_updated(text) to authenticated;
