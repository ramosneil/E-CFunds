-- Phase 5: Student ID sign-in (business-rules §4.6). The server function `student-login` turns a Student ID into
-- the approved student's email on the server, then signs in with the password. These two functions are callable
-- ONLY by service_role (the function), never by the browser. Lockout: 5 failed tries per Student ID in 15 minutes.

create table private.login_attempts (
  id         bigint generated always as identity primary key,
  student_no text not null,
  ok         boolean not null,
  at         timestamptz not null default now()
);
create index login_attempts_student_no_at_idx on private.login_attempts (student_no, at);
alter table private.login_attempts enable row level security;   -- no policies: no direct access for anyone
revoke all on private.login_attempts from public, anon, authenticated;

create or replace function public.student_login_lookup(p_student_no text)
returns table (email text, locked_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select
    (select p.email
       from public.students s
       join public.profiles p on p.student_id = s.id
      where s.student_no = trim(p_student_no)
        and p.status = 'approved' and p.role = 'student'
      limit 1),
    (select max(a.at) + interval '15 minutes'
       from (select at from private.login_attempts
              where student_no = trim(p_student_no) and not ok and at > now() - interval '15 minutes'
              order by at desc limit 5) a
     having count(*) >= 5)
$$;

create or replace function public.student_login_record(p_student_no text, p_ok boolean)
returns void
language sql volatile security definer set search_path = '' as $$
  insert into private.login_attempts (student_no, ok) values (left(trim(p_student_no), 30), p_ok)
$$;

revoke all on function public.student_login_lookup(text) from public, anon, authenticated;
revoke all on function public.student_login_record(text, boolean) from public, anon, authenticated;
grant execute on function public.student_login_lookup(text) to service_role;
grant execute on function public.student_login_record(text, boolean) to service_role;
