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
Accounts: `review_account(profile, approve, role?, entity?, student?, remarks?)`, `disable_account`. Messages: `mark_thread_read`.
Each public function is a thin SECURITY INVOKER wrapper; the real body is SECURITY DEFINER in the unexposed
`private` schema and checks the caller's role itself. Limits are re-checked at approval; per-entity row lock
prevents two approvals racing past a limit.

## Design notes
- Balances are never stored: `private.d_cash/d_saved` implement business-rules §2; reports sum the ledger.
- A wrong remittance/release is corrected with two `admin_adjust` rows (reversal only for single-pocket kinds).
- Sign-up: a trigger on `auth.users` creates a pending profile; nobody can request `admin`.
- First admin (migration `bootstrap_admin`): an email on the private list `private.bootstrap_admins` becomes admin the
  moment it is VERIFIED; the entry is then deleted (one-time). Neil's Claude-account Gmail was added on 2026-11-12
  (data only, not in git). Later admins are approved in the app by an existing admin.
- Storage buckets: `receipts` (private; `receipts/<entity_id>/…`, treasurer own folder, admin all, no delete) and `logos` (public read, admin writes).
- TypeScript types: regenerate in Phase 5 with the Supabase connector (`generate_typescript_types`).
