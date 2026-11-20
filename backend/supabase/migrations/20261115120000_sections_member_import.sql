-- Sections + club import (Neil, 2026-11-15).
--  • students.section: one letter A–D; year level 1–4 (OMSC has up to 4th year). Members are grouped as 1A, 1B…
--  • add_member gains p_section; for a student already on the list, a given year/section updates theirs.
--  • import_students (SAS) reads Section too.
--  • import_members(jsonb): CLUB treasurers add a whole list at once (same rules as Add member, one row at a time;
--    already-in rows are counted, a student who already paid another club this semester is skipped with the reason).

alter table public.students add column section text check (section ~ '^[A-D]$');
alter table public.students drop constraint students_year_level_check;
alter table public.students add constraint students_year_level_check check (year_level between 1 and 4);

-- ── add_member with section ──────────────────────────────────────────────────────────────────────────────────
drop function public.add_member(text, text, text, smallint);
drop function private.add_member(text, text, text, smallint);

create function private.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint, p_section text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entity bigint := (select private.my_entity_id());
  v_year bigint; v_sem bigint; v_student bigint; v_new boolean := false; ent record; v_no text; v_sec text;
  v_mid bigint; v_paid boolean; v_due numeric; v_in text[]; v_collect text[]; v_other text;
begin
  if v_entity is null then raise exception 'Only a treasurer can add members.' using errcode = '42501'; end if;
  perform private.add_member_guard();
  select id into v_year from public.school_years where is_current;
  if v_year is null then raise exception 'SAS has not opened a school year yet.'; end if;
  v_no := private.norm_student_no(p_student_no);
  if v_no is null then raise exception 'Enter the Student ID.'; end if;
  v_sec := nullif(upper(btrim(coalesce(p_section, ''))), '');
  if v_sec is not null and v_sec !~ '^[A-D]$' then raise exception 'Section must be A, B, C or D.'; end if;
  if p_year_level is not null and p_year_level not between 1 and 4 then raise exception 'Year level must be 1 to 4.'; end if;

  select id, category, is_school_wide, dues_period, dues_amount, short_name into ent
    from public.entities where id = v_entity;
  select id into v_sem from public.semesters where is_current and school_year_id = v_year;
  if ent.dues_period = 'semester' and v_sem is null then
    raise exception 'SAS has not set the current semester yet.';
  end if;

  select id into v_student from public.students where student_no = v_no;
  if v_student is null then
    if coalesce(btrim(p_full_name), '') = '' then raise exception 'Enter the student''s full name.'; end if;
    insert into public.students (student_no, full_name, course, year_level, section)
    values (v_no, btrim(p_full_name), p_course, p_year_level, v_sec)
    returning id into v_student;                       -- trigger enrols SSG + course orgs
    v_new := true;
  else
    update public.students set course = p_course
     where id = v_student and course is null and private.norm_course(p_course) is not null;
    -- The treasurer's year/section is the newest information (e.g. moved to 2B): keep it when given.
    update public.students set year_level = coalesce(p_year_level, year_level), section = coalesce(v_sec, section)
     where id = v_student and (p_year_level is not null or v_sec is not null);
    perform private.enroll_by_course(v_student);
  end if;

  if ent.category = 'club' then
    select x.short_name into v_other
      from public.memberships m join public.entities x on x.id = m.entity_id
     where m.student_id = v_student and m.school_year_id = v_year and coalesce(m.semester_id, 0) = coalesce(v_sem, 0)
       and x.category = 'club' and m.entity_id <> v_entity and m.is_paid
     limit 1;
    if v_other is not null then
      raise exception 'This student already paid % this semester (1 club per semester).', v_other;
    end if;
    delete from public.memberships m
     using public.entities x
     where x.id = m.entity_id and x.category = 'club' and m.entity_id <> v_entity
       and m.student_id = v_student and m.school_year_id = v_year and coalesce(m.semester_id, 0) = coalesce(v_sem, 0)
       and not m.is_paid;
  end if;

  select id, is_paid into v_mid, v_paid from public.memberships
   where student_id = v_student and entity_id = v_entity and school_year_id = v_year
     and coalesce(semester_id, 0) = coalesce(case when ent.dues_period = 'semester' then v_sem end, 0);
  if v_mid is null then
    insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due, recorded_by)
    values (v_student, v_entity, v_year, case when ent.dues_period = 'semester' then v_sem end,
            ent.dues_amount, (select auth.uid()))
    returning id, is_paid into v_mid, v_paid;
  elsif (select created_at from public.memberships where id = v_mid) < now() then
    raise exception 'This student is already a member this semester.';
  end if;

  select array_agg(x.short_name order by x.is_school_wide desc, x.category, x.short_name) into v_in
    from public.memberships m join public.entities x on x.id = m.entity_id
   where m.student_id = v_student and m.school_year_id = v_year
     and coalesce(m.semester_id, 0) = coalesce(v_sem, 0);
  select array_agg(x.short_name order by x.is_school_wide desc, x.short_name) into v_collect
    from public.memberships m join public.entities x on x.id = m.entity_id
   where m.student_id = v_student and m.school_year_id = v_year
     and coalesce(m.semester_id, 0) = coalesce(v_sem, 0) and not m.is_paid and m.entity_id <> v_entity;
  return jsonb_build_object('student_id', v_student, 'new_student', v_new, 'member_of', to_jsonb(v_in),
    'course', (select course from public.students where id = v_student),
    'paid_amount', 0, 'membership_id', v_mid, 'amount_due', (select amount_due from public.memberships where id = v_mid), 'to_collect', to_jsonb(coalesce(v_collect, '{}')));
