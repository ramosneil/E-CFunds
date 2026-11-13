# E-CFunds database (Phase 3, 2026-11-12)

Supabase project **e-cfunds** · ref `nvmlawpojydnouzqilaf` · region Singapore (ap-southeast-1) · org "fund-monitoring" (Free plan).
Migrations: `supabase/migrations/` (applied to the live project; filenames = live versions).
Self-check: `bash scripts/phase3-db-test.sh` → applies every migration to a throwaway local Postgres
(with `supabase/tests/local/00_supabase_shim.sql` standing in for Supabase auth) and runs
`supabase/tests/rls_and_workflows.test.sql` — **89 checks, all pass**. Live project: security advisor 0 findings;
schema fingerprint (functions, policies, columns, triggers) identical to the tested local DB.

## Tables (all in `public`, RLS on every one)
| Table | What it holds |
|---|---|
| school_years, semesters | calendar; exactly one `is_current` of each |
| entities | orgs & clubs; `is_school_wide` (SSG), `dues_period` + `dues_amount`, `logo_path`, archive via `is_active` |
| students | the roster (student_no unique) |
| profiles | one per auth user: `status` pending/approved/rejected/disabled, `role`, treasurer `entity_id`, student `student_id`; what they *asked for* at sign-up is kept separately (`requested_*`) |
| memberships | student × entity × year (× semester); `amount_due`, `is_paid` (full payment only), link to its collection entry |
| ledger_entries | THE money table, append-only (update/delete/truncate blocked by trigger, even for the owner) |
| fund_requests | remittance / release / expense requests: pending → approved/rejected/cancelled |
| year_closures | turnover record per entity per year (closing total) |
| messages | treasurer ↔ SAS per entity; `entity_id null` = broadcast |
| accredited_entries (+ view accredited_list with derived `expired`), accredited_history | accredited list with full before/after history |
| audit_log | every insert/update/delete on every table: who, when, before, after (append-only) |

## Who can do what (RLS + function checks)
- **Not signed in:** nothing at all.
- **Pending / rejected / disabled:** only the list of orgs/clubs (for the sign-up form).
- **Admin:** reads everything; approves accounts, requests; releases, adjusts, reverses, closes years.
- **Treasurer:** own org/club only (ledger, requests, memberships, messages); whole roster (to add members); aggregate reports of every org.
- **Student:** own roster row and own dues; aggregate reports (counts only); no ledger, requests or messages.

## API functions (call with `supabase.rpc(...)`)
Reports: `get_entity_report(school_year, semester?)`, `get_school_summary(school_year)`.
Dues: `record_payment`, `undo_payment(reason)`, `set_entity_dues`.
Requests: `file_request(entity, kind, amount, description, attachment?)`, `cancel_request`, `review_request(id, approve, remarks?)`.
Admin money: `admin_release`, `admin_adjust(entity, pocket, ±1, amount, reason)`, `reverse_entry(id, reason)`, `close_school_year`.
Accounts: `review_account(profile, approve, role?, entity?, student?, remarks?)`, `disable_account`,
`set_my_request(role, entity?, student_no?, full_name?)` (pending user states/fixes its own request; migration 8, Phase 5;
dry-run checked on the live project 9/9 and rolled back — local suite not run on Neil's PC, no Postgres there). Messages: `mark_thread_read`.
Student ID sign-in (migrations 9–10): Edge Function `supabase/functions/student-login` (verify_jwt off; the password is the
check) calls `student_login_lookup` / `student_login_record` — **service_role only** — to turn an approved student's ID into
their email on the server; returns session tokens only. Lockout: 5 failed tries per ID in 15 min (`private.login_attempts`,
RLS on with no policies on purpose → advisor INFO "RLS enabled, no policy" is expected). Student IDs are cleaned everywhere
(`private.norm_student_no`: spaces removed, upper-case) by triggers on `students` and `profiles`. CORS: localhost:3000 and
127.0.0.1:3000 + secret `ALLOWED_ORIGINS` (add the live address in Phase 8).
Messaging (migration 11): `messages` (entity_id null = broadcast; `read_at` = read by the other side) + `broadcast_reads`
(one row per treasurer per broadcast, written only by `mark_broadcasts_read()`; admin reads all, treasurer own). Realtime:
`messages` is in the `supabase_realtime` publication (each user only receives rows their RLS allows).
Each public function is a thin SECURITY INVOKER wrapper; the real body is SECURITY DEFINER in the unexposed
`private` schema and checks the caller's role itself. Limits are re-checked at approval; per-entity row lock
prevents two approvals racing past a limit.

## Course-based memberships (migration 15, 2026-11-13)
- `courses` (code, name, sort) and `course_orgs` (course, entity_id): everyone signed in reads; admin writes.
- `memberships.via_course` = made automatically. `private.enroll_by_course(student_id|null)` enrols SSG + course
  orgs for the current year (semester for per-semester orgs), idempotent. Triggers: student insert / course or
  is_active change (`students_after_change`), school year or semester becomes current (`period_became_current`).
- `private.membership_rules`: course students only in their course orgs; others max 1 organization; clubs max 1;
  updates of an existing row (pay/undo) never blocked.
- `add_member(p_student_no, p_full_name, p_course, p_year_level)` → `{student_id, new_student, member_of[], course}`:
  the treasurer's Add member (finds/creates roster student, enrols, adds own club or own org for non-course students).
- Applied over a direct verified-TLS connection (connector was down): rehearsal of 18 cases rolled back first.

## Per-semester + pay when added (migration 16, 2026-11-13)
- All entities `dues_period = 'semester'`; current-year rows moved into the current semester.
- `membership_rules`: max-1 club (and max-1 org for non-course students) counted per semester.
- `add_member` records the payment for the caller's own entity (`private.record_payment`; ₱0 fee → marked paid,
  no ledger line); returns `paid_amount` and `to_collect` (other orgs still unpaid). Rehearsed 12 cases, rolled back.

## Design notes
- Balances are never stored: `private.d_cash/d_saved` implement business-rules §2; reports sum the ledger.
- A wrong remittance/release is corrected with two `admin_adjust` rows (reversal only for single-pocket kinds).
- Sign-up: a trigger on `auth.users` creates a pending profile; nobody can request `admin`.
- First admin (migration `bootstrap_admin`): an email on the private list `private.bootstrap_admins` becomes admin the
  moment it is VERIFIED; the entry is then deleted (one-time). Neil's Claude-account Gmail was added on 2026-11-12
  (data only, not in git). Later admins are approved in the app by an existing admin.
- Storage buckets: `receipts` (private; `receipts/<entity_id>/…`, treasurer own folder, admin all, no delete) and `logos` (public read, admin writes).
- TypeScript types: regenerate in Phase 5 with the Supabase connector (`generate_typescript_types`).
- Dates (migration 12): the database runs on UTC; "today" is computed as Manila's day,
  `(now() at time zone 'Asia/Manila')::date`, in the ledger's default date and the accredited Expired check.
