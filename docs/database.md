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

## Clubs carry over (migration 17, 2026-11-13)
- `memberships.carried_over`; `private.carry_clubs()` (paid club rows of the previous semester → current semester,
  unpaid) runs from `period_became_current` after `enroll_by_course`. `add_member` for a club removes the student's
  unpaid carried rows in other clubs (switch) and refuses if another club is already paid this semester.

## Notifications (migrations 19–20, 2026-11-13)
- `notifications` (recipient, kind, title, body, link, group_key, count, amount, read_at), own rows only, Realtime.
  `private.notify(recipients, kind, title, body, link, group, amount, append)` merges same-group unread rows within 60 s.
- Admin: request filed, dues payment (merged per org), account to approve, treasurer message.
- Treasurer: request decided, SAS message/broadcast, new members to collect (merged), semester started, fee set by SAS,
  account approved/rejected. Student: payment receipt, new fees to pay (merged, course/carried rows only),
  account approved/rejected, announcements. Everyone: app updated (`note_app_updated`, once per version).
- `announce(audience, title, body)` admin-only → students / treasurers / everyone.

## Push to phones and browsers (migrations 22–23, 26; 2026-11-14)
- `push_devices` (own rows only): Android FCM tokens (platform `android`) and browser push subscriptions (platform
  `web`, JSON with endpoint + keys; `save_push_token` checks the JSON). Saved after sign-in, dropped on sign-out.
- New notification → trigger → pg_net → Edge Function `push` (secret from `private.push_config`) → `push_job` returns
  `devices` [{token, platform}], `tokens` (Android) and `vapid` keys (only when a browser is listed) → FCM / Web Push.
- VAPID key pair lives only in `private.push_config` (written by a local script); the public key is in
  `src/lib/webpush.ts`. Never regenerate it: every browser subscription would stop working.

## Where the money goes (migration 27, 2026-11-14)
- Enum `expense_category`; `fund_requests.category`, `ledger_entries.category` (old rows null = Other; ledger stays
  append-only). `file_request(…, p_category)`, `review_request(…, p_category)` (SAS may override on approval).
- `get_entity_finance(entity, year)` / `get_school_finance(year)` (SECURITY DEFINER, any approved user): money in/out,
  monthly series, category totals, approved expense list (not reversed). `receipt_checked` only for SAS + that org's
  treasurer. Built on `private.entity_flows` (reversals count against what they reverse; remits/releases excluded).

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

## Functionality batch (migrations 28–33, 2026-11-15)
- **28 `account_enable`:** `enable_account(profile, remarks?)` (SAS; refuses a 2nd active treasurer); `disable_account`
  also deletes the person's `push_devices`.
- **29 `turnover_rules`:** `close_school_year` refuses if already closed, notifies + disables the org's treasurer.
- **30 `receipts`:** `receipts` (receipt_no unique, membership, student, entity, year, semester, amount, issued_at/by,
  voided_at, void_reason) + `private.receipt_counters`. Trigger `receipt_on_payment` on `memberships.is_paid`:
  false→true issues `private.next_receipt_no()`, true→false voids. Backfilled in paid order. RLS: SAS all, treasurer
  own org, student own. Audited.
- **31 `roster_import`:** `import_students(jsonb)` (SAS) → `{ok, added, updated, unchanged}` or `{ok:false, errors:[{row,
  message}]}`; ≤ 5,000 rows; course must exist in `courses`, year 1–6.
- **32 `budgets_liquidation`:** `budgets` (status pending → approved/rejected/cancelled → liquidation_submitted →
  liquidated; `liquidation_due` = activity_date + 15; reminder flags) + `budget_items`; `budget_id` on `fund_requests`
  and `ledger_entries`; view **`budget_status`** (security_invoker: + released, spent, pending_release, is_overdue).
  RPCs: `file_budget(entity, title, purpose, date, items jsonb)`, `cancel_budget`, `review_budget(id, approve, remarks?)`,
  `submit_liquidation(id, note)`, `review_liquidation(id, approve, remarks?)`. `file_request(…, p_budget_id)` and
  `admin_release(…, p_budget_id)` gained the budget (old signatures dropped); `private.check_release` = overdue block +
  budget left; `review_request` re-checks and copies `budget_id` to the ledger. `private.budget_reminders()` (daily).
  `private.manila_today()`. Notifications trigger `notify_budget`.
