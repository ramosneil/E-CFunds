-- Phase 5 (Neil, 2026-11-13): Student IDs are cleaned the same way everywhere — spaces removed, letters upper-cased —
-- so "test -0001" and "TEST-0001" are the same ID. Covers the roster, sign-up requests and Student ID sign-in.

create or replace function private.norm_student_no(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(upper(regexp_replace(coalesce(t, ''), '\s+', '', 'g')), '')
$$;
grant execute on function private.norm_student_no(text) to authenticated, service_role;

-- Roster rows: cleaned on every insert/update (the length check then applies to the cleaned ID).
create or replace function private.students_norm()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.student_no := private.norm_student_no(new.student_no);
  return new;
end $$;
create trigger students_norm before insert or update of student_no on public.students
  for each row execute function private.students_norm();

-- Sign-up / pending requests: cleaned whether they come from sign-up metadata or set_my_request.
create or replace function private.profiles_norm()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.requested_student_no := private.norm_student_no(new.requested_student_no);
  return new;
end $$;
create trigger profiles_norm before insert or update of requested_student_no on public.profiles
  for each row execute function private.profiles_norm();

-- Student ID sign-in: look up and record by the cleaned ID.
create or replace function public.student_login_lookup(p_student_no text)
returns table (email text, locked_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    (select p.email
       from public.students s
       join public.profiles p on p.student_id = s.id
      where s.student_no = private.norm_student_no(p_student_no)
        and p.status = 'approved' and p.role = 'student'
      limit 1),
    (select max(a.at) + interval '15 minutes'
       from (select at from private.login_attempts
              where student_no = private.norm_student_no(p_student_no) and not ok
                and at > now() - interval '15 minutes'
              order by at desc limit 5) a
     having count(*) >= 5)
$$;

create or replace function public.student_login_record(p_student_no text, p_ok boolean)
returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.login_attempts (student_no, ok)
  values (left(coalesce(private.norm_student_no(p_student_no), '?'), 30), p_ok)
$$;

-- Clean what is already stored (the triggers above do the work).
update public.students set student_no = student_no where student_no is distinct from private.norm_student_no(student_no);
update public.profiles set requested_student_no = requested_student_no
 where requested_student_no is distinct from private.norm_student_no(requested_student_no);
update private.login_attempts set student_no = coalesce(private.norm_student_no(student_no), '?')
 where student_no is distinct from private.norm_student_no(student_no);
