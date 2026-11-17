-- Fixes from the full system check (docs/audit-2026-11-17.md), Neil: "fix all".
--  #1 Only SAS edits student records directly. Treasurers had UPDATE on any student who is a member of their org —
--     the SSG treasurer (every student is in SSG) could change anyone's Student ID, name or active status.
--     Treasurers still set year/section through add_member / import_members (checked functions).
--  #2 SAS can save a student's section (the new column had no UPDATE grant).
--  #7 Treasurers can no longer edit fees or delete/insert memberships directly (bypassing the app): fees change only
--     through set_entity_dues, members are added through add_member / import (1 club per semester etc. checked).
--  #4 review_account: plain messages instead of raw database errors (2nd treasurer, student not on the list).
--  Reopen school year (SAS): undoes a close, with a reason kept in year_reopenings; re-enables the treasurer whom
--     the close disabled (if the org has no other active treasurer) and tells them.

-- #1 / #2 students
drop policy "admin or own-member treasurer edits student" on public.students;
create policy "SAS edits students" on public.students for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy "admin or club treasurer adds roster students" on public.students;
create policy "SAS adds students" on public.students for insert to authenticated with check ((select private.is_admin()));
grant update (section) on public.students to authenticated;

-- #7 memberships: only through functions (SAS keeps direct access for corrections)
drop policy "admin or club treasurer adds unpaid memberships" on public.memberships;
create policy "SAS adds unpaid memberships" on public.memberships for insert to authenticated
  with check (not is_paid and collection_entry_id is null and (select private.is_admin()));
drop policy "staff edit amount of unpaid memberships" on public.memberships;
create policy "SAS edits amount of unpaid memberships" on public.memberships for update to authenticated
  using (not is_paid and (select private.is_admin())) with check (not is_paid and (select private.is_admin()));
drop policy "staff remove unpaid memberships" on public.memberships;
create policy "SAS removes unpaid memberships" on public.memberships for delete to authenticated
  using (not is_paid and (select private.is_admin()));

-- #4 review_account with plain messages
create or replace function private.review_account(p_profile_id uuid, p_approve boolean, p_role public.app_role default null,
  p_entity_id bigint default null, p_student_id bigint default null, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare other text;
begin
  perform private.require_admin();
  if p_profile_id = (select auth.uid()) then raise exception 'You cannot review your own account.'; end if;
  if not p_approve then
    update public.profiles set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
           review_remarks = p_remarks
     where id = p_profile_id;
    return;
  end if;
  if p_role is null then raise exception 'Choose the role to approve.'; end if;
  if p_role = 'treasurer' then
    if p_entity_id is null then raise exception 'Choose the organization or club.'; end if;
    select coalesce(full_name, email) into other from public.profiles
     where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id and id <> p_profile_id limit 1;
    if other is not null then
      raise exception 'This org/club already has an active treasurer (%). Disable that account first (Approvals → Accounts).', other;
    end if;
  end if;
  if p_role = 'student' and p_student_id is null then
    raise exception 'This Student ID is not on the student list yet. Add it first, then approve.';
  end if;
  update public.profiles
     set status = 'approved', role = p_role,
         entity_id  = case when p_role = 'treasurer' then p_entity_id end,
         student_id = case when p_role = 'student' then p_student_id end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_remarks = p_remarks
   where id = p_profile_id;
  if not found then raise exception 'Account not found.'; end if;
end $$;

-- Reopen a closed school year
create table public.year_reopenings (
  id bigint generated always as identity primary key,
  entity_id bigint not null references public.entities(id) on delete cascade,
  school_year_id bigint not null references public.school_years(id) on delete cascade,
  closing_total numeric(12,2),
  reason text not null,
  reopened_by uuid references public.profiles(id),
  reopened_at timestamptz not null default now()
);
alter table public.year_reopenings enable row level security;
create policy "SAS reads reopenings" on public.year_reopenings for select to authenticated using ((select private.is_admin()));
grant select on public.year_reopenings to authenticated;
create trigger audit_year_reopenings after insert or update or delete on public.year_reopenings for each row execute function private.audit_row();

create or replace function private.reopen_school_year(p_entity_id bigint, p_school_year_id bigint, p_reason text)
returns text language plpgsql security definer set search_path = '' as $$
declare c record; t record; result text := 'Reopened.';
begin
  perform private.require_admin();
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Say why the school year is reopened.'; end if;
  perform private.lock_entity(p_entity_id);
  select * into c from public.year_closures where entity_id = p_entity_id and school_year_id = p_school_year_id;
  if c.entity_id is null then raise exception 'This school year is not closed for this org/club.'; end if;
  insert into public.year_reopenings (entity_id, school_year_id, closing_total, reason, reopened_by)
  values (p_entity_id, p_school_year_id, c.closing_total, trim(p_reason), (select auth.uid()));
  delete from public.year_closures where entity_id = p_entity_id and school_year_id = p_school_year_id;

  -- Give the treasurer back their account if the close disabled them and nobody else holds the seat.
  if not exists (select 1 from public.profiles where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id) then
    select id, coalesce(full_name, email) as name into t from public.profiles
     where role = 'treasurer' and status = 'disabled' and entity_id = p_entity_id
       and review_remarks = 'Term ended — school year closed'
     order by reviewed_at desc nulls last limit 1;
    if t.id is not null then
      update public.profiles set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(),
             review_remarks = 'School year reopened: ' || trim(p_reason)
       where id = t.id;
      perform private.notify(array[t.id], 'account_decision', 'Your treasurer account is active again',
        'SAS reopened the school year: ' || left(trim(p_reason), 80), '/');
      result := 'Reopened. ' || t.name || '''s treasurer account is active again.';
    end if;
  end if;
  return result;
end $$;
create or replace function public.reopen_school_year(p_entity_id bigint, p_school_year_id bigint, p_reason text)
returns text language sql volatile security invoker set search_path = '' as $$ select private.reopen_school_year(p_entity_id, p_school_year_id, p_reason) $$;
revoke all on function private.reopen_school_year(bigint, bigint, text), public.reopen_school_year(bigint, bigint, text) from public, anon;
grant execute on function private.reopen_school_year(bigint, bigint, text), public.reopen_school_year(bigint, bigint, text) to authenticated;
