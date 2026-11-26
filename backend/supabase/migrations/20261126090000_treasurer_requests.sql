-- Account requests (Neil, 2026-11-26):
--  • An org/club that already has an approved treasurer can't be chosen when someone asks to be its treasurer
--    (the sign-up list hides it; this refuses it too). review_account already blocks approving a second one.
--  • Treasurers are students too: asking to be a treasurer needs a Student ID that is on SAS's student list, so SAS
--    sees their name, course, year and section in Approvals. Students' IDs are still checked when SAS approves.
--  • Student IDs are stored cleaned (private.norm_student_no, like the imports) so Approvals finds them on the list.

-- Which orgs/clubs already have an approved treasurer (ids only — no names), for the sign-up list.
create or replace function public.entities_with_treasurer()
 returns setof bigint
 language sql
 stable security definer
 set search_path to ''
as $$
  select distinct entity_id from public.profiles
   where role = 'treasurer' and status = 'approved' and entity_id is not null
$$;
revoke all on function public.entities_with_treasurer() from public, anon;
grant execute on function public.entities_with_treasurer() to authenticated;

create or replace function private.set_my_request(p_role app_role, p_entity_id bigint default null, p_student_no text default null, p_full_name text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  me uuid := (select auth.uid());
  st public.account_status;
  v_no text := private.norm_student_no(p_student_no);
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select status into st from public.profiles where id = me for update;
  if st is null then raise exception 'Account not found.'; end if;
  if st <> 'pending' then raise exception 'Your account has already been reviewed.'; end if;
  if p_role is null or p_role = 'admin' then raise exception 'Choose Student or Treasurer.'; end if;
  if length(coalesce(v_no, '')) not between 3 and 30 then
    raise exception 'Enter your student ID (3 to 30 characters).';
  end if;
  if p_role = 'treasurer' then
    if not exists (select 1 from public.entities where id = p_entity_id and is_active) then
      raise exception 'Choose your organization or club.';
    end if;
    if exists (select 1 from public.profiles where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id and id <> me) then
      raise exception 'This organization or club already has a treasurer. If that has changed, ask SAS.';
    end if;
    if not exists (select 1 from public.students where student_no = v_no) then
      raise exception 'Student ID % is not on the student list. Check it, or ask SAS to add you.', v_no;
    end if;
  end if;

  update public.profiles
     set requested_role       = p_role,
         requested_entity_id  = case when p_role = 'treasurer' then p_entity_id end,
         requested_student_no = v_no,
         full_name            = coalesce(nullif(left(trim(p_full_name), 200), ''), full_name)
   where id = me;
end $$;
