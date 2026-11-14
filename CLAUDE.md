# CLAUDE.md — E-CFunds

Fund monitoring app for the OMSC Mamburao Office of Student Affairs and Services (SAS): student organizations'
and clubs' dues, remittances, releases and expenses. Rebuild of an old PHP/MySQL/XAMPP system
(`C:\xampp\htdocs\mini system`, a plain folder — never commit anything from it) as a web app + Android app.

## Where things are
- Live site: **https://e-cfunds.vercel.app** (Vercel project `e-cfunds`, team ramosneil; production = `main`,
  previews behind Vercel login). Public pages: `/privacy`, `/terms`.
- Repo: `ramosneil/E-CFunds` — **PUBLIC** (Neil's choice): everything committed is world-readable.
  Local copy on Neil's PC: `C:\xampp\htdocs\E-CFunds`. Dev: `npm run dev` → http://localhost:3000.
- Supabase: project `e-cfunds` (ref `nvmlawpojydnouzqilaf`, Singapore, Free plan). Edge Functions `chat`,
  `student-login`, `push`. Keep-alive: `.github/workflows/keep-alive.yml` every 3 days.
- Android app: Capacitor 8 (`android/`, app id `ph.edu.omsc.ecfunds` — permanent). Built + signed on GitHub
  (`.github/workflows/android.yml`); download `releases/latest/download/E-CFunds.apk`.
- Firebase project `E-CFunds` (push notifications only).
- Docs: `docs/plan.md` (phases) · `docs/business-rules.md` (rules) · `docs/database.md` (tables, functions,
  migrations, notification events) · `docs/design-system.md` · `docs/handoff.md` (things only Neil can do) ·
  `docs/sessions.md` (what each session did) · `docs/working-rules.md` (Neil's rules in full).

## Status (updated 2026-11-14, end of session 5)
- **Launched, in real use.** Real accounts: Neil (SAS admin), a Sports Club treasurer, a student; one real BSIT
  student on the roster. Test data was wiped before launch.
- Database: **25 migrations** live (last `20261114090000_clubs_only_add`).
- Android: latest APK **v1.1.1 = build 10**; `ota.json` minNativeBuild = 10.
- **Confirmed working on Neil's phone:** push notifications with the app closed, app self-update end to end
  (download → reopen → "E-CFunds was updated"), Back button, full screen, Delete conversation, Add member (adds only).
- Open items: Neil should delete the Supabase access token when no longer needed (`docs/handoff.md`).
- Ideas not started: browser (web) push, custom domain, own email sender (SMTP), more course rules.

## Memberships & fees (migrations 15–17, 24)
- **Organizations are mandatory by course** (tables `courses`, `course_orgs`; SAS can change them):
  BSIT → SSG, PADC, LSC · BEED → SSG, YMO, LSC · BSBA OM → SSG, LSC, JOES · BSBA FM → SSG, LSC, JFMS ·
  other course / no course → SSG only.
- **SSG = every student on campus**, every semester.
- **Only clubs add students** (migration 25; enforced in `add_member` + RLS). The student is then enrolled in SSG
  + their course orgs automatically. Organization treasurers see their list and record/undo payments only.
  Students who don't join a club aren't tracked (Neil's choice).
- **Fees are per semester** for every org and club; each treasurer sets their own amount.
- **Add member adds only** (migration 24): the student starts "To collect" in every org/club they're in; the
  treasurer decides paid/unpaid (Record ₱X right after adding — "They paid" — or later; undo = reversal).
- **Clubs:** student's choice, max 1 per semester. A new semester re-lists SSG + course orgs and carries last
  semester's paid club members into the same club ("Carried over", to collect); switching club removes that listing.

## Core money rules (full spec: `docs/business-rules.md`)
- Each org/club has one capital fund in 2 pockets: **cash on hand** (treasurer) + **saved with SAS**.
- Remit = cash → saved; release = saved → cash (budget-based, no cap). Transfers don't change the total.
- Collections add, expenses subtract (expense needs a receipt photo; SAS approves remits, releases, expenses).
- One **append-only ledger**; balances are computed, never stored; corrections are reversals. Ledger and audit
  log refuse UPDATE/DELETE by trigger. "Today" = Manila date. Full payment only.
- Term = 1 school year; cash remitted before turnover; saved money = next officers' previous funds.

## Roles & sign-in
- **SAS Admin**: everything; approves accounts and money requests; orgs, accredited list, school year, announcements.
- **Treasurer**: one per org/club; members, fees, requests, messages with SAS.
- **Student**: own dues + every org's totals only (never other students' names or the ledger).
- Self-register → SAS approves (students must match a roster Student ID). Email/password, Google (web + app), or
  Student ID + password (`student-login`, lockout 5 tries / 15 min). First admin via `private.bootstrap_admins`.
- Passwords: 8+ chars with upper, lower, number, symbol (meter + checklist, eye icon) — also set in Supabase Auth.
  Terms: checkbox on sign-up / Google's first screen → `profiles.terms_accepted_at`.

## Features
- Admin: dashboard, approvals, orgs & logos, accredited list + history, school year/semesters, messages + Announcement.
- Treasurer: home (fund, pockets, export), members (course-based; add, then record when paid), requests.
- Student: my dues, reports. Everyone: My account, "Ask E-CFunds" assistant (Gemini via `chat`, RLS-scoped).
- Exports: org report PDF (charts, OMSC letterhead, Inter font for ₱) + CSVs, school summary, members, accredited.
- **Live screens:** data-free ticks in `live_changes` → open screens re-fetch within ~0.5 s (`src/lib/live.ts`).
- **Notifications** (migrations 19–20, 22–23; events per role in `docs/database.md`): bell + pop-up + soft chime
  (mute per device); phone notifications; **push when the app is closed** (FCM). Pieces: `notifications` table
  (Realtime) → `src/lib/notifications.ts`; `src/lib/phone.ts` (local notifications); `src/lib/push.ts` (register
  after sign-in, unregister on sign-out); pg_net → Edge Function `push` (secret in `private.push_config`).
- **App updates:** website "Update available → Reload"; Android self-updates (`src/lib/ota.ts`,
  `@capgo/capacitor-updater` self-hosted: Vercel builds `/ota/manifest.json` + zip; applies at the next app start;
  status + "Check for updates" in My account). Raise `ota.json` minNativeBuild only when a change needs a new APK.
- **Android app:** full screen (status bar hidden, Capacitor SystemBars), Back button (`NativeBack.tsx`), exports
  via share sheet, Google sign-in via `ph.edu.omsc.ecfunds://auth/callback`, email links open the live site.

## Stack
- React 19 + TypeScript + Vite 8 + Tailwind 4 + React Router 8 + React Query + supabase-js (PKCE).
- Supabase: Postgres + RLS, Auth, Storage (logos, receipts), Realtime, Edge Functions (Deno), pg_net.
- Vercel (`vercel.json`: SPA fallback, immutable assets, no-cache sw/index/manifest/ota, security headers).
- Capacitor 8: app, browser, filesystem, share, local-notifications, push-notifications, capgo updater.
- Pin package versions at least 2 weeks old. Free tiers only.

## How to change things
- **Database:** new file in `supabase/migrations/` only; never edit an applied migration. Rehearse on live inside
  a transaction that always rolls back (test every case and role), then apply + record, then check RLS/grants.
  - Supabase connector (`execute_sql`, `apply_migration`, advisors) when it works.
  - **Connector down** (it was, 2026-11-13/14): direct DB — `SUPABASE_DB_URL` in `.env` + Supabase CA
    `C:\Users\christian jay\Downloads\prod-ca-2021.crt`, verified TLS only (never disable certificate checks);
    node `pg` scripts in the session scratchpad (`run.mjs`, `rehearse.mjs`, `apply.mjs` → records
    `supabase_migrations.schema_migrations`).
- **Edge Functions:** connector, or CLI with `SUPABASE_ACCESS_TOKEN` in `.env`:
  `npx supabase@2.122.0 functions deploy <name> --project-ref nvmlawpojydnouzqilaf --use-api`
  (+ `--no-verify-jwt` for `push` and `student-login`). CORS allows exact origins only: localhost:3000,
  127.0.0.1:3000, `https://localhost` (Android), `https://e-cfunds.vercel.app`.
- **Never use window.confirm/prompt/alert** (silently fail in the Android app) → `confirmAsk/promptAsk/alertAsk`
  from `src/lib/confirm.ts`.
- **App self-update rules** (`src/lib/ota.ts`): a downloaded bundle is `pending` until first used, then `success` —
  accept both. If a bug ever breaks self-update on phones, they can't fix themselves: release a fixed APK first,
  then raise `ota.json` minNativeBuild to its build number → old apps show "A new version of the app is ready".
- **Types:** `src/lib/database.types.ts` is hand-trimmed — add new tables/columns/RPCs there.
- **Web deploy:** merge/push to `main` → Vercel builds production (and the OTA package) automatically.
- **Android release:** push tag `vX.Y.Z` → signed APK + GitHub Release (tags with `-` = pre-release). Needs GitHub
  secrets: 4 × ANDROID_* (signing; key only in `Documents\E-CFunds-signing` on Neil's PC — lose it = no updates)
  and GOOGLE_SERVICES_JSON (Firebase; release builds fail without it). Push code requires build ≥ 9
  (`PUSH_MIN_BUILD` in `src/lib/push.ts`).
- **Icons/splash:** `node scripts/make-app-assets.mjs` → `npx capacitor-assets generate --android`.
- Testing two roles at once: localhost:3000 vs 127.0.0.1:3000. The Claude browser pane can't run service workers —
  test offline/PWA in headless Edge. Desktop app: `/mcp` sign-in dialogs don't open — use the token/DB-URL routes.

## Security (non-negotiable)
- No secrets in git. Supabase secrets: GEMINI_API_KEY, FCM_SERVICE_ACCOUNT. Vercel env: public URL + publishable key.
  GitHub: ANDROID_* signing, GOOGLE_SERVICES_JSON, variable SUPABASE_PUBLISHABLE_KEY. Local `.env` (gitignored):
  SUPABASE_SECRET_KEY, SUPABASE_DB_URL, SUPABASE_ACCESS_TOKEN. Never paste keys in chat; never type Neil's passwords.
- If a key shows up in chat or a screenshot, ask Neil to rotate it (the secret key was rotated 2026-11-13).
- Every table has RLS; test each role. Students get aggregates only. Push jobs need service role + secret.
- Leaked-password protection needs the Pro plan → off on Free (advisor WARN expected). Expected INFO: RLS with no
  policies on private tables (owner-only on purpose).

## Working rules (from Neil — full list in `docs/working-rules.md`)
- **ASK FIRST** when a decision is unclear; use plan mode and ask until ~95% sure. Never assume.
- Never hallucinate; verify facts and numbers against the database.
- Every to-do list has a self-check step; don't move on until the current step is verified.
- Premium UI, always light AND dark; screenshot every page built (light + dark, phone + desktop).
- Things only Neil can do (logins, keys, approvals, installs) → `docs/handoff.md`, with simple step-by-step.
- "ULTRA…" = maximum-quality output. Update this file at session end; keep it 150–200 lines; link out to docs/.
