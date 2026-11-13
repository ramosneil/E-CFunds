# CLAUDE.md — E-CFunds

Fund monitoring app for the OMSC Mamburao Office of Student Affairs and Services (SAS): student organizations'
and clubs' dues, remittances, releases and expenses. Rebuild of an old PHP/MySQL/XAMPP system
(`C:\xampp\htdocs\mini system`, a plain folder — never commit anything from it) as a web app + Android app.

## Where things are
- Live site: **https://e-cfunds.vercel.app** (Vercel project `e-cfunds`, team ramosneil; production = `main`,
  previews behind Vercel login). Privacy notice: `/privacy` (public).
- Repo: `ramosneil/E-CFunds` — **PUBLIC** (Neil's choice): everything committed is world-readable.
  Local copy on Neil's PC: `C:\xampp\htdocs\E-CFunds`. Dev: `npm run dev` → http://localhost:3000.
- Supabase: project `e-cfunds` (ref `nvmlawpojydnouzqilaf`, Singapore, Free plan). Edge Functions `chat`,
  `student-login`. Keep-alive: `.github/workflows/keep-alive.yml` every 3 days.
- Android app: Capacitor 8 (`android/`, app id `ph.edu.omsc.ecfunds` — permanent). Built + signed on GitHub
  (`.github/workflows/android.yml`); latest download `releases/latest/download/E-CFunds.apk`.
- Docs: `docs/plan.md` (phases) · `docs/business-rules.md` (rules, confirmed) · `docs/database.md` (tables,
  functions, migrations) · `docs/design-system.md` · `docs/handoff.md` (things only Neil can do) ·
  `docs/sessions.md` (what each session did) · `docs/working-rules.md` (Neil's rules in full).

## Status (updated 2026-11-13, end of session 4)
- **All 8 plan phases done; launched for real use.** Pre-launch cleanup done (TEST data and test accounts wiped,
  Google sign-in app published, privacy notice live). Real accounts now exist (Neil = admin, a Sports Club
  treasurer, a student) and one real BSIT student on the roster.
- Migrations live: 17 (last = `20261113170000_carry_clubs`). Every migration file in `supabase/migrations/`.
- Latest APK: v0.8.0 (installed and working on Neil's phone, incl. Google sign-in in the app).
- Not yet seen on screen: the treasurer's new **Add member** sheet (course dropdown, "Add & record ₱X") and the
  "Carried over" tag — need a treasurer's login; ask the Sports Club treasurer to try it.
- NEXT ideas: custom domain, own email sender (SMTP), more course rules if SAS adds courses.

## Memberships & fees (Neil, 2026-11-13 — migrations 15–17)
- **Organizations are mandatory by course** (tables `courses`, `course_orgs`; SAS can change them):
  BSIT → SSG, PADC, LSC · BEED → SSG, YMO, LSC · BSBA OM → SSG, LSC, JOES · BSBA FM → SSG, LSC, JFMS ·
  other course / no course → SSG only (+ max 1 organization added by hand).
- **SSG = every student on campus**, every semester.
- **Whoever adds the student** (any org or club treasurer, via `add_member`), they are enrolled in SSG + their
  course organizations automatically. A course student can't join an organization outside their course.
- **Fees are per semester** for every org and club; each treasurer sets their own amount.
- **Fee is mandatory — pay when added:** "Add & record ₱X" records the payment at once. Other course orgs list the
  student "To collect" until their own treasurer records it.
- **Clubs:** student's choice, max 1 per semester. When SAS makes a new semester current, SSG + course orgs are
  re-listed and last semester's paid club members are listed again in the same club ("Carried over", to collect).
  Switching club = the new club adds them; the old unpaid carried listing is removed automatically.

## Core money rules (full spec: `docs/business-rules.md`)
- Each org/club has one capital fund in 2 pockets: **cash on hand** (treasurer) + **saved with SAS**.
- Remit = cash → saved; release = saved → cash (budget-based, no cap). Transfers don't change the total.
- Collections add, expenses subtract (expense needs a receipt photo; SAS approves remits, releases, expenses).
- One **append-only ledger**; balances are computed, never stored; corrections are reversals. The ledger and
  audit log refuse UPDATE/DELETE by trigger.
- Term = 1 school year; cash remitted before turnover; saved money = next officers' previous funds.
- "Today" = Manila date. Full payment only (no partial dues).

## Roles & sign-in
- **SAS Admin**: everything; approves accounts and money requests; manages orgs, accredited list, school year.
- **Treasurer**: one per org/club; members, fees, requests, messages with SAS.
- **Student**: own dues + every org's totals only (never other students' names or the ledger).
- Everyone self-registers → SAS approves (students must match a roster Student ID). Sign in with email/password,
  Google (web + Android app), or Student ID + password (`student-login`, lockout 5 tries / 15 min).
- First admin = Neil's Gmail via `private.bootstrap_admins` (RLS on, owner-only).

## Features built
- Admin: dashboard, approvals, orgs & logos, accredited list + history, school year/semesters, messages.
- Treasurer: home (fund, pockets, export), members (course-based), requests with "If approved" preview.
- Student: my dues, reports. Everyone: My account (password, install app), "Ask E-CFunds" assistant.
- Messaging (Realtime): org threads, broadcasts, unread badges.
- Exports: org report PDF (charts, OMSC letterhead, Inter font for ₱) + CSVs, school summary, members, accredited.
- Assistant: Edge Function `chat` (Gemini, auto-picks newest Flash-Lite; reads with the caller's token → RLS;
  reply language from the latest question; 30 questions/day, admin unlimited).
- PWA: installable, works offline (shows "You're offline"), "Update available → Reload".
- Android: exports via share sheet; Google sign-in opens the phone browser and returns via
  `ph.edu.omsc.ecfunds://auth/callback` (`src/lib/nativeAuth.ts`); email links go to the live site.

## Stack
- React 19 + TypeScript + Vite 8 + Tailwind 4 + React Router 8 + React Query + supabase-js (PKCE).
- Supabase: Postgres + RLS, Auth, Storage (logos, receipts), Realtime, Edge Functions (Deno).
- Vercel hosting (`vercel.json`: SPA fallback, immutable assets, no-cache sw/index/manifest, security headers).
- Capacitor 8 + filesystem/share/app/browser plugins. jsPDF lazy-loaded. Free tiers only.
- Pin package versions at least 2 weeks old.

## How to change things
- **Database:** new file in `supabase/migrations/` only; never edit an applied migration. Rehearse it on live
  inside a transaction that always rolls back (test every case), then apply + record it, then check advisors.
  - With the Supabase connector: `execute_sql` (rehearse) / `apply_migration`.
  - **If the connector fails** (it did on 2026-11-13): direct connection — `SUPABASE_DB_URL` in `.env` + Supabase
    CA `C:\Users\christian jay\Downloads\prod-ca-2021.crt`, verified TLS only (never turn certificate checks off);
    node `pg` scripts in the session scratchpad (`run.mjs`, `rehearse.mjs`, `apply.mjs` records
    `supabase_migrations.schema_migrations`). Advisors can't run without the connector — check RLS/grants by hand.
- **Edge Functions:** deploy with the connector (full file content); CORS allows exact origins only:
  localhost:3000, 127.0.0.1:3000, `https://localhost` (Android), `https://e-cfunds.vercel.app`.
- **Types:** `src/lib/database.types.ts` is hand-trimmed — add new tables/columns/RPCs there.
- **Web deploy:** push/merge to `main` → Vercel builds production automatically.
- **Android release:** push a tag `vX.Y.Z` → signed APK + GitHub Release (tags with `-` = pre-release). Signing key
  lives only in `Documents\E-CFunds-signing` on Neil's PC + 4 GitHub secrets; lose it = no app updates.
- **Icons/splash:** `node scripts/make-app-assets.mjs` → `npx capacitor-assets generate --android`.
- Testing two roles at once: localhost:3000 vs 127.0.0.1:3000 (separate sessions). The Claude browser pane can't
  run service workers — test offline/PWA in headless Edge.

## Security (non-negotiable)
- No secrets in git. Keys live in Supabase secrets (GEMINI_API_KEY), Vercel env (public URL + publishable key),
  GitHub secrets (Android signing, publishable key variable) and local `.env` (gitignored: SUPABASE_SECRET_KEY,
  SUPABASE_DB_URL). Never paste keys in chat; never type Neil's passwords.
- If a key shows up in chat or a screenshot, ask Neil to rotate it (the secret key was rotated 2026-11-13).
- Every table has RLS; test each role. Students get aggregates only.
- Leaked-password protection needs the Pro plan → off on Free (advisor WARN is expected). Expected INFO: RLS with no
  policies on `private.bootstrap_admins`, `private.chat_usage`, `private.login_attempts` (owner-only on purpose).
- Old system's Gemini key was hard-coded → treated as leaked, replaced.

## Working rules (from Neil — full list in `docs/working-rules.md`)
- **ASK FIRST** when a decision is unclear; use plan mode and ask until ~95% sure. Never assume.
- Product decisions in `docs/plan.md` are made — don't re-ask them.
- Never hallucinate; verify facts and numbers against the database.
- Every to-do list has a self-check step; don't move on until the current step is verified.
- Premium UI, always light AND dark; screenshot every page built (light + dark, phone + desktop).
- Things only Neil can do (logins, keys, approvals, installs) → `docs/handoff.md`, with simple step-by-step.
- "ULTRA…" = maximum-quality output.
- Update this file at session end; keep it 150–200 lines; link out to docs/.
