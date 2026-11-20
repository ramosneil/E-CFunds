-- Access helpers + Row-Level Security. Who-can-see-what: docs/business-rules.md §3.
-- Authorization ALWAYS comes from public.profiles (status = approved), never from user_metadata.

-- ---------- Helper functions (private schema, not exposed by the Data API) ----------
create or replace function private.my_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'approved'
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) = 'admin', false)
$$;

create or replace function private.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.my_role()) is not null
$$;

create or replace function private.my_entity_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select p.entity_id from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'approved' and p.role = 'treasurer'
$$;

create or replace function private.my_student_id()
returns bigint language sql stable security definer set search_path = '' as $$
  select p.student_id from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'approved' and p.role = 'student'
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_role(), private.is_admin(), private.is_approved(),
  private.my_entity_id(), private.my_student_id() to authenticated;

-- ---------- Sign-up: create a pending profile for every new auth user ----------
-- user_metadata only carries what the person ASKED for; an admin decides (review_account).
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  req_role public.app_role;
begin
  begin
    req_role := nullif(meta ->> 'requested_role', '')::public.app_role;
  exception when invalid_text_representation then
    req_role := null;
  end;
  if req_role = 'admin' then req_role := null; end if;   -- nobody can ask to be admin

  insert into public.profiles (id, email, full_name, requested_role, requested_entity_id, requested_student_no)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'full_name', meta ->> 'name'), 200),
    req_role,
    case when req_role = 'treasurer' and (meta ->> 'requested_entity_id') ~ '^\d{1,18}$'
         then (meta ->> 'requested_entity_id')::bigint end,
    case when req_role = 'student' then left(meta ->> 'student_no', 30) end
  );
  return new;
end $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- Table privileges: start from nothing, grant only what each role needs ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

grant usage on schema public to authenticated;
grant select on public.school_years, public.semesters, public.entities, public.students,
  public.profiles, public.memberships, public.ledger_entries, public.fund_requests,
  public.year_closures, public.messages, public.accredited_entries, public.accredited_history,
  public.accredited_list to authenticated;
grant insert, update on public.school_years, public.semesters, public.entities,
  public.accredited_entries to authenticated;               -- admin-only by policy
grant insert, update (student_no, full_name, course, year_level, email, is_active)
  on public.students to authenticated;
grant insert on public.memberships to authenticated;
grant update (amount_due) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;          -- unpaid only, by policy
grant insert, delete on public.messages to authenticated;
grant delete on public.accredited_entries to authenticated;  -- admin-only by policy
-- ledger_entries, fund_requests, year_closures, profiles: written ONLY by the RPCs in the next migration.

-- ---------- RLS on every table ----------
alter table public.school_years       enable row level security;
alter table public.semesters          enable row level security;
alter table public.entities           enable row level security;
alter table public.students           enable row level security;
alter table public.profiles           enable row level security;
alter table public.memberships        enable row level security;
alter table public.ledger_entries     enable row level security;
alter table public.fund_requests      enable row level security;
alter table public.year_closures      enable row level security;
alter table public.messages           enable row level security;
alter table public.accredited_entries enable row level security;
alter table public.accredited_history enable row level security;

-- Calendar + entities: every approved user reads; admin writes.
create policy "approved users read school years" on public.school_years
  for select to authenticated using ((select private.is_approved()));
create policy "admin writes school years" on public.school_years
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates school years" on public.school_years
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "approved users read semesters" on public.semesters
  for select to authenticated using ((select private.is_approved()));
create policy "admin writes semesters" on public.semesters
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates semesters" on public.semesters
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Entities are also visible to signed-in PENDING users so the sign-up form can list them.
create policy "signed-in users read entities" on public.entities
  for select to authenticated using (true);
create policy "admin writes entities" on public.entities
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin updates entities" on public.entities
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- Students (roster): admin + treasurers read all (to add members); a student reads only self.
create policy "staff read roster, student reads self" on public.students
  for select to authenticated using (
    (select private.is_admin())
    or (select private.my_entity_id()) is not null
    or id = (select private.my_student_id()));
create policy "staff add roster students" on public.students
  for insert to authenticated with check (
    (select private.is_admin()) or (select private.my_entity_id()) is not null);
create policy "admin or own-member treasurer edits student" on public.students
  for update to authenticated
  using ((select private.is_admin()) or exists (
    select 1 from public.memberships m
    where m.student_id = students.id and m.entity_id = (select private.my_entity_id())))
  with check ((select private.is_admin()) or exists (
    select 1 from public.memberships m
    where m.student_id = students.id and m.entity_id = (select private.my_entity_id())));

-- Profiles: you read yours; admin reads all. Changes go through review_account() only.
create policy "read own profile, admin reads all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));

-- Memberships: admin all; treasurer own entity; student own rows (own dues status).
create policy "read memberships" on public.memberships
  for select to authenticated using (
    (select private.is_admin())
    or entity_id = (select private.my_entity_id())
    or student_id = (select private.my_student_id()));
create policy "staff add unpaid memberships" on public.memberships
  for insert to authenticated with check (
    not is_paid and collection_entry_id is null
    and ((select private.is_admin()) or entity_id = (select private.my_entity_id())));
create policy "staff edit amount of unpaid memberships" on public.memberships
  for update to authenticated
  using (not is_paid and ((select private.is_admin()) or entity_id = (select private.my_entity_id())))
  with check (not is_paid and ((select private.is_admin()) or entity_id = (select private.my_entity_id())));
create policy "staff remove unpaid memberships" on public.memberships
  for delete to authenticated
  using (not is_paid and ((select private.is_admin()) or entity_id = (select private.my_entity_id())));

-- Ledger, requests, closures: admin all; treasurer own entity. Students: NO row access
-- (they get aggregates only, through get_entity_report()).
create policy "staff read ledger" on public.ledger_entries
  for select to authenticated using (
    (select private.is_admin()) or entity_id = (select private.my_entity_id()));
create policy "staff read requests" on public.fund_requests
  for select to authenticated using (
    (select private.is_admin()) or entity_id = (select private.my_entity_id()));
create policy "staff read closures" on public.year_closures
  for select to authenticated using (
    (select private.is_admin()) or entity_id = (select private.my_entity_id()));

-- Messages: treasurer <-> SAS per entity; broadcasts (entity_id null) from admin to all treasurers.
create policy "read messages" on public.messages
  for select to authenticated using (
    (select private.is_admin())
    or ((select private.my_entity_id()) is not null
        and (entity_id = (select private.my_entity_id()) or entity_id is null)));
create policy "send messages" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and read_at is null
    and ((select private.is_admin())
         or (entity_id is not null and entity_id = (select private.my_entity_id()))));
create policy "delete own messages, admin deletes any" on public.messages
  for delete to authenticated using (
    sender_id = (select auth.uid()) or (select private.is_admin()));

-- Accredited list: every approved user reads; admin writes; history admin-only.
create policy "approved users read accredited list" on public.accredited_entries
  for select to authenticated using ((select private.is_approved()));
create policy "admin adds accredited" on public.accredited_entries
  for insert to authenticated with check ((select private.is_admin()));
create policy "admin edits accredited" on public.accredited_entries
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admin deletes accredited" on public.accredited_entries
  for delete to authenticated using ((select private.is_admin()));
create policy "admin reads accredited history" on public.accredited_history
  for select to authenticated using ((select private.is_admin()));
