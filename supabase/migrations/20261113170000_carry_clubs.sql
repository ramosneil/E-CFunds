-- Clubs carry over to the next semester; the student may switch (Neil, 2026-11-13).
-- When a semester becomes current, every PAID club member of the previous semester is listed in the same club for
-- the new semester, unpaid ("To collect"), carried_over = true. If the student joins a different club instead,
-- that club's Add member removes the unpaid carried row. Max 1 club per semester stays.

alter table public.memberships add column carried_over boolean not null default false;

-- Previous semester = the latest one that starts before the current one (also across school years).
create or replace function private.carry_clubs()
returns integer language plpgsql security definer set search_path = '' as $$
declare cur record; prev bigint; n integer;
begin
  select s.id, s.school_year_id, s.starts_on into cur from public.semesters s where s.is_current;
  if cur.id is null then return 0; end if;
  select s.id into prev from public.semesters s where s.starts_on < cur.starts_on order by s.starts_on desc limit 1;
  if prev is null then return 0; end if;

  insert into public.memberships (student_id, entity_id, school_year_id, semester_id, amount_due, carried_over)
  select m.student_id, m.entity_id, cur.school_year_id, cur.id, e.dues_amount, true
    from public.memberships m
    join public.entities e on e.id = m.entity_id and e.category = 'club' and e.is_active and not e.is_school_wide
    join public.students s on s.id = m.student_id and s.is_active
   where m.semester_id = prev and m.is_paid
     and e.dues_period = 'semester'
     -- not already in any club this semester (keeps "max 1 club per semester")
     and not exists (select 1 from public.memberships x join public.entities xe on xe.id = x.entity_id
                      where x.student_id = m.student_id and x.semester_id = cur.id and xe.category = 'club');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.carry_clubs() from public, anon;

create or replace function private.period_became_current()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.enroll_by_course(null);   -- SSG + course organizations
  perform private.carry_clubs();             -- same club as last semester, to collect
  return null;
end $$;

-- Add member: a club treasurer taking a student who was carried over in ANOTHER club removes that unpaid carried
-- row first (the student switched). A paid row elsewhere still blocks (max 1 club per semester).
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
  elsif v_paid then
    raise exception 'This student is already a paid member this semester.';
  end if;

  select amount_due into v_due from public.memberships where id = v_mid;
  if v_due > 0 then
    perform private.record_payment(v_mid);
  else
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
