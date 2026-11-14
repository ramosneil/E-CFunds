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

## Status (updated 2026-11-14, end of session 6)
- **Launched, in real use.** Real accounts: Neil (SAS admin), a Sports Club treasurer, a student; one real BSIT
  student on the roster. Test data was wiped before launch.
- Database: **27 migrations** live (last `20261114130000_expense_categories`).
- **"Where the money goes" (transparency) live 2026-11-14:** per-org charts + approved expenses for every role;
  numbers checked against the live ledger; confirmed on Neil's phone.
- Android: latest APK **v1.1.1 = build 10**; `ota.json` minNativeBuild = 10.
- **Confirmed working on Neil's phone:** push notifications with the app closed, app self-update end to end
  (download → reopen → "E-CFunds was updated"), Back button, full screen, Delete conversation, Add member (adds only),
  UI-review fixes on every page (treasurer, SAS admin, student): semester dues everywhere, live amount checks,
  Approve/Reject confirm, Ask = ✨ in the phone top bar (floating only on computers).
- Design tools on Neil's PC: plugins UI Design Review, playwright, Mobile App Design (iOS), Mobile Design System
  (installed with the Claude CLI); Supabase + Figma connectors; GitHub plugin via the Windows user variable
  GITHUB_PERSONAL_ACCESS_TOKEN (expires 2027-02-12).
- **Website notifications (Web Push): confirmed on Neil's PC (Chrome), 2026-11-14.** If a browser shows nothing,
  check Windows → Settings → System → Notifications → Google Chrome (it was off on Neil's PC). iPhone not tested yet.
- Android push shows nothing although FCM accepts (`sent` counts it)? Phone side: Settings → Apps → E-CFunds →
  Notifications (allow, pop-up) + Battery (allow background activity, auto launch). Oppo/Realme force-stop swiped apps.
  With those settings Neil's phone gets pushes even with the app swiped away (confirmed 2026-11-14).
- **Phone notifications card** (My account, Android): `notifyPermission` times out after 3 s and falls back to the
  push plugin's permission; the card never hides (fixed + confirmed "On" on Neil's phone, 2026-11-14).
- **Web address stays `e-cfunds.vercel.app`; email stays Supabase's built-in sender** — Neil cancelled the school
  subdomain + Resend plan (2026-11-14, "too complicated"; OMSC IT controls the DNS). Undone: Resend domain deleted,
  IT draft discarded, `docs/it-request.md` removed (git history has it), VAPID contact = the vercel.app URL.
  Vercel project now has only `e-cfunds.vercel.app` (school domain removed after Neil turned on Vercel 2FA).
  Optional: `docs/email-templates/` work with the built-in sender.
- Claude in Chrome works on Neil's PC (Gmail, Resend, Vercel signed in). Never sign in for him; ask before sending,
  deleting or changing anything; never decide security prompts (e.g. 2FA) for him; its filter hides long `=`/`;`
  values — use the site's Copy button + clipboard, never disguise text.
- Vercel account has **2FA** (authenticator app on Neil's phone, 2026-11-14): new sign-ins need his 6-digit code;
  recovery codes are with Neil — never ask for them.
- Open items: none. Not yet seen: the iPhone Home Screen app on a real iPhone.
- Ideas not started: more course rules, App Store iPhone app, school web address/own email sender (cancelled once).

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
- **Student**: own dues + every org's totals + "where the money goes" (charts + SAS-approved expenses: date,
  purpose, category, amount). Never: other students' names, receipts, the "receipt checked by SAS" mark (staff only),
  remit/release lines, the ledger. Rule + categories: `docs/business-rules.md` "Transparency".
- Self-register → SAS approves (students must match a roster Student ID). Email/password, Google (web + app), or
  Student ID + password (`student-login`, lockout 5 tries / 15 min). First admin via `private.bootstrap_admins`.
- Passwords: 8+ chars with upper, lower, number, symbol (meter + checklist, eye icon) — also set in Supabase Auth.
  Terms: checkbox on sign-up / Google's first screen → `profiles.terms_accepted_at`.

## Features
- Admin: dashboard (waiting-for-you near top, accounts to approve, per-org list on phones / table on computers),
  approvals (confirm before Approve; Reject asks a reason), orgs & logos (treasurer shown per card), accredited list +
  history, school year/semesters, messages + Announcement.
- Treasurer: home (fund, compact actions, dues this semester → Members "To collect"), members (course-based; add,
  then record when paid; ⋮ = undo payment), requests (waiting/done groups, File again on rejected).
- Student: my dues (labelled by semester), reports. Everyone: My account (sign out lives here, with a confirm),
  "Ask E-CFunds" assistant (Gemini via `chat`, RLS-scoped) — ✨ in the phone top bar, floating button on computers.
