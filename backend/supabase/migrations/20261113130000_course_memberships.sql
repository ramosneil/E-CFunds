-- Course-based automatic memberships (Neil, 2026-11-13). Organizations are MANDATORY by course:
--   BSIT    -> SSG, PADC, LSC        BEED    -> SSG, YMO, LSC
--   BSBA OM -> SSG, LSC, JOES        BSBA FM -> SSG, LSC, JFMS        any other course -> SSG only
-- SSG (school-wide) = every student on the roster. Whoever adds the student (any org/club treasurer or SAS), the
-- student is enrolled in SSG + the course organizations for the CURRENT school year (and current semester for
-- per-semester orgs), Unpaid, at each org's own dues. Each org collects its own dues (record_payment, unchanged).
-- Clubs stay voluntary: max 1 club per year. Other courses: max 1 organization, added by hand (old rule).

-- ---------- Rule tables ----------
create table public.courses (
  code      text primary key check (code = upper(btrim(code)) and length(code) between 2 and 20),
  name      text not null,
  sort      smallint not null default 0
);
create table public.course_orgs (
  course    text not null references public.courses (code) on update cascade on delete cascade,
  entity_id bigint not null references public.entities (id),
  primary key (course, entity_id)
);
create index course_orgs_entity_id_idx on public.course_orgs (entity_id);

alter table public.courses     enable row level security;
alter table public.course_orgs enable row level security;
grant select on public.courses, public.course_orgs to authenticated;
grant insert, update, delete on public.courses, public.course_orgs to authenticated;
create policy "everyone signed in reads courses" on public.courses for select to authenticated using (true);
create policy "admin changes courses" on public.courses for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "everyone signed in reads course orgs" on public.course_orgs for select to authenticated using (true);
create policy "admin changes course orgs" on public.course_orgs for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

insert into public.courses (code, name, sort) values
  ('BSIT',    'BS Information Technology', 1),
  ('BEED',    'Bachelor of Elementary Education', 2),
  ('BSBA OM', 'BSBA major in Operations Management', 3),
  ('BSBA FM', 'BSBA major in Financial Management', 4);
insert into public.course_orgs (course, entity_id)
select r.course, e.id
  from (values ('BSIT','PADC'), ('BSIT','LSC'), ('BEED','YMO'), ('BEED','LSC'),
               ('BSBA OM','LSC'), ('BSBA OM','JOES'), ('BSBA FM','LSC'), ('BSBA FM','JFMS')) r(course, short)
  join public.entities e on e.short_name = r.short;
do $$ begin
  if (select count(*) from public.course_orgs) <> 8 then raise exception 'course_orgs seed: expected 8 rows'; end if;
end $$;

-- Memberships made automatically (shown as "From course" in the app).
alter table public.memberships add column via_course boolean not null default false;

