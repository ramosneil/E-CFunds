-- E-CFunds core schema (Phase 3). Spec: docs/business-rules.md
-- Money lives in ONE append-only ledger (ledger_entries); balances are computed, never stored.

create schema if not exists private;
revoke all on schema private from public;

-- ---------- Types ----------
create type public.app_role       as enum ('admin', 'treasurer', 'student');
create type public.account_status as enum ('pending', 'approved', 'rejected', 'disabled');
create type public.entity_category as enum ('organization', 'club');
create type public.dues_period    as enum ('school_year', 'semester');
create type public.ledger_kind    as enum ('opening', 'collection', 'remittance', 'release', 'expense', 'adjustment', 'reversal');
create type public.pocket         as enum ('cash', 'saved');
create type public.request_kind   as enum ('remittance', 'release', 'expense');
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.accreditation_status as enum ('accredited', 'pending', 'revoked');

-- ---------- Calendar ----------
create table public.school_years (
  id         bigint generated always as identity primary key,
  label      text not null unique check (label ~ '^\d{4}-\d{4}$'),   -- e.g. 2026-2027
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);
create unique index school_years_one_current on public.school_years (is_current) where is_current;

create table public.semesters (
  id             bigint generated always as identity primary key,
  school_year_id bigint not null references public.school_years (id),
  term           smallint not null check (term between 1 and 3),   -- 3 = summer/midyear
  starts_on      date not null,
  ends_on        date not null,
  is_current     boolean not null default false,
  unique (school_year_id, term),
  check (ends_on > starts_on)
);
create index semesters_school_year_id_idx on public.semesters (school_year_id);
create unique index semesters_one_current on public.semesters (is_current) where is_current;

-- ---------- Orgs & clubs ----------
create table public.entities (
  id             bigint generated always as identity primary key,
  name           text not null unique,
  short_name     text not null unique,
  category       public.entity_category not null,
  is_school_wide boolean not null default false,          -- SSG: every student, no 1-org limit
  dues_period    public.dues_period not null default 'semester',
  dues_amount    numeric(12,2) not null default 0 check (dues_amount >= 0),
  logo_path      text,                                     -- storage: logos/<entity_id>/...
  is_active      boolean not null default true,            -- archive only, never hard delete
  created_at     timestamptz not null default now()
);

-- ---------- People ----------
create table public.students (
  id         bigint generated always as identity primary key,
  student_no text not null unique check (length(student_no) between 3 and 30),
  full_name  text not null,
  course     text,
  year_level smallint check (year_level between 1 and 6),
  email      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index students_full_name_idx on public.students (lower(full_name));

-- One row per auth user. Authorization reads THIS table (never user_metadata).
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  full_name           text,
  role                public.app_role,                    -- null until approved
  status              public.account_status not null default 'pending',
  entity_id           bigint references public.entities (id),   -- treasurer's org/club
  student_id          bigint unique references public.students (id),  -- student's roster row
  requested_role      public.app_role,                    -- what they asked for at sign-up
  requested_entity_id bigint references public.entities (id),
  requested_student_no text,
  reviewed_by         uuid references auth.users (id),
  reviewed_at         timestamptz,
  review_remarks      text,
  created_at          timestamptz not null default now(),
  check (status <> 'approved' or role is not null),
  check (role is distinct from 'treasurer' or entity_id is not null),
  check (role is distinct from 'student' or student_id is not null)
);
create index profiles_entity_id_idx on public.profiles (entity_id);
create index profiles_requested_entity_id_idx on public.profiles (requested_entity_id);
create index profiles_reviewed_by_idx on public.profiles (reviewed_by);
create index profiles_status_idx on public.profiles (status) where status = 'pending';
-- One active treasurer account per org/club.
create unique index profiles_one_treasurer_per_entity on public.profiles (entity_id)
  where role = 'treasurer' and status = 'approved';

-- ---------- Ledger (append-only) ----------
create table public.ledger_entries (
  id             bigint generated always as identity primary key,
  entity_id      bigint not null references public.entities (id),
  school_year_id bigint not null references public.school_years (id),
  semester_id    bigint references public.semesters (id),
  kind           public.ledger_kind not null,
  amount         numeric(12,2) not null check (amount > 0),
  pocket         public.pocket,                          -- adjustment / reversal only
  direction      smallint check (direction in (-1, 1)),  -- adjustment / reversal only
  description    text not null,
  occurred_on    date not null default current_date,
  request_id     bigint,                                 -- FK added below
  membership_id  bigint,                                 -- FK added below
  reverses_id    bigint unique references public.ledger_entries (id),
  attachment_path text,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  check ((kind in ('adjustment', 'reversal')) = (pocket is not null and direction is not null)),
  check ((kind = 'reversal') = (reverses_id is not null))
);
create index ledger_entries_entity_year_idx on public.ledger_entries (entity_id, school_year_id);
create index ledger_entries_school_year_id_idx on public.ledger_entries (school_year_id);
create index ledger_entries_semester_id_idx on public.ledger_entries (semester_id);
create index ledger_entries_request_id_idx on public.ledger_entries (request_id);
create index ledger_entries_membership_id_idx on public.ledger_entries (membership_id);
create index ledger_entries_created_by_idx on public.ledger_entries (created_by);