- **33 `reminders_cron`:** `dues_reminders` log (unique entity + day) ; `remind_unpaid(entity)` (own treasurer or SAS);
  `private.remind_unpaid_all()`; notification kind `dues_reminder`. **pg_cron** jobs (UTC): `weekly-dues-reminders`
  `0 0 * * 1` (Mon 8 AM Manila), `daily-budget-reminders` `0 0 * * *`. See them: `select * from cron.job`.

## Financial Report (migrations 34–36, 2026-11-15)
- `expense_items` (request_id, line_no, particular, unit, qty, unit_price); `file_request(…, p_budget_id, p_items jsonb)`
  — for expenses the amount becomes Σ qty × unit_price (≤ 30 lines). RLS follows the request.
- `signatories` (entity, school year: head_title, head_name, auditor_name, adviser_name) — readable by all signed-in
  users; `save_signatories(entity, …)` own treasurer or SAS. `report_settings` (one row: header lines, website, email,
  phone, coordinator) — `save_report_settings(jsonb)` SAS only (changes only the keys sent).
- `get_financial_report(entity, semester_id?, as_of?)` → jsonb (SAS or own treasurer). Built from the ledger with
  each reversal counted as the kind it reverses; checked equal to `get_entity_report` for every org.
- **Gotcha (migration 36):** calls through the Supabase API run with `pg_safeupdate` — a `DELETE`/`UPDATE` without
  `WHERE` fails there ("DELETE requires a WHERE clause") but NOT in the direct-connection rehearsal. Always add a WHERE.

## Sections + club import (migration 37, 2026-11-15)
- `students.section` (A–D), `year_level` 1–4. `add_member(…, p_section)`. `import_students` reads `section`.
- `import_members(jsonb)` — club treasurers (`private.is_club_treasurer()`): all rows checked first
  (`private.roster_row_errors`), then each via `private.add_member`; returns `{ok, added, already, skipped:[{row,
  student_no, message}]}`.
- Applied through the Supabase connector (direct `pg` connection hung); recorded as version 20261115120000. Rehearsal
  via the connector: `begin; …migration…; …tests…; do $$ raise exception 'RESULTS …' $$` — the error rolls everything
  back and carries the results (verified with a probe table).

## Audit fixes (migration 38, 2026-11-17)
- students: UPDATE/INSERT policies SAS-only; `grant update (section)`. memberships: INSERT/UPDATE/DELETE SAS-only
  (treasurers go through `add_member` / `import_members` / `set_entity_dues`, all SECURITY DEFINER).
- `review_account` plain messages (2nd treasurer, student not on the list).
- `year_reopenings` (+ audit) and `reopen_school_year(entity, year, reason)` (SAS).
- App: `src/lib/fetchAll.ts` pages any list past the server's 1,000-row cap.

## Budget math + liquidation files (migration 39 `budget_auto_liquidation_files`, 2026-11-17)
- `budgets.liquidation_files text[]` (≤ 10; paths in the private `receipts` bucket under `<entity_id>/liq-<budget>/…`).
- `submit_liquidation(budget, note, files text[] default '{}')`: every file must exist in `receipts` under the org's folder.
- `review_liquidation` approve → inserts `remittance` (budget-tagged) = least(released − spent, cash on hand).
- `budget_status` view + `returned` (remittances tagged to it) + `remaining` (total − spent).
- Rehearsed (rolled back): missing / other-org file refused; good file ok; treasurer can't approve; SAS approve returned
  ₱230 (capped by cash, unspent was ₱300) → cash 0; anon refused.

## Notifications delete + exact links (migration 40 `notifications_delete_links`, 2026-11-19)
- `notifications`: `grant delete` + policy "delete own notifications" (`recipient = auth.uid()`); `clear_notifications()`.
- Links: account → `/approvals?tab=accounts&user=<id>`; request (SAS) → `/approvals?request=<id>`; request decision
  (treasurer) → `/requests?id=<id>`; student payment → `/receipt/m/<membership_id>`.
- Rehearsed (rolled back): own delete 1, someone else's 0, clear all, anon refused.

## Resolution requests + liquidation (migrations 41 `request_kind_resolution`, 42 `resolution_requests`, 2026-11-20)
- `request_kind` + `'resolution'` (own migration, enum value first).
- `fund_requests.amount` nullable (check `fund_requests_amount_needed`: only a resolution not yet approved may have no amount);
  new columns `file_name`, `liquidation_status` (submitted/approved/returned), `liquidation_files text[]`,
  `liquidation_spent`, `liquidation_remarks`, `liquidation_submitted_at`, `liquidated_at`, `liquidated_by`.
