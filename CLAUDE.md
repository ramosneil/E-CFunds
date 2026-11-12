# CLAUDE.md — E-CFunds

Fund monitoring app for OMSC Office of Student Affairs (SAS) clubs & organizations.
Rebuild of a PHP/MySQL/XAMPP system (`C:\xampp\htdocs\mini system`) as a cloud PWA + Android app.

## Status (updated 2026-11-12, session 4)
- Phase 0 (repo setup) — DONE
- Phase 1 (business rules) — DONE, CONFIRMED by Neil: `docs/business-rules.md` +
  `scripts/phase1-rules-check.sql` (passes). Full dues payment only; students see counts only
- Phase 2 (design) — DONE, APPROVED: `docs/design-system.md` (mockup link inside)
- Phase 3 (database) — DONE: Supabase project `e-cfunds` (ref nvmlawpojydnouzqilaf, Singapore, Free),
  7 migrations live, `bash scripts/phase3-db-test.sh` = 89/89, security advisor clean. See `docs/database.md`
- First admin: Neil's Gmail is on `private.bootstrap_admins` → becomes admin on first verified sign-in
- Phase 4 (data) — DONE (session 4, run on Neil's PC): 10 orgs/clubs (ids 1–10 = old ids; SSG school-wide),
  dues ₱10–35 all `school_year`, logos in Storage `logos/<id>/logo.png`, accredited list (10) + history
  (10 inserts + 3 old edits). Load: `supabase/seed/phase4_old_system_data.sql` (run once, self-checks);
  logos: `node scripts/phase4-upload-logos.mjs` (reads `.env` SUPABASE_URL + SUPABASE_SECRET_KEY, gitignored)
- NEXT: Phase 5 — app build. School year dates: left for SAS to set in the app (Neil, session 3)
- Local repo on Neil's PC: `C:\xampp\htdocs\E-CFunds`; old system stays a plain folder (never commit from it)
- Gemini key: old key removed from old code; Neil has a NEW key (adds it himself in Phase 6)
- Full plan & phases: `docs/plan.md` · Handoff checklist: `docs/handoff.md`
- What each session made: `docs/sessions.md` · Neil's working rules: `docs/working-rules.md`

## Database rules (Phase 3)
- Change schema ONLY via a new file in `supabase/migrations/`; run `scripts/phase3-db-test.sh`, then apply
  with the Supabase connector and re-run advisors. Never edit an applied migration

## Plugins installed (session 3)
- supabase, Vercel, Design, frontend-design (skills: supabase:*, vercel:*, design:*)

## Cloud environment ("E-CFunds", personal)
- Setup script: `npm ci` / `npm install` once `package.json` exists
- Network: package registries + MCP connectors (Supabase, Vercel) only; no secrets/variables.
  Phase 5 (app tests): add host `nvmlawpojydnouzqilaf.supabase.co` (no wildcards allowed)
- Local Postgres 16 is pre-installed but stopped: `pg_ctlcluster 16 main start`, then
  `su postgres -c "psql -v ON_ERROR_STOP=1 -f $PWD/scripts/phase1-rules-check.sql"`

## Old system source (needed for Phases 1 & 4)
- On Neil's PC: `C:\xampp\htdocs\mini system` (connect this folder in the session)
- Key files: `pages/{dashboard,treasurer,organization,students,transaction,financial}.php`,
  `database/framework/schema/schema.sql`, `mini_system_db.sql` (full dump, has student data —
  never commit it)

## Stack (decided)
- Frontend: React + TypeScript + Vite + Tailwind, mobile-first, light/dark mode
- Mobile: installable PWA + Android APK via Capacitor (no Play Store, no iOS)
- Backend: Supabase (Postgres, Auth, RLS, Storage, Realtime, Edge Functions)
- Hosting: Vercel (auto-deploy from GitHub)
- Budget: free tiers only → keep-alive ping so Supabase Free doesn't pause
- AI chatbot: Gemini free tier via Edge Function, provider-swappable (Claude Haiku later)

## Roles
- SAS Admin — everything; approves remits, releases funds, approves accounts
- Treasurer — one per org/club; students, dues, remit requests, expenses
- Student — read-only: school summary, every org/club report, own dues status
  (NOT transaction-level ledger)

## Core rules (full spec: `docs/business-rules.md`)
- Money = each org/club's capital fund in 2 pockets: cash on hand (treasurer) + saved with SAS
- Remit = cash→saved, release = saved→cash (budget-based, no fixed cap): transfers, total unchanged
- Expenses: treasurer files with receipt, SAS approves. Collections + / expenses − change the total
- Term = 1 school year; all cash must be remitted before turnover; saved = next officers' Previous Funds
- Dues period/amount set per org/club (year or semester); SSG is school-wide (not the 1-org limit)
- Student belongs to max 1 club + max 1 organization (+ SSG)
- One append-only ledger; balances computed in SQL views, never stored; corrections = reversals
- Data: START FRESH — migrate entities, accredited list, admin only (old students = test data)
- Self-register → approval (students must match a roster student ID)
- Student login: Google OR Student ID + password; staff: email/password or Google

## Security (non-negotiable)
- No secrets in git. Keys live in Supabase secrets / Vercel env / local `.env` (gitignored)
- Every table has RLS; test each role
- Old Gemini key was hard-coded in `api/config.php` → treated as leaked, rotated

## Working rules (from Neil)
- WORK AUTONOMOUSLY through the phases. Only stop to hand Neil what Claude can't do itself
  (account logins, keys, approvals, installs on his PC) — list them in `docs/handoff.md`
- Product decisions are already made (see `docs/plan.md`); don't re-ask them. Ask only when
  something is genuinely unknown and a wrong guess would be costly
- Never hallucinate; verify facts and numbers
- To-do lists include a self-check step; don't advance until current step is verified
- UI: premium quality, always design light AND dark mode
- "ULTRA…" = maximum-quality output
- Update this file at session end; keep it 150–200 lines max; link out to docs/

## Docs map
- `docs/plan.md` — decisions, data model draft, phases with check gates
- `docs/business-rules.md` — (Phase 1, confirmed) money formulas, workflows, decisions log
- `docs/sessions.md` — session-by-session log of what was made
- `docs/working-rules.md` — Neil's full working rules
- `scripts/phase1-rules-check.sql` — prototype ledger + asserts (run on any throwaway Postgres)
- `docs/design-system.md` — (Phase 2) colors, type, components, light/dark, mockup link
- `docs/database.md` — (Phase 3) tables, roles, API functions, test/advisor results
- `scripts/phase3-db-test.sh` — migrations + 89 role/money checks on local Postgres
- `scripts/phase2-design-check.js` — contrast + sample-number self-check (`node …`)
