-- SSG governor and SSG auditor are typed ONCE by SAS (Neil, 2026-11-20) next to the SAS Coordinator, and every
-- Financial Report (clubs, orgs and the SSG itself) uses them. get_financial_report already returns every
-- report_settings column under "settings", so only the table and the save function change.
alter table public.report_settings
  add column ssg_governor_name text check (ssg_governor_name is null or length(ssg_governor_name) <= 80),
  add column ssg_auditor_name text check (ssg_auditor_name is null or length(ssg_auditor_name) <= 80);

-- Start them from what the SSG treasurer saved before (if anything), so nothing typed is lost.
update public.report_settings r set
  ssg_governor_name = s.head_name, ssg_auditor_name = s.auditor_name
from public.signatories s join public.entities e on e.id = s.entity_id and e.is_school_wide
where r.id and s.school_year_id = private.current_school_year_id();

create or replace function private.save_report_settings(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.report_settings set
    republic_line = coalesce(nullif(trim(p->>'republic_line'), ''), republic_line),
    school_name = coalesce(nullif(trim(p->>'school_name'), ''), school_name),
    campus_line = coalesce(nullif(trim(p->>'campus_line'), ''), campus_line),
    -- Only the keys sent are changed (a sent empty value clears an optional line).
    website = case when p ? 'website' then nullif(trim(p->>'website'), '') else website end,
    email = case when p ? 'email' then nullif(trim(p->>'email'), '') else email end,
    phone = case when p ? 'phone' then nullif(trim(p->>'phone'), '') else phone end,
    coordinator_name = case when p ? 'coordinator_name' then nullif(trim(p->>'coordinator_name'), '') else coordinator_name end,
    coordinator_title = coalesce(nullif(trim(p->>'coordinator_title'), ''), coordinator_title),
    ssg_governor_name = case when p ? 'ssg_governor_name' then nullif(trim(p->>'ssg_governor_name'), '') else ssg_governor_name end,
    ssg_auditor_name = case when p ? 'ssg_auditor_name' then nullif(trim(p->>'ssg_auditor_name'), '') else ssg_auditor_name end,
    updated_by = (select auth.uid()), updated_at = now()
  where id;
end $$;
