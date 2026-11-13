-- Per-semester memberships + "pay when added" (Neil, 2026-11-13).
-- * Every organization AND club charges its fee per SEMESTER (treasurers set their own amounts).
-- * SSG + course organizations are enrolled automatically each semester (trigger from migration 15 runs when SAS
--   makes a semester current). Clubs are the student's choice each semester: never carried over; max 1 per semester.
-- * The fee is mandatory: Add member records the payment for the treasurer's own org/club at once (no unpaid rows
--   from Add member). Other course organizations list the student "to collect" until their treasurer records it.

-- ---------- 1. Fees per semester; existing rows of the current year move into the current semester ----------
update public.entities set dues_period = 'semester' where dues_period <> 'semester';

update public.memberships m
   set semester_id = s.id
  from public.semesters s
 where s.is_current and s.school_year_id = m.school_year_id and m.semester_id is null;

-- ---------- 2. "Max 1" limits count per semester ----------
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
  -- Paying / undoing / moving an existing membership is never blocked by the joining rules below.
  if tg_op = 'UPDATE' and new.entity_id = old.entity_id and new.student_id = old.student_id
     and new.school_year_id = old.school_year_id then
    return new;
  end if;

  if e.category = 'organization' then
    select course into v_course from public.students where id = new.student_id;
    if exists (select 1 from public.course_orgs where course = v_course) then
      if exists (select 1 from public.course_orgs where course = v_course and entity_id = new.entity_id) then
        return new;
      end if;
      select string_agg(x.short_name, ', ' order by x.short_name) into v_names
        from public.course_orgs co join public.entities x on x.id = co.entity_id where co.course = v_course;
      raise exception '% students belong to SSG, % (set by their course). They cannot join another organization.',
        v_course, v_names using errcode = 'P0001';
    end if;
  end if;

  -- Clubs (everyone) and organizations for other courses: at most one per SEMESTER.
  if exists (
       select 1 from public.memberships m join public.entities x on x.id = m.entity_id
        where m.student_id = new.student_id and m.school_year_id = new.school_year_id
          and coalesce(m.semester_id, 0) = coalesce(new.semester_id, 0)
          and m.entity_id <> new.entity_id and m.id is distinct from new.id
          and x.category = e.category and not x.is_school_wide) then
    raise exception 'This student already belongs to another % this semester.', e.category;
  end if;
  return new;
end $$;

-- ---------- 3. Add member = enrol + record the payment for the treasurer's own org/club ----------
create or replace function private.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entity bigint := (select private.my_entity_id());
  v_year bigint; v_sem bigint; v_student bigint; v_new boolean := false; ent record; v_no text;
  v_mid bigint; v_paid boolean; v_due numeric; v_in text[]; v_collect text[];
begin
  if v_entity is null then raise exception 'Only a treasurer can add members.' using errcode = '42501'; end if;
  select id into v_year from public.school_years where is_current;
  if v_year is null then raise exception 'SAS has not opened a school year yet.'; end if;
  v_no := private.norm_student_no(p_student_no);
  if v_no is null then raise exception 'Enter the Student ID.'; end if;

  select id, category, is_school_wide, dues_period, dues_amount, short_name into ent
    from public.entities where id = v_entity;
  select id into v_sem from public.semesters where is_current and school_year_id = v_year;
  if ent.dues_period = 'semester' and v_sem is null then
    raise exception 'SAS has not set the current semester yet.';
  end if;

  select id into v_student from public.students where student_no = v_no;
  if v_student is null then
    if coalesce(btrim(p_full_name), '') = '' then raise exception 'Enter the student''s full name.'; end if;
    insert into public.students (student_no, full_name, course, year_level)
    values (v_no, btrim(p_full_name), p_course, p_year_level)
    returning id into v_student;                       -- trigger enrols SSG + course orgs
    v_new := true;
  else
    update public.students set course = p_course
     where id = v_student and course is null and private.norm_course(p_course) is not null;
    perform private.enroll_by_course(v_student);
  end if;

  select id, is_paid into v_mid, v_paid from public.memberships
   where student_id = v_student and entity_id = v_entity and school_year_id = v_year
     and coalesce(semester_id, 0) = coalesce(case when ent.dues_period = 'semester' then v_sem end, 0);
  if v_mid is null then
    -- Club, or organization for a non-course student (membership_rules refuses anything not allowed).
    insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due, recorded_by)
    values (v_student, v_entity, v_year, case when ent.dues_period = 'semester' then v_sem end,
            ent.dues_amount, (select auth.uid()))
    returning id, is_paid into v_mid, v_paid;
  elsif v_paid then
    raise exception 'This student is already a paid member this semester.';
  end if;

  -- The fee is mandatory: record it now (one collection line in this org/club's ledger).
  select amount_due into v_due from public.memberships where id = v_mid;
  if v_due > 0 then
    perform private.record_payment(v_mid);
  else            -- a ₱0 fee: nothing to collect, so no ledger line; the member is simply in good standing
    update public.memberships set is_paid = true, paid_at = now(), recorded_by = (select auth.uid()) where id = v_mid;
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
    'paid_amount', v_due, 'to_collect', to_jsonb(coalesce(v_collect, '{}')));
end $$;