-- ---------- Dues memberships ----------
create table public.memberships (
  id             bigint generated always as identity primary key,
  student_id     bigint not null references public.students (id),
  entity_id      bigint not null references public.entities (id),
  school_year_id bigint not null references public.school_years (id),
  semester_id    bigint references public.semesters (id),  -- set when the entity's dues are per semester
  amount_due     numeric(12,2) not null check (amount_due >= 0),
  is_paid        boolean not null default false,             -- full payment only (Neil, session 3)
  paid_at        timestamptz,
  collection_entry_id bigint references public.ledger_entries (id),
  recorded_by    uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  check (is_paid = (paid_at is not null))
);
create unique index memberships_unique_period on public.memberships
  (student_id, entity_id, school_year_id, coalesce(semester_id, 0));
create index memberships_entity_year_idx on public.memberships (entity_id, school_year_id);
create index memberships_school_year_id_idx on public.memberships (school_year_id);
create index memberships_semester_id_idx on public.memberships (semester_id);
create index memberships_collection_entry_id_idx on public.memberships (collection_entry_id);
create index memberships_recorded_by_idx on public.memberships (recorded_by);

alter table public.ledger_entries
  add constraint ledger_entries_membership_fk foreign key (membership_id) references public.memberships (id);

-- ---------- Requests (remit / release / expense), approved by SAS ----------
create table public.fund_requests (
  id              bigint generated always as identity primary key,
  entity_id       bigint not null references public.entities (id),
  school_year_id  bigint not null references public.school_years (id),
  kind            public.request_kind not null,
  amount          numeric(12,2) not null check (amount > 0),
  description     text not null check (length(description) between 3 and 500),
  attachment_path text,                                   -- receipt (expense) / budget (release)
  status          public.request_status not null default 'pending',
  filed_by        uuid references auth.users (id),
  filed_at        timestamptz not null default now(),
  reviewed_by     uuid references auth.users (id),
  reviewed_at     timestamptz,
  remarks         text,
  check (kind <> 'expense' or attachment_path is not null)
);
create index fund_requests_entity_status_idx on public.fund_requests (entity_id, status);
create index fund_requests_pending_idx on public.fund_requests (filed_at) where status = 'pending';
create index fund_requests_school_year_id_idx on public.fund_requests (school_year_id);
create index fund_requests_filed_by_idx on public.fund_requests (filed_by);
create index fund_requests_reviewed_by_idx on public.fund_requests (reviewed_by);

alter table public.ledger_entries
  add constraint ledger_entries_request_fk foreign key (request_id) references public.fund_requests (id);

-- ---------- Turnover ----------
create table public.year_closures (
  entity_id      bigint not null references public.entities (id),
  school_year_id bigint not null references public.school_years (id),
  closed_by      uuid references auth.users (id),
  closed_at      timestamptz not null default now(),
  closing_total  numeric(12,2) not null,
  primary key (entity_id, school_year_id)
);
create index year_closures_school_year_id_idx on public.year_closures (school_year_id);
create index year_closures_closed_by_idx on public.year_closures (closed_by);

-- ---------- Messaging ----------
create table public.messages (
  id         bigint generated always as identity primary key,
  entity_id  bigint references public.entities (id),     -- null = broadcast to all treasurers
  sender_id  uuid not null references auth.users (id),
  body       text not null check (length(body) between 1 and 4000),
  read_at    timestamptz,                                -- read by the other side
  created_at timestamptz not null default now()
);
create index messages_entity_created_idx on public.messages (entity_id, created_at desc);
create index messages_sender_id_idx on public.messages (sender_id);

-- ---------- Accredited list ----------
create table public.accredited_entries (
  id             bigint generated always as identity primary key,
  name           text not null,
  category       public.entity_category not null,
  adviser        text,
  academic_year  text,
  accredited_on  date,
  expires_on     date,
  status         public.accreditation_status not null default 'accredited',
  remarks        text,
  entity_id      bigint references public.entities (id),
  created_at     timestamptz not null default now()
);
create index accredited_entries_entity_id_idx on public.accredited_entries (entity_id);

create table public.accredited_history (
  id          bigint generated always as identity primary key,
  entry_id    bigint not null,           -- no FK: history survives a delete
  action      text not null check (action in ('insert', 'update', 'delete')),
  before_row  jsonb,
  after_row   jsonb,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index accredited_history_entry_id_idx on public.accredited_history (entry_id);

-- Expired is derived, never typed (business-rules §4.7).
create view public.accredited_list with (security_invoker = true) as
select a.*,
       case when a.status = 'accredited' and a.expires_on < current_date then 'expired'
            else a.status::text end as effective_status
from public.accredited_entries a;
