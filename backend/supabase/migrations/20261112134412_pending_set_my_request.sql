-- Phase 5: a PENDING user can state (or fix) what they are asking for after signing in.
-- Why: sign-up metadata is the only other way to set requested_*; Google sign-ups carry none, and the
-- org/club list is readable only once signed in. Approval still happens only in review_account (admin).

create or replace function private.set_my_request(p_role public.app_role, p_entity_id bigint default null,
  p_student_no text default null, p_full_name text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  st public.account_status;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select status into st from public.profiles where id = me for update;
  if st is null then raise exception 'Account not found.'; end if;
  if st <> 'pending' then raise exception 'Your account has already been reviewed.'; end if;
  if p_role is null or p_role = 'admin' then raise exception 'Choose Student or Treasurer.'; end if;
  if p_role = 'treasurer' and not exists (select 1 from public.entities where id = p_entity_id and is_active) then
    raise exception 'Choose your organization or club.';
  end if;
  if p_role = 'student' and length(coalesce(trim(p_student_no), '')) not between 3 and 30 then
    raise exception 'Enter your student ID (3 to 30 characters).';
  end if;

  update public.profiles
     set requested_role       = p_role,
         requested_entity_id  = case when p_role = 'treasurer' then p_entity_id end,
         requested_student_no = case when p_role = 'student' then trim(p_student_no) end,
         full_name            = coalesce(nullif(left(trim(p_full_name), 200), ''), full_name)
   where id = me;
end $$;

create function public.set_my_request(p_role public.app_role, p_entity_id bigint default null,
  p_student_no text default null, p_full_name text default null)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.set_my_request(p_role, p_entity_id, p_student_no, p_full_name)
$$;

revoke all on function private.set_my_request(public.app_role, bigint, text, text) from public, anon;
revoke all on function public.set_my_request(public.app_role, bigint, text, text) from public, anon;
grant execute on function private.set_my_request(public.app_role, bigint, text, text) to authenticated;
grant execute on function public.set_my_request(public.app_role, bigint, text, text) to authenticated;
