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
