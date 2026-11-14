-- Student roster import (Neil, 2026-11-15): SAS uploads the registrar's list (Excel or CSV) on the Students page.
-- Rows are matched by Student ID: new IDs are added, existing ones get their name / course / year updated and are
-- active again. All or nothing — if any row is invalid, nothing is imported and every bad row is listed.
-- New/changed students join SSG and their course orgs through the existing students_after_change trigger.

create or replace function private.import_students(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; i int := 0; v_no text; v_name text; v_course text; v_year int; v_year_txt text;
  errs jsonb := '[]'::jsonb; seen text[] := '{}'; added int := 0; updated int := 0; same int := 0; s record;
begin
  perform private.require_admin();
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows.'; end if;
  if jsonb_array_length(p_rows) = 0 then raise exception 'The file has no students.'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Up to 5,000 students per file. Split the list and import each part.'; end if;

  -- 1) Check every row first.
  for r in select value from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_no := private.norm_student_no(r->>'student_no');
    v_name := nullif(btrim(regexp_replace(coalesce(r->>'full_name', ''), '\s+', ' ', 'g')), '');
    v_course := private.norm_course(r->>'course');
    v_year_txt := nullif(btrim(coalesce(r->>'year_level', '')), '');
    if v_no is null then errs := errs || jsonb_build_object('row', i, 'message', 'Student ID is missing');
    elsif length(v_no) < 3 or length(v_no) > 30 then errs := errs || jsonb_build_object('row', i, 'message', 'Student ID must be 3–30 characters');
    elsif v_no = any(seen) then errs := errs || jsonb_build_object('row', i, 'message', 'Student ID ' || v_no || ' appears twice in the file');
    end if;
    if v_no is not null then seen := seen || v_no; end if;
    if v_name is null then errs := errs || jsonb_build_object('row', i, 'message', 'Full name is missing');
    elsif length(v_name) > 120 then errs := errs || jsonb_build_object('row', i, 'message', 'Full name is too long');
    end if;
    if v_course is not null and not exists (select 1 from public.courses where code = v_course) then
      errs := errs || jsonb_build_object('row', i, 'message', 'Unknown course ' || v_course);
    end if;
    if v_year_txt is not null and (v_year_txt !~ '^[1-6]$') then
      errs := errs || jsonb_build_object('row', i, 'message', 'Year level must be 1 to 6');
    end if;
  end loop;
  if jsonb_array_length(errs) > 0 then
    return jsonb_build_object('ok', false, 'errors', errs);
  end if;

  -- 2) All rows are fine: add or update.
  for r in select value from jsonb_array_elements(p_rows) loop
    v_no := private.norm_student_no(r->>'student_no');
    v_name := btrim(regexp_replace(r->>'full_name', '\s+', ' ', 'g'));
    v_course := private.norm_course(r->>'course');
    v_year := nullif(btrim(coalesce(r->>'year_level', '')), '')::int;
    select * into s from public.students where student_no = v_no;
    if s.id is null then
      insert into public.students (student_no, full_name, course, year_level) values (v_no, v_name, v_course, v_year);
      added := added + 1;
    elsif s.full_name is distinct from v_name or s.course is distinct from v_course
       or s.year_level is distinct from v_year or not s.is_active then
      update public.students set full_name = v_name, course = v_course, year_level = v_year, is_active = true where id = s.id;
      updated := updated + 1;
    else
      same := same + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'added', added, 'updated', updated, 'unchanged', same);
end $$;

create or replace function public.import_students(p_rows jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.import_students(p_rows) $$;

revoke all on function private.import_students(jsonb), public.import_students(jsonb) from public, anon;
grant execute on function private.import_students(jsonb), public.import_students(jsonb) to authenticated;