-- ---------- Helpers ----------
-- Course codes are compared cleaned: trimmed, single spaces, upper case ("bsba  om" = "BSBA OM").
create or replace function private.norm_course(t text)
returns text language sql immutable set search_path = '' as $$
  select nullif(upper(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')), '')
$$;

create or replace function private.students_course_norm()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.course := private.norm_course(new.course);
  return new;
end $$;
create trigger students_course_norm before insert or update of course on public.students
  for each row execute function private.students_course_norm();
update public.students set course = course where course is distinct from private.norm_course(course);

-- Enrol one student (or everyone when p_student_id is null) in SSG + their course organizations for the current
-- school year. Per-semester orgs use the current semester of that year (skipped if none is current yet).
-- Idempotent: existing memberships are left alone.
create or replace function private.enroll_by_course(p_student_id bigint default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_year bigint; v_sem bigint; n integer;
begin
  select id into v_year from public.school_years where is_current;
  if v_year is null then return 0; end if;
  select id into v_sem from public.semesters where is_current and school_year_id = v_year;

  insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due, via_course)
  select s.id, e.id, v_year, case when e.dues_period = 'semester' then v_sem end, e.dues_amount, true
    from public.students s
    join public.entities e
      on e.is_active
     and (e.is_school_wide
          or exists (select 1 from public.course_orgs co where co.course = s.course and co.entity_id = e.id))
   where s.is_active
     and (p_student_id is null or s.id = p_student_id)
     and (e.dues_period <> 'semester' or v_sem is not null)
     and not exists (
       select 1 from public.memberships m
        where m.student_id = s.id and m.entity_id = e.id and m.school_year_id = v_year
          and coalesce(m.semester_id, 0) = coalesce(case when e.dues_period = 'semester' then v_sem end, 0));
  get diagnostics n = row_count;
  return n;
end $$;

-- New roster student / course changed: enrol; on a course change, drop UNPAID automatic memberships of the
-- current year that the new course no longer includes (paid ones stay: their money is in the ledger).
create or replace function private.students_after_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_year bigint;
begin
  if tg_op = 'UPDATE' and new.course is distinct from old.course then
    select id into v_year from public.school_years where is_current;
    delete from public.memberships m
     using public.entities e
     where m.entity_id = e.id and m.student_id = new.id and m.school_year_id = v_year
       and not m.is_paid and m.via_course and not e.is_school_wide
       and not exists (select 1 from public.course_orgs co where co.course = new.course and co.entity_id = e.id);
  end if;
  perform private.enroll_by_course(new.id);
  return null;
end $$;
create trigger students_after_change after insert or update of course, is_active on public.students
  for each row when (new.is_active) execute function private.students_after_change();

-- A school year or semester becomes current: everyone is enrolled for the new period (dues start fresh).
create or replace function private.period_became_current()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.enroll_by_course(null);
  return null;
end $$;
create trigger school_years_became_current after insert or update of is_current on public.school_years
  for each row when (new.is_current) execute function private.period_became_current();
create trigger semesters_became_current after insert or update of is_current on public.semesters
  for each row when (new.is_current) execute function private.period_became_current();

-- ---------- Membership rules (replaces the "max 1 organization" rule for course students) ----------
create or replace function private.membership_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e record; v_course text; v_names text;
begin
  select category, is_school_wide into e from public.entities where id = new.entity_id;
  if new.semester_id is not null and not exists (
       select 1 from public.semesters s where s.id = new.semester_id and s.school_year_id = new.school_year_id) then
    raise exception 'Semester does not belong to that school year.';
  end if;
  if e.is_school_wide then return new; end if;
  -- Paying / undoing an existing membership is never blocked by the joining rules below.
  if tg_op = 'UPDATE' and new.entity_id = old.entity_id and new.student_id = old.student_id
     and new.school_year_id = old.school_year_id then
    return new;
  end if;

  if e.category = 'organization' then
    select course into v_course from public.students where id = new.student_id;
    if exists (select 1 from public.course_orgs where course = v_course) then
      -- Course students: organizations are decided by the course, nothing else.
      if exists (select 1 from public.course_orgs where course = v_course and entity_id = new.entity_id) then
        return new;
      end if;
      select string_agg(x.short_name, ', ' order by x.short_name) into v_names
        from public.course_orgs co join public.entities x on x.id = co.entity_id where co.course = v_course;
      raise exception '% students belong to SSG, % (set by their course). They cannot join another organization.',
        v_course, v_names using errcode = 'P0001';
    end if;
  end if;

  -- Clubs (everyone) and organizations for other courses: at most one per school year.
  if exists (
       select 1 from public.memberships m join public.entities x on x.id = m.entity_id
        where m.student_id = new.student_id and m.school_year_id = new.school_year_id
          and m.entity_id <> new.entity_id and m.id is distinct from new.id
          and x.category = e.category and not x.is_school_wide) then
    raise exception 'This student already belongs to another % this school year.', e.category;
  end if;
  return new;
end $$;

-- ---------- add_member: the treasurer's "Add member" ----------
-- Finds or creates the roster student, enrols SSG + course orgs (triggers above), then adds the treasurer's own
-- entity when it is a club (or an organization for a non-course student). Returns what the student is now in.
create or replace function private.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entity bigint := (select private.my_entity_id());
  v_year bigint; v_sem bigint; v_student bigint; v_new boolean := false; ent record; v_no text;
  v_in text[];
begin
  if v_entity is null then raise exception 'Only a treasurer can add members.' using errcode = '42501'; end if;
  select id into v_year from public.school_years where is_current;
  if v_year is null then raise exception 'SAS has not opened a school year yet.'; end if;
  v_no := private.norm_student_no(p_student_no);
  if v_no is null then raise exception 'Enter the Student ID.'; end if;

  select id into v_student from public.students where student_no = v_no;
  if v_student is null then
    if coalesce(btrim(p_full_name), '') = '' then raise exception 'Enter the student''s full name.'; end if;
    insert into public.students (student_no, full_name, course, year_level)
    values (v_no, btrim(p_full_name), p_course, p_year_level)
    returning id into v_student;                       -- trigger enrols SSG + course orgs
    v_new := true;
  else
    -- Known student: fill a missing course, otherwise keep what the roster says; make sure they are enrolled.
    update public.students set course = p_course
     where id = v_student and course is null and private.norm_course(p_course) is not null;
    perform private.enroll_by_course(v_student);
  end if;

  select id, category, is_school_wide, dues_period, dues_amount, short_name into ent
    from public.entities where id = v_entity;
  select id into v_sem from public.semesters where is_current and school_year_id = v_year;
  if not exists (select 1 from public.memberships
                  where student_id = v_student and entity_id = v_entity and school_year_id = v_year
                    and coalesce(semester_id, 0) = coalesce(case when ent.dues_period = 'semester' then v_sem end, 0)) then
    if ent.dues_period = 'semester' and v_sem is null then
      raise exception 'SAS has not set the current semester yet.';
    end if;
    -- Club, or organization for a non-course student (membership_rules refuses anything not allowed).
    insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due, recorded_by)
    values (v_student, v_entity, v_year, case when ent.dues_period = 'semester' then v_sem end,
            ent.dues_amount, (select auth.uid()));
  end if;

  select array_agg(x.short_name order by x.is_school_wide desc, x.category, x.short_name) into v_in
    from public.memberships m join public.entities x on x.id = m.entity_id
   where m.student_id = v_student and m.school_year_id = v_year;
  return jsonb_build_object('student_id', v_student, 'new_student', v_new, 'member_of', to_jsonb(v_in),
    'course', (select course from public.students where id = v_student));
end $$;

create function public.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint default null)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select private.add_member(p_student_no, p_full_name, p_course, p_year_level)
$$;

revoke all on function private.add_member(text, text, text, smallint), private.enroll_by_course(bigint),
  private.students_after_change(), private.period_became_current(), private.students_course_norm(),
  private.norm_course(text) from public, anon;
grant execute on function private.add_member(text, text, text, smallint), private.norm_course(text) to authenticated;
grant execute on function public.add_member(text, text, text, smallint) to authenticated;

-- Students already on the roster (none at launch) get their course memberships now.
select private.enroll_by_course(null);
