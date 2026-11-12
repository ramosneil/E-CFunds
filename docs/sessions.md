# Session log — what was made, session by session

Newest last. Each session adds one entry at the end: what was done, decisions, what's next.

## Session 1 — planning + repo (2026-11-12)
- Read the old PHP/MySQL system (`C:\xampp\htdocs\mini system`) and proposed the new stack:
  React + TS + Vite + Tailwind · Supabase · Vercel · PWA + Capacitor Android APK (all confirmed by Neil).
- Created private repo `ramosneil/E-CFunds`; Neil installed the Claude GitHub App on it.
- Phase 0 pushed: README, CLAUDE.md, .gitignore, `docs/plan.md` (decisions, data model, phases).
- Removed the hard-coded Gemini key from the old code (treated as leaked). Neil made a NEW key
  (goes into Supabase secrets in Phase 6, never in git or chat).
- Neil's rule change: Claude works through the phases on its own and only hands over what it
  can't do → `docs/handoff.md`.

## Session 2 — Phase 1 business rules (2026-11-12)
- Read every money formula in the old pages; loaded `mini_system_db.sql` into a throwaway
  Postgres. Found 6 different "remaining funds" formulas + 13 old bugs (business-rules §6).
- Neil answered the money-model questions (business-rules §8): remitted money stays the org's
  (saved for next officers), releases are budget-based with no fixed cap, all cash remitted before
  turnover, term = 1 school year, treasurer files expenses + SAS approves, each org sets its dues,
  SSG is school-wide, START FRESH (no old students/funds migrated).
- Wrote `docs/business-rules.md` + `scripts/phase1-rules-check.sql` (all checks pass).
- Updated the Claude Project doc `claude/e-cfunds-migration-plan.md`.

## Session 3 — Phase 1 gate + cloud environment (2026-11-12)
- Created cloud environment **"E-CFunds"** (personal, linked to the repo): package registries +
  connectors allowed, no extra hosts, no secrets. Setup script runs `npm ci`/`npm install` once
  `package.json` exists. Postgres 16 is pre-installed: `pg_ctlcluster 16 main start`.
  Phase 3: add the project's `<ref>.supabase.co` host once the Supabase project exists.
- Neil CONFIRMED `docs/business-rules.md` → Phase 1 DONE. Answers: full dues payment only
  (no partial); students see counts + own status only (not who else paid).
- Wrote Neil's working rules out in full: `docs/working-rules.md`.
- `/init` declined by Neil (CLAUDE.md is hand-maintained).
- Opened PR ramosneil/E-CFunds#1 (session-3 docs). Neil installed plugins: supabase, Vercel,
  Design, frontend-design.
- Phase 2 drafted: `docs/design-system.md` + design canvas (15 artboards: design system board;
  Admin dashboard/approvals, Treasurer home/new request, Student home/org report on phone; Admin
  desktop; every screen in light AND dark). Link in design-system.md.
- Self-check `scripts/phase2-design-check.js`: 34/34 contrast pairs ≥ 4.5:1, 13/13 sample-number checks.
- Neil APPROVED Phase 2.
- Phase 3 DONE: created Supabase project `e-cfunds` (Singapore, Free). 6 migrations: core schema,
  helpers + RLS, ledger + money workflows, audit log, storage buckets, invoker wrappers (advisor fix).
  Local suite 84/84; live security advisor clean; live schema fingerprint = tested schema. `docs/database.md`.
- Bootstrap admin migration (89/89 tests, advisor clean): Neil's Gmail becomes the first admin on first
  verified sign-in. School year dates left for SAS to set in the app.
- Old folder NOT reachable from the cloud session (no Remote Control folder shared).
- NEXT: Phase 4 — migrate entities + logos, accredited list + history (needs the old folder shared).

## Session 4 — Phase 4 data migration (2026-11-12, on Neil's PC)
- Cloned the repo to `C:\xampp\htdocs\E-CFunds`; the old system folder stays a plain copy (no git, never committed from).
- Loaded into the live project: 10 orgs/clubs (SSG school-wide), dues from the old roster rows
  (one amount per org, 50 rows each: SSG 15, JOES 20, PADC 35, YMO 35, LSC 10, JFMS 20, clubs 20),
  accredited list (10, all now derived "expired") + history (trigger inserts + 3 old edits, marked migrated).
  Script: `supabase/seed/phase4_old_system_data.sql` — runs in one transaction with built-in checks.
- Logos: Neil added the Supabase secret key to `.env` (gitignored); `scripts/phase4-upload-logos.mjs`
  uploaded 10/10 and verified byte sizes over the public URL. Security advisor clean.
- Decisions: dues period `school_year` for all (Neil let Claude decide; matches old one-payment-per-student);
  JOES keeps its name although its logo reads "Office Administration Executive Society".
- A temporary anon upload policy was refused by the safety check → used the secret-key script instead.

## Session 4 (cont.) — Phase 5 app build, slice 1 (2026-11-12)
- Scaffolded the app (pinned: vite 8.3.8, react 19.3.1, tailwind 4.3.5, supabase-js 2.119.0, react-router 8.5.1,
  @tanstack/react-query 5.107.1, lucide-react 1.72.0, typescript 5.9.3). Tokens from design-system.md, light + dark.
