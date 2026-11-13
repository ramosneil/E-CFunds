# CLAUDE.md — E-CFunds

Fund monitoring app for OMSC Office of Student Affairs (SAS) clubs & organizations.
Rebuild of a PHP/MySQL/XAMPP system (`C:\xampp\htdocs\mini system`) as a cloud PWA + Android app.

## Status (updated 2026-11-13, session 4)
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
- Phase 5 (app) — IN PROGRESS (session 4): Vite 8 + React 19 + TS + Tailwind 4 + supabase-js + React Query +
  React Router 8 in `src/`. Auth (email/password, Google button, reset), pending-request screen, Admin
  (dashboard, approvals, orgs & logos, accredited + history, school year), Treasurer (home, members/dues,
  requests with "If approved" preview + receipts), Student (my dues, reports). `npm run dev` → localhost:3000.
  tsc strict + build pass; sign-in/register screenshotted light/dark × phone/desktop.
  Migration 8 `set_my_request` (pending user states role/org/student ID; needed for Google sign-ups).
  Session 4 later: admin/treasurer/student screens all screenshot-checked; JOES money flow tested (TEST data);
  Student ID sign-in (migrations 9–10 + Edge Function `student-login`, lockout 5/15 min, IDs cleaned) + My account.
  Messaging (migration 11 + Realtime): org conversations, broadcasts with per-treasurer reads, unread badges,
  admin phone nav = Dashboard/Approvals/Orgs/Messages/More. Live-tested admin↔JOES, test messages deleted.
  Exports: org financial report (PDF w/ charts + ledger CSV), school summary (PDF+CSV), members CSV, accredited
  (PDF+CSV); OMSC letterhead (seal cropped from Storage logos/brand/omsc-seal-source.jpg), Inter font embedded
  (₱), jsPDF lazy-loaded. Chart colours validated (dataviz). Migration 12: "today" = Manila day (ledger default + Expired). Faster load: lazy screens + idle warm-up,
  react/supabase/app-libs chunks; sign-in JS 175 → 159 KB gz; students download student screens only.
- Phase 6 — DONE (session 4): Edge Function `chat` (verify_jwt on; reads with the caller's own token → RLS-scoped;
  Gemini default, swappable via AI_PROVIDER; 30 questions/day, admin unlimited — migration 13), "Ask E-CFunds"
  button for every role; keep-alive = `public.keep_alive()` (anon) + `.github/workflows/keep-alive.yml` every 3 days.
  LIVE: GEMINI_API_KEY added; model auto-picked (gemini-3.5-flash-lite). Admin + student tested (numbers, Taglish,
  privacy/injection refusals). PR #2 merged into main 2026-11-13; keep-alive verified (GitHub run → 200 "ok").
  Treasurer chat + exports tested too (chat v5: reply language decided server-side from the latest question). PR: phase-5-app → main (open on GitHub by Neil). School year dates: SAS sets them in the app
- Phase 7 — DONE (session 4, branch `phase-7-pwa`, PR to main pending): installable PWA (vite-plugin-pwa: pre-caches app files, never
  Supabase data; "Update available → Reload" prompt; Install card in My account) + offline pill ("You're offline").
  Android: Capacitor 8 (`android/`, app id `ph.edu.omsc.ecfunds` — permanent), ₱ icon/splash (`assets/` +
  `node scripts/make-app-assets.mjs` → `npx capacitor-assets generate --android`). In the app: exports go to the
  share sheet (`src/lib/export/save.ts`), Google sign-in hidden until Phase 8 deep links. Edge Functions allow
  origin `https://localhost` (the app). APK built on GitHub: `.github/workflows/android.yml` (Run workflow or tag
  `v*`; signed when the 4 ANDROID_* secrets exist, else debug). Offline + update prompt verified in headless Edge
  (the Claude browser pane can't register service workers). Signing key made by Claude on Neil's PC
  (`Documents\E-CFunds-signing`, outside repo; fingerprint 0D:58:C9:73…); first signed APK v0.7.0-beta.4 installed
  and working on Neil's phone (2026-11-13). New release: push tag `vX.Y.Z` → download artifact from the run
- NEXT: Phase 8 — Vercel deploy, ALLOWED_ORIGINS, Google OAuth URLs, deep links for Google sign-in in the app
- Local repo on Neil's PC: `C:\xampp\htdocs\E-CFunds`; old system stays a plain folder (never commit from it)
- Gemini key: old key removed from old code; NEW key is the Supabase secret GEMINI_API_KEY (never in git)
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
- Repo `ramosneil/E-CFunds` is PUBLIC (Neil, 2026-11-13): everything committed is world-readable
- No secrets in git. Keys live in Supabase secrets / Vercel env / local `.env` (gitignored)
- Every table has RLS; test each role
- Old Gemini key was hard-coded in `api/config.php` → treated as leaked, rotated

## Working rules (from Neil)
- ASK FIRST (Neil, session 4): when a decision is unclear, ask Neil before acting — don't decide alone.
  Things only Neil can do (logins, keys, approvals, installs) go in `docs/handoff.md`
- Product decisions are already made (see `docs/plan.md`); don't re-ask them. Ask only when
  something is genuinely unknown and a wrong guess would be costly
- Never hallucinate; verify facts and numbers
- To-do lists include a self-check step; don't advance until current step is verified
- UI: premium quality, always design light AND dark mode
- Screenshot every page built (light + dark, phone + desktop) to confirm the layout looks right (session 4)
- Start in plan mode; ask questions until ~95% sure, never assume (`docs/working-rules.md` #2)
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
