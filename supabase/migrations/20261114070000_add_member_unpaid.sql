-- Add member ADDS only (Neil, 2026-11-14): the student starts "To collect"; the treasurer decides afterwards whether
-- they paid (Record ₱X / undo). Replaces migration 16–17's "pay when added". Notifications follow: the student is told
-- about every new unpaid fee (including the org/club that added them); a treasurer isn't notified about the member
-- they just added themselves.

create or replace function private.add_member(p_student_no text, p_full_name text, p_course text, p_year_level smallint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_entity bigint := (select private.my_entity_id());
  v_year bigint; v_sem bigint; v_student bigint; v_new boolean := false; ent record; v_no text;
  v_mid bigint; v_paid boolean; v_due numeric; v_in text[]; v_collect text[]; v_other text;
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

  if ent.category = 'club' then
    select x.short_name into v_other
      from public.memberships m join public.entities x on x.id = m.entity_id
     where m.student_id = v_student and m.school_year_id = v_year and coalesce(m.semester_id, 0) = coalesce(v_sem, 0)
       and x.category = 'club' and m.entity_id <> v_entity and m.is_paid
     limit 1;
    if v_other is not null then
      raise exception 'This student already paid % this semester (1 club per semester).', v_other;
    end if;
    -- Switching clubs: drop the unpaid "carried over" listing in the old club.
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
    -- it existed before this action (rows made just now by course enrolment are fine)
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

create or replace function private.notify_new_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare org text; sem text;
begin
  if new.is_paid then return null; end if;
  select short_name into org from public.entities where id = new.entity_id;
  sem := coalesce(new.semester_id::text, 'y' || new.school_year_id);
  perform private.notify(private.student_account(new.student_id), 'fees',
    'New fees to pay', org, '/', 'fees:' || new.student_id || ':' || sem, new.amount_due, true);
  if new.entity_id is distinct from (select private.my_entity_id()) then        -- not the treasurer adding them now
    perform private.notify(private.treasurer_ids(new.entity_id), 'members',
      'New member to collect', null, '/members', 'members:' || new.entity_id || ':' || sem, new.amount_due);
  end if;
  return null;
end $$;
