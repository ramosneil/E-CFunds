# E-CFunds Rebuild — Migration Plan (v1, 2026-11-12)

Fund monitoring for OMSC Office of Student Affairs (SAS) clubs & organizations.
Source system: `C:\xampp\htdocs\mini system` (PHP + MySQL/XAMPP).

## 1. Decisions (confirmed with Neil)
| Topic | Decision |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, mobile-first, light/dark mode |
| App delivery | Installable PWA + Android APK via Capacitor (no Play Store, no iOS) |
| Backend / DB | Supabase: Postgres, Auth, Row-Level Security, Storage, Realtime, Edge Functions |
| Hosting | Vercel (auto-deploy from GitHub) |
| Budget | Free tiers only → scheduled keep-alive ping so Supabase Free doesn't pause after 7 idle days |
| Roles | SAS Admin, Treasurer (1 per org/club), Student (NEW, read-only) |
| Student login | Google (school email) AND Student ID + password |
| Account creation | Self-register → approval (treasurer approved by Admin; student must match a roster student ID) |
| Membership rule | A student belongs to max 1 club + max 1 organization |
| Student can see | School-wide fund summary, every org/club report, own dues status (NOT the transaction-level ledger) |
| Payments | No online payments; treasurer records cash collection as today |
| Periods | Officer term = school year; dues per year or semester (each org decides); balances carry forward automatically |
| Keep features | Admin↔Treasurer messaging, AI chatbot, Accredited list + history, Google Sign-In for staff |
| AI chatbot | Gemini free tier at launch, provider-swappable (Claude Haiku later) inside an Edge Function |
| Reports | PDF reports, Excel/CSV export, receipt/proof attachments, full audit log |
| Data | START FRESH (2026-11-12): old students/funds are test data. Migrate entities + logos, accredited list + history, admin. Real rosters via import |
| Design | Keep OMSC/OSA royal-blue + gold brand, modern redesign, light + dark |
| Repo | `ramosneil/E-CFunds` (private) |

## 2. Issues found in the old system (must fix)
1. Gemini API key hard-coded in `api/config.php` → never commit; rotate key; store as Supabase secret.
2. All treasurers seeded with the same password (`patch_treasurers.sql`).
3. Balances stored as mutable totals (`entity_funds`) and patched by scripts (`fix_release.php`, `patch_deduct_releases.sql`, `reset_funds.php`) → drift. New: single ledger, balances computed by SQL views.
4. `transactions` and `financial_records` duplicate each other → merged into one ledger.
5. In-browser Babel (3 MB) → replaced by a compiled Vite build.

## 3. Draft data model (Postgres)
- `semesters` (academic_year, term, dates, is_current)
- `entities` (name, short_name, category org|club, logo, is_active, default_dues)
- `profiles` (= auth user; role admin|treasurer|student; entity_id for treasurer; student_id link; approval status)
- `students` (student_no, full_name, course, year_level, email)
- `memberships` (student × entity × semester, amount_due, paid/unpaid, paid_at, recorded_by) — trigger enforces 1 org + 1 club
- `ledger_entries` (entity, school_year, semester, date, kind: opening|collection|remittance|release|expense|adjustment|reversal, amount, description, attachment, created_by) — append-only; see `docs/business-rules.md` §2
- `remit_requests`, `release_requests`, `expense_requests` (pending→approved/rejected; approval writes ledger rows via RPC in one transaction)
- `messages`, `accredited_entries`, `audit_log` (trigger-based, every table)
- Views: `entity_balances`, `school_summary`, `student_dues`
- RLS: admin = all; treasurer = own entity; student = summary views + own dues only

## 4. Phases (each ends with a self-check gate — don't advance until it passes)
0. **Setup** — repo, CLAUDE.md (≤200 lines, routes to docs/), .gitignore, secrets scan. ✔ Check: no secret in git history.
1. **Business rules spec** — extract every money formula from the PHP pages into `docs/business-rules.md`. ✔ Check: Neil confirms; formulas reproduce current dashboard numbers.
2. **Design system + mockups** (light & dark) for Admin, Treasurer, Student. ✔ Check: Neil approves.
3. **Supabase schema + RLS + migrations + SQL tests per role.** ✔ Check: Supabase advisors clean; role tests pass.
4. **Data migration** entities, logos, accredited list + history, admin → Postgres (start fresh). ✔ Check: row counts + logos match.
5. **App build** — auth/onboarding & approvals, Admin, Treasurer, Student screens, reports/exports.
6. **Edge Functions** — AI chatbot (Gemini, swappable), keep-alive cron.
7. **PWA + Capacitor Android APK.**
8. **Deploy to Vercel + end-to-end QA** per role, Lighthouse, accessibility, light/dark check.

## 5. Open items
- Balance formulas: DONE and CONFIRMED in `docs/business-rules.md` (session 3).
- Working mode: Claude works autonomously; things only Neil can do are tracked in `docs/handoff.md`.
- Gemini: new key created by Neil; added as Supabase secret in Phase 6.
- Status 2026-11-12 (session 3): Phases 0–1 done. Phase 2 drafted, waiting for Neil's approval. Session history: `docs/sessions.md`.
