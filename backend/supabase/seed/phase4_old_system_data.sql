-- Phase 4 data migration: orgs/clubs + accredited list + history from the old PHP system
-- (source: mini_system_db.sql in C:\xampp\htdocs\mini system, tables entities, accredited_entries,
--  accredited_history; dues amount = the single amount_due used by each entity's roster rows).
-- Dues period = school_year for all (old system charged each student once; treasurers can switch to semester in the app).
-- Start-fresh rule: NO students, funds, ledger or users are migrated.
-- Old MySQL `created_at` values are UTC (the dump's `updated_at` runs +08:00).
-- Run once on an empty project; refuses to run twice.

begin;

do $$
begin
  if exists (select 1 from public.entities) or exists (select 1 from public.accredited_entries) then
    raise exception 'Phase 4 seed already applied (entities or accredited_entries not empty)';
  end if;
end $$;

-- ---------- Orgs & clubs (old ids 1–10, in order) ----------
insert into public.entities (name, short_name, category, is_school_wide, dues_period, dues_amount, created_at) values
  ('Supreme Student Government (SSG)',              'SSG',           'organization', true,  'semester', 15.00, '2026-05-09 15:58:35+00'),
  ('Junior Operation Executive Society (JOES)',     'JOES',          'organization', false, 'school_year', 20.00, '2026-05-09 15:58:35+00'),
  ('Programers, Animators, Developers Clan (PADC)', 'PADC',          'organization', false, 'school_year', 35.00, '2026-05-09 15:58:35+00'),
  ('Young Mentors Organization (YMO)',              'YMO',           'organization', false, 'school_year', 35.00, '2026-05-09 15:58:35+00'),
  ('Library Student Council (LSC)',                 'LSC',           'organization', false, 'school_year', 10.00, '2026-05-09 15:58:35+00'),
  ('Junior Financial Management Society (JFMS)',    'JFMS',          'organization', false, 'school_year', 20.00, '2026-05-09 15:58:35+00'),
  ('Sports Club',                                   'Sports Club',   'club',         false, 'school_year', 20.00, '2026-05-09 15:58:35+00'),
  ('English Club',                                  'English Club',  'club',         false, 'school_year', 20.00, '2026-05-09 15:58:35+00'),
  ('Sci-Math Club',                                 'Sci-Math Club', 'club',         false, 'school_year', 20.00, '2026-05-09 15:58:35+00'),
  ('SamFilko Club',                                 'SamFilko Club', 'club',         false, 'school_year', 20.00, '2026-05-09 15:58:35+00');

-- ---------- Accredited list (status 'Accredited' → accredited; past expiry shows as expired via the view) ----------
create temp table old_acc (old_id int, name text, category public.entity_category, adviser text,
  academic_year text, accredited_on date, expires_on date, remarks text, created_at timestamptz) on commit drop;
insert into old_acc values
  (1,  'Supreme Student Government (SSG)',              'organization', 'Dr. Santos',    '2024-2025', '2024-01-10', '2025-01-10', null,                 '2026-05-09 15:58:35+00'),
  (2,  'Junior Operation Executive Society (JOES)',     'organization', 'Ms. Reyes',     '2024-2025', '2024-02-15', '2025-02-15', null,                 '2026-05-09 15:58:35+00'),
  (3,  'Programers, Animators, Developers Clan (PADC)', 'organization', 'Mr. Cruz',      '2024-2025', '2024-03-01', '2025-03-01', null,                 '2026-05-09 15:58:35+00'),
  (4,  'Young Mentors Organization (YMO)',              'organization', 'Ms. Garcia',    '2023-2024', '2023-06-20', '2024-06-20', null,                 '2026-05-09 15:58:35+00'),
  (5,  'Library Student Council (LSC)',                 'organization', 'Mr. Dela Cruz', '2024-2025', '2024-05-05', '2025-05-05', null,                 '2026-05-09 15:58:35+00'),
  (6,  'Junior Financial Management Society (JFMS)',    'organization', 'Ms. Torres',    '2024-2025', '2024-07-01', '2025-07-01', 'Awaiting documents', '2026-05-09 15:58:35+00'),
  (7,  'Sports Club',                                   'club',         'Mr. Bautista',  '2024-2025', '2024-01-20', '2025-01-20', null,                 '2026-05-09 15:58:35+00'),
  (8,  'English Club',                                  'club',         'Ms. Lim',       '2024-2025', '2024-03-10', '2025-03-10', null,                 '2026-05-09 15:58:35+00'),
  (9,  'Sci-Math Club',                                 'club',         'Dr. Ramos',     '2023-2024', '2023-09-01', '2024-09-01', null,                 '2026-05-09 15:58:35+00'),
  (10, 'SamFilko Club',                                 'club',         'Mr. Santos',    '2024-2025', '2024-01-15', '2025-01-15', null,                 '2026-05-09 15:58:35+00');

-- The history trigger logs each insert ('insert', full after_row) automatically.
insert into public.accredited_entries
  (name, category, adviser, academic_year, accredited_on, expires_on, status, remarks, entity_id, created_at)
select o.name, o.category, o.adviser, o.academic_year, o.accredited_on, o.expires_on, 'accredited', o.remarks,
       (select e.id from public.entities e where e.name = o.name), o.created_at
from old_acc o order by o.old_id;

-- ---------- Old history (3 edits). The old system stored only {id, name} as submitted, so there is
-- no before-state; keep what exists, marked as migrated, with the original time.
insert into public.accredited_history (entry_id, action, before_row, after_row, changed_by, changed_at)
select a.id, 'update', null,
       jsonb_build_object('name', h.name, 'migrated_from', 'old system', 'old_entry_id', h.old_id,
                          'note', 'old system logged only id + name'),
       null, h.changed_at
from (values (9, 'Sci-Math Club',                              '2026-05-09 18:02:44+00'::timestamptz),
             (4, 'Young Mentors Organization (YMO)',           '2026-05-09 18:02:55+00'),
             (6, 'Junior Financial Management Society (JFMS)', '2026-05-09 18:03:04+00')) h(old_id, name, changed_at)
join public.accredited_entries a on a.name = h.name;

-- ---------- Self-check (aborts the whole load on any mismatch) ----------
do $$
declare n int;
begin
  select count(*) into n from public.entities;                     if n <> 10 then raise exception 'entities %', n; end if;
  select count(*) into n from public.entities where category = 'organization'; if n <> 6 then raise exception 'orgs %', n; end if;
  select count(*) into n from public.entities where is_school_wide; if n <> 1 then raise exception 'school-wide %', n; end if;
  select sum(dues_amount)::int into n from public.entities;        if n <> 215 then raise exception 'dues sum %', n; end if;
  select count(*) into n from public.accredited_entries where entity_id is not null; if n <> 10 then raise exception 'linked acc %', n; end if;
  select count(*) into n from public.accredited_history where action = 'insert'; if n <> 10 then raise exception 'insert hist %', n; end if;
  select count(*) into n from public.accredited_history where after_row ? 'migrated_from'; if n <> 3 then raise exception 'old hist %', n; end if;
end $$;

commit;