- `private.org_file_ok(entity, path)`: the file exists in the private `receipts` bucket under the org's folder.
- `file_resolution(entity, path, file_name)` (treasurer) · `review_resolution(request, approve, amount, remarks)` (SAS;
  approve needs amount ≤ saved → ledger `release`; reject needs remarks) · `submit_resolution_liquidation(request,
  files[], spent)` (treasurer; ≤ 10 files, spent ≤ released) · `review_resolution_liquidation(request, approve,
  remarks)` (SAS; approve → `expense` = spent + `remittance` = unspent capped at cash; return needs remarks).
- `notify_request` covers resolutions (filed / decided / liquidation sent / decided) with exact links.
- Rehearsed (22 checks, rolled back): savings ₱560 → approve ₱100 → cash 100 / saved 460 → spent ₱70 → cash 0 /
  saved 490; over-savings, other org, student, anon refused.

## SSG signers in report settings (migration 43 `ssg_signers_in_settings`, 2026-11-20)
- `report_settings.ssg_governor_name`, `ssg_auditor_name` (≤ 80 chars), started from the SSG's saved signatories;
  `save_report_settings` accepts both keys (SAS only). `get_financial_report` returns them in `settings`.
- Rehearsed (rolled back): SAS saves + trims, report returns them, empty value clears only that key, treasurer refused.

## Liquidation items (migration 44 `liquidation_items`, 2026-11-20)
- `fund_requests.activity_title` (≤ 120). `submit_resolution_liquidation(request, files[], spent default null,
  title default null, items jsonb default null)`: with items (1–30; particular, unit, qty > 0, unit_price ≥ 0) the
  title is required and spent = Σ round(qty × unit_price, 2); lines replace earlier ones in `expense_items`
  (request_id = the resolution). Without items it works as before (old app versions).
- `review_resolution_liquidation` approve → the `expense` ledger entry's description = the activity name, so
  `get_financial_report` groups the items under it (no report function change).
- Rehearsed (8 checks, rolled back): over released / no title / qty 0 refused; old-style call ok; ₱28 from 2 items;
  approve → expense "SimuLIT" ₱28 + ₱2 back to savings; report group SimuLIT, 2 items, subtotal ₱28; anon can't run it.

## Sections A–E + cleared items (migration 46 `sections_e_and_cleared_items`, 2026-11-25)
- `students.section` check is now `^[A-E]$`; `private.add_member` and `private.roster_row_errors` patched in place
  (only the A–D test and its message).
- `public.cleared_items (user_id, list, item_id, cleared_at)` — list in `home_requests | home_activity | activity_log`;
  `item_id '*'` = cleared everything up to `cleared_at`. RLS: each user sees/changes only their own rows.
- `public.audit_log_visible` (security_invoker view): audit_log minus what the signed-in person cleared. The Activity
  log reads it, so counts and paging stay right. audit_log itself is unchanged.
- Rehearsed (rolled back) before applying: E accepted, F rejected, both functions patched, clear one/all/restore,
  other users can't see or forge someone's rows, bad list names refused. No new advisor warnings.

## Activities in the finance report (migration 47 `finance_activities`, 2026-11-25)
- `private.finance_json` recreated unchanged plus key `activities` (one org/club only; null school-wide): approved
  resolution requests (approved = released amount; spent = liquidation_spent once liquidation approved; returned =
  the rest; state liquidated / liquidation_sent / waiting_liquidation) and approved/liquidated budgets (released,
  spent, returned via `budget_moved`; liquidated budgets count spent ≥ released − returned; state liquidated / open /
  overdue). Only titles, dates and amounts — no files, names or remarks. Rehearsed: every other key identical for all
  orgs and school-wide; a student can read it; no receipt marks for students.

## Treasurer requests (migration 48 `treasurer_requests`, 2026-11-26)
- `public.entities_with_treasurer()` (authenticated, security definer): ids of orgs/clubs with an approved treasurer.
- `private.set_my_request` now: Student ID required for both roles and stored cleaned (`norm_student_no`); treasurer:
  org must not have an approved treasurer, Student ID must be on `students`. Rehearsed (rolled back): taken org
  refused, unknown ID refused, missing ID refused, valid request saved, anon can't call the list.

## Year/section on requests (migration 49 `request_year_section`, 2026-11-26)
- `profiles.requested_year_level` (1–4), `requested_section` (A–E). `set_my_request` gained `p_year_level`,
  `p_section` (required; dropped + recreated, grants: authenticated + service_role, not anon). Rehearsed: missing year,
  section F and year 5 refused; student and treasurer requests saved with year/section; anon refused.
