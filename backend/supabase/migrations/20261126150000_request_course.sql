-- Sign-up also asks for the Course (Neil, 2026-11-26): BSIT, BEED, BSBA OM, BSBA FM (the courses table), students and
-- treasurers. Kept on the request and compared with the student list in Approvals, like year/section (migration 49).
alter table public.profiles
  add column requested_course text references public.courses (code) on update cascade on delete set null;

drop function public.set_my_request(app_role, bigint, text, text, smallint, text);
drop function private.set_my_request(app_role, bigint, text, text, smallint, text);

create function private.set_my_request(p_role app_role, p_entity_id bigint default null, p_student_no text default null,
  p_full_name text default null, p_year_level smallint default null, p_section text default null, p_course text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  me uuid := (select auth.uid());
  st public.account_status;
  v_no text := private.norm_student_no(p_student_no);
  v_sec text := nullif(upper(btrim(coalesce(p_section, ''))), '');
  v_course text := nullif(upper(regexp_replace(btrim(coalesce(p_course, '')), '\s+', ' ', 'g')), '');
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select status into st from public.profiles where id = me for update;
  if st is null then raise exception 'Account not found.'; end if;
  if st <> 'pending' then raise exception 'Your account has already been reviewed.'; end if;
  if p_role is null or p_role = 'admin' then raise exception 'Choose Student or Treasurer.'; end if;
  if length(coalesce(v_no, '')) not between 3 and 30 then
    raise exception 'Enter your student ID (3 to 30 characters).';
  end if;
  if v_course is null or not exists (select 1 from public.courses where code = v_course) then
    raise exception 'Choose your course.';
  end if;
  if p_year_level is null or p_year_level not between 1 and 4 then raise exception 'Choose your year level (1 to 4).'; end if;
  if v_sec is null or v_sec !~ '^[A-E]$' then raise exception 'Choose your section (A to E).'; end if;
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
         requested_course     = v_course,
         requested_year_level = p_year_level,
         requested_section    = v_sec,
         full_name            = coalesce(nullif(left(trim(p_full_name), 200), ''), full_name)
   where id = me;
end $$;

create function public.set_my_request(p_role app_role, p_entity_id bigint default null, p_student_no text default null,
  p_full_name text default null, p_year_level smallint default null, p_section text default null, p_course text default null)
 returns void
 language sql
 set search_path to ''
as $$
  select private.set_my_request(p_role, p_entity_id, p_student_no, p_full_name, p_year_level, p_section, p_course)
$$;

revoke all on function private.set_my_request(app_role, bigint, text, text, smallint, text, text) from public, anon;
grant execute on function private.set_my_request(app_role, bigint, text, text, smallint, text, text) to authenticated;
revoke all on function public.set_my_request(app_role, bigint, text, text, smallint, text, text) from public, anon;
grant execute on function public.set_my_request(app_role, bigint, text, text, smallint, text, text) to authenticated, service_role;
