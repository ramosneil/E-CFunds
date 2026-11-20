-- First SAS admin without any shared password: an email on this private list becomes admin
-- automatically the moment that email is VERIFIED (Google sign-in or the confirmation link).
-- The list itself is data (set with SQL by the project owner), never committed to git.
-- One-time: the email is removed from the list once used.

create table private.bootstrap_admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
revoke all on private.bootstrap_admins from public, anon, authenticated;

create or replace function private.promote_bootstrap_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from private.bootstrap_admins b where b.email = lower(new.email)) then
    update public.profiles
       set status = 'approved', role = 'admin', entity_id = null, student_id = null,
           reviewed_at = now(), review_remarks = 'Bootstrap admin (verified email on the private list)'
     where id = new.id;
    delete from private.bootstrap_admins where email = lower(new.email);
  end if;
  return null;
end $$;
revoke all on function private.promote_bootstrap_admin() from public, anon, authenticated;

-- Fires after on_auth_user_created (trigger names run in alphabetical order), so the profile exists.
create trigger on_auth_user_verified_bootstrap_admin
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.promote_bootstrap_admin();