- Found a Phase 3 gap: pending users could not set what they ask for after sign-in (Google sign-ups carry no
  metadata; org list needs a login). Added migration `20261112134412_pending_set_my_request` + 6 checks in the
  test suite; dry-run on live 9/9 then rolled back; applied; advisor clean. Local suite not run (no Postgres on this PC).
- Screens: auth + pending request; Admin dashboard/approvals/orgs/accredited/calendar/org detail with ledger +
  release; Treasurer home/members/requests; Student home/reports. tsc strict + vite build pass (172 kB gzip).
- Screenshots (new rule #11): sign-in + register, light/dark × 1440 px/375 px, no console errors.
  Inner screens wait for Neil's first admin sign-in.
- Neil became first admin (email confirmed; localhost links only work on this PC). School year 2026-2027 opened
  with placeholder dates (Aug 1–Dec 31, Jan 1–May 31); added "Edit dates". Test JOES treasurer approved.
- Money flow tested end to end on JOES (Neil chose real JOES; entries labelled TEST): pay ₱20 → remit ₱20 →
  release ₱5 → expense ₱5 with receipt, each approved by SAS; screens = ledger math = DB (cash 0, saved 15).
  Two-role testing: admin on localhost:3000, treasurer on 127.0.0.1:3000 (dev server bound to 127.0.0.1).
- Fixes from screenshot passes: phone overflow (grid-cols-1), org/club sort, no-wrap buttons/years, no colour on
  ₱0.00, Add member aria-label, receipt tab opened during the click (phones block async popups).
- Rule changes: screenshot every page (#11); ASK FIRST replaces "work autonomously". Installed skill
  design-taste-frontend (reviewed; global). Plugins ui-ux-pro-max + superpowers installed by Neil.
- Student ID sign-in (planned in plan mode, Neil chose: ID as sign-in shortcut, My account to set a password,
  5 tries → 15-min lock). Migration 9 + Edge Function `student-login` (curl: 400/401 generic/429 on 6th/CORS).
  Migration 10 cleans Student IDs everywhere after Neil's "TEST -0001" request missed the roster's TEST-0001.
  Real test: TEST-0001 signed in by Student ID (1 ok attempt logged); student sees own dues/reports only —
  direct API check: 0 ledger/requests/messages/audit rows, 1 own membership/student/profile.
- Messaging (plan mode; Neil chose instant updates, per-treasurer broadcast reads, Messages tab + admin More menu).
  Migration 11 (dry-run 9/9 live; 10 checks added to the suite). Live test admin (localhost:3000) ↔ JOES treasurer
  (127.0.0.1:3001): message + badge arrive in ~2 s without reload, Seen receipts, broadcast "Read by 1 of 1",
  treasurer can delete only own messages, admin deletes conversation/broadcast; student has no Messages and is
  redirected. All TEST messages deleted (0 messages, 0 reads; audit log keeps the history).
- Exports (plan mode; Neil: all 4, real PDF files, OMSC letterhead, graphs). jsPDF 4.2.1 + autotable 5.0.9 lazy
  chunk (main bundle +1.8 KB). Inter 4.1 TTF in public/fonts (OFL; verified ₱/− glyphs). Seal source uploaded to
  Storage by scripts/upload-brand-logo.mjs (not committed). Charts drawn as vectors; palettes validated: cash/saved
  #E0A82E/#3355CC, in/out #0E8A7A/#D9480F (CVD ΔE 13.5). Every export generated via the real buttons and inspected:
  numbers match the DB; fixed header overlap, CSV negative numbers, UTC "today" → Manila date.
- Found: database timezone is UTC, so ledger `occurred_on` (default current_date) is the previous day between
  00:00–08:00 Manila. Asked Neil before changing the database.
- Mistake: my first export test imported the app's modules a 2nd time in Neil's admin tab; two Supabase clients
  raced on the refresh token and signed the tab out. Neil signed in again; later tests only clicked real buttons.
- Neil approved Manila dates → migration 12 (ledger default + accredited Expired use Manila's day). Live dry-run at
  01:00 Manila: an entry expiring on UTC-today flipped accredited → expired as intended; applied; advisor unchanged.
- Faster first load (plan mode): React.lazy for every screen, Suspense inside the Shell, idle warm-up of the role's
  screens, Rolldown codeSplitting groups (react 66 KB, supabase 54 KB, app-libs 27 KB, app code ~9 KB gz).
  Production sign-in page: 175 → 159.4 KB JS gz. Click-through: 9 admin screens 62–137 ms, 3 student screens
  62–69 ms, no blank moments; student browser loaded only student/Home, Reports, Account.
- Supabase database went unreachable 17:03 UTC (522/521, "Database pool connection lost"; status page clean,
  postgres log just a checkpoint). Neil restarted the project; verified all data intact (10 orgs, 3 accounts,
  JOES 0/15, 12 migrations, 12 files). Cause unknown — free-plan instance.
- Phase 6 (plan mode; Neil: everyone scoped, user's language, 30/day admin unlimited, GitHub Actions keep-alive).
  Migration 13 (chat quota + anon keep_alive; dry-run 8/8, applied; advisor: expected INFO for private.chat_usage).
  Edge Function `chat` v1 (verify_jwt on; caller-token reads; Gemini with model fallback; strict data-only prompt
  with injection rule). App: lazy ChatPanel + floating button (hidden on Messages). Without the key the app shows
  "not switched on yet" end to end. keep-alive.yml simulated locally: HTTP 200 "ok". Waiting for Neil's key.