end $$;

create function public.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint default null, p_section text default null)
returns jsonb language sql set search_path = '' as $$
  select private.add_member(p_student_no, p_full_name, p_course, p_year_level, p_section)
$$;

-- ── Shared row check for both imports ────────────────────────────────────────────────────────────────────────
-- Returns the problems with one row (empty array = fine). p_need_name: the name is required (new student).
create or replace function private.roster_row_errors(r jsonb, p_row int, p_need_name boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare errs jsonb := '[]'::jsonb; v_no text := private.norm_student_no(r->>'student_no');
  v_name text := nullif(btrim(regexp_replace(coalesce(r->>'full_name', ''), '\s+', ' ', 'g')), '');
  v_course text := private.norm_course(r->>'course');
  v_year text := nullif(btrim(coalesce(r->>'year_level', '')), '');
  v_sec text := nullif(upper(btrim(coalesce(r->>'section', ''))), '');
begin
  if v_no is null then errs := errs || jsonb_build_object('row', p_row, 'message', 'Student ID is missing');
  elsif length(v_no) < 3 or length(v_no) > 30 then errs := errs || jsonb_build_object('row', p_row, 'message', 'Student ID must be 3–30 characters');
  end if;
  if p_need_name and v_name is null then errs := errs || jsonb_build_object('row', p_row, 'message', 'Full name is missing');
  elsif v_name is not null and length(v_name) > 120 then errs := errs || jsonb_build_object('row', p_row, 'message', 'Full name is too long');
  end if;
  if v_course is not null and not exists (select 1 from public.courses where code = v_course) then
    errs := errs || jsonb_build_object('row', p_row, 'message', 'Unknown course ' || v_course);
  end if;
  if v_year is not null and v_year !~ '^[1-4]$' then errs := errs || jsonb_build_object('row', p_row, 'message', 'Year level must be 1 to 4'); end if;
  if v_sec is not null and v_sec !~ '^[A-D]$' then errs := errs || jsonb_build_object('row', p_row, 'message', 'Section must be A, B, C or D'); end if;
  return errs;
end $$;

-- ── SAS import, now with Section ─────────────────────────────────────────────────────────────────────────────
create or replace function private.import_students(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; i int := 0; v_no text; v_name text; v_course text; v_year int; v_sec text;
  errs jsonb := '[]'::jsonb; seen text[] := '{}'; added int := 0; updated int := 0; same int := 0; s record;
begin
  perform private.require_admin();
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows.'; end if;
  if jsonb_array_length(p_rows) = 0 then raise exception 'The file has no students.'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Up to 5,000 students per file. Split the list and import each part.'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    errs := errs || private.roster_row_errors(r, i, true);
    v_no := private.norm_student_no(r->>'student_no');
    if v_no is not null and v_no = any(seen) then errs := errs || jsonb_build_object('row', i, 'message', 'Student ID ' || v_no || ' appears twice in the file'); end if;
    if v_no is not null then seen := seen || v_no; end if;
  end loop;
  if jsonb_array_length(errs) > 0 then return jsonb_build_object('ok', false, 'errors', errs); end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_no := private.norm_student_no(r->>'student_no');
    v_name := btrim(regexp_replace(r->>'full_name', '\s+', ' ', 'g'));
    v_course := private.norm_course(r->>'course');
    v_year := nullif(btrim(coalesce(r->>'year_level', '')), '')::int;
    v_sec := nullif(upper(btrim(coalesce(r->>'section', ''))), '');
    select * into s from public.students where student_no = v_no;
    if s.id is null then
      insert into public.students (student_no, full_name, course, year_level, section) values (v_no, v_name, v_course, v_year, v_sec);
      added := added + 1;
    elsif s.full_name is distinct from v_name or s.course is distinct from v_course or s.year_level is distinct from v_year
       or s.section is distinct from v_sec or not s.is_active then
      update public.students set full_name = v_name, course = v_course, year_level = v_year, section = v_sec, is_active = true where id = s.id;
      updated := updated + 1;
    else
      same := same + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', added, 'updated', updated, 'unchanged', same);
end $$;

-- ── Club import ──────────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.import_members(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; i int := 0; v_no text; errs jsonb := '[]'::jsonb; seen text[] := '{}';
  added int := 0; already int := 0; skipped jsonb := '[]'::jsonb; v_known boolean;
begin
  if not (select private.is_club_treasurer()) then
    raise exception 'Only a club treasurer can import members (organizations get members by course).' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'The file has no students.'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Up to 1,000 students per file.'; end if;

  -- 1) Check every row first; nothing is added if any row is wrong.
  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_no := private.norm_student_no(r->>'student_no');
    v_known := v_no is not null and exists (select 1 from public.students where student_no = v_no);
    errs := errs || private.roster_row_errors(r, i, not v_known);
    if v_no is not null and v_no = any(seen) then errs := errs || jsonb_build_object('row', i, 'message', 'Student ID ' || v_no || ' appears twice in the file'); end if;
    if v_no is not null then seen := seen || v_no; end if;
  end loop;
  if jsonb_array_length(errs) > 0 then return jsonb_build_object('ok', false, 'errors', errs); end if;

  -- 2) Add each one like "Add member".
  i := 0;
  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      perform private.add_member(r->>'student_no', r->>'full_name', private.norm_course(r->>'course'),
        nullif(btrim(coalesce(r->>'year_level', '')), '')::smallint, r->>'section');
      added := added + 1;
    exception when others then
      if sqlerrm like '%already a member%' then already := already + 1;
      else skipped := skipped || jsonb_build_object('row', i, 'student_no', private.norm_student_no(r->>'student_no'), 'message', sqlerrm);
      end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'added', added, 'already', already, 'skipped', skipped);
end $$;

create or replace function public.import_members(p_rows jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.import_members(p_rows) $$;

revoke all on function private.add_member(text, text, text, smallint, text), public.add_member(text, text, text, smallint, text),
  private.import_members(jsonb), public.import_members(jsonb) from public, anon;
grant execute on function private.add_member(text, text, text, smallint, text), public.add_member(text, text, text, smallint, text),
  private.import_members(jsonb), public.import_members(jsonb) to authenticated;
revoke all on function private.roster_row_errors(jsonb, int, boolean) from public, anon, authenticated;