- **Where the money goes** (migration 27): `src/components/finance/FinancePanel.tsx` (hand-built SVG per the dataviz
  skill; tokens `--chart-in` blue / `--chart-out` orange, validated light+dark; tooltip + "Show as table") fed by
  `get_entity_finance` / `get_school_finance` (`useEntityFinance` / `useSchoolFinance`). Shown on `/reports/:id`
  (students + treasurers), student Home + SAS Dashboard (school-wide), treasurer Home, SAS org detail, PDF report.
  Expenses need a category (form + Approvals, SAS may change it).
- Exports: org report PDF (charts, OMSC letterhead, Inter font for ₱) + CSVs, school summary, members, accredited.
- iPhone: Home Screen web app (no App Store); printable guide `docs/iphone-install-guide.html`.
- **Live screens:** data-free ticks in `live_changes` → open screens re-fetch within ~0.5 s (`src/lib/live.ts`).
- **Notifications** (migrations 19–20, 22–23, 26; events per role in `docs/database.md`): bell + pop-up + soft chime
  (mute per device); phone notifications; **push when the app is closed** — Android via FCM, browsers + iPhone Home
  Screen app via Web Push (`src/lib/webpush.ts`, `public/push-sw.js`, VAPID key pair only in `private.push_config`
  — never regenerate; My account card + one-time banner `WebPushBanner.tsx`). Pieces: `notifications` table
  (Realtime) → `src/lib/notifications.ts`; `src/lib/phone.ts` (local notifications); `src/lib/push.ts` (register
  after sign-in, unregister on sign-out); pg_net → Edge Function `push` (secret in `private.push_config`).
- **App updates:** website "Update available → Reload"; Android self-updates (`src/lib/ota.ts`,
  `@capgo/capacitor-updater` self-hosted: Vercel builds `/ota/manifest.json` + zip; applies at the next app start;
  status + "Check for updates" in My account). Raise `ota.json` minNativeBuild only when a change needs a new APK.
- **Android app:** full screen (status bar hidden, Capacitor SystemBars; hidden again on the next tap after a
  swipe-down, `src/main.tsx`), Back button (`NativeBack.tsx`), exports via share sheet, Google sign-in via
  `ph.edu.omsc.ecfunds://auth/callback`, email links open the live site. Android screenshots still show the bar.

## UI conventions (from the 2026-11-14 page-by-page review — keep them)
- **Dues counts = current semester.** `useEntityReport` passes `p_semester_id` (filters memberships only; money stays
  year-wide). Exports do the same (`reportRow`). Label it "Dues · this semester".
- **Money forms check while typing:** red note under Amount, submit disabled, never show a negative "If approved".
- **Anything that moves money asks first** (`confirmAsk`); rejections ask for a reason (`promptAsk`).
- Touch targets ≥ 44 px; whole cards/rows are tappable; nothing floats over content on phones (no FAB).
- Phone vs computer: phones get lists/cards, computers get tables; tables must fit at 1440 px.
- Request icons: Landmark = remit, HandCoins = release, Receipt = expense (`kindIcon` in `common.tsx`).
- `Button`'s `cx` doesn't merge Tailwind classes — a `text-*` in className can lose to the variant's; use a plain
  `<button>` for one-off colours.
- Shared lookups in `src/lib/data.ts`: `useTreasurers()` (admin), `useSemesters()`, `useEntityReport()`.
- **How to review a page:** UI Design Review plugin (`/ui-design-review:ui-review`). Admin pages: Claude can open the
  live site in the browser pane where Neil is signed in as SAS admin — view only, never approve/send. Treasurer and
  student pages: ask Neil for phone screenshots (light + dark). Changed components: check with a temporary
  `preview.html` + `src/__preview.tsx` (sample data; delete before committing).

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
- **Edge Functions:** Supabase connector (`deploy_edge_function`; `verify_jwt: false` for `push` and
  `student-login`). Fallback if the connector is down: Neil makes a new scoped access token → `.env`
  `SUPABASE_ACCESS_TOKEN`, then `npx supabase@2.122.0 functions deploy <name> --project-ref nvmlawpojydnouzqilaf
  --use-api` (+ `--no-verify-jwt` for those two); revoke the token afterwards. CORS allows exact origins only: localhost:3000,
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
- Testing two roles at once: localhost:3000 vs 127.0.0.1:3000. On e-cfunds.vercel.app the browser pane DOES run the
  service worker, so after a deploy it shows the old build until "Update available → Reload" (or SKIP_WAITING).
  Desktop app: `/mcp` sign-in dialogs don't open — use connectors (claude.ai/settings/connectors) or tokens.
- After a push, wait for `https://e-cfunds.vercel.app/ota/manifest.json` `version` = the new commit before checking.

## Security (non-negotiable)
- No secrets in git. Supabase secrets: GEMINI_API_KEY, FCM_SERVICE_ACCOUNT. Vercel env: public URL + publishable key.
  GitHub: ANDROID_* signing, GOOGLE_SERVICES_JSON, variable SUPABASE_PUBLISHABLE_KEY. Local `.env` (gitignored):
  SUPABASE_SECRET_KEY, SUPABASE_DB_URL. Never paste keys in chat; never type Neil's passwords.
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
