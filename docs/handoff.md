# Handoff — things only Neil can do

Claude works through the phases on its own. This list is what it can't do itself.
Update it every session: tick done items, add new ones.

## Phase 4: data migration — DONE 2026-11-12 (nothing left for Neil)

## Phase 5 (app) — now
- [ ] BEFORE REAL USE: clean up JOES test data (Neil chose "leave it for now", session 4): ₱15 saved from
      TEST entries (pay ₱20 → remit ₱20 → release ₱5 → expense ₱5), roster student TEST-0001 "TEST Student",
      test treasurer account. Ask Neil, then admin_adjust −₱15 saved "TEST cleanup" + deactivate TEST-0001.
- [x] Become the first admin: with the dev server running (`npm run dev` in `E-CFunds`), open
      http://localhost:3000 → "Create an account" with your Claude-account Gmail → open the confirmation
      email on this PC → you land back signed in as SAS Admin. Then tell Claude "I'm in".
      If the email link opens a page that won't load: Supabase → Authentication → URL Configuration →
      Site URL `http://localhost:3000`, and add `http://localhost:3000/**` under Redirect URLs.

- [ ] Decide: Supabase advisor warns "Leaked password protection disabled" (Authentication → Passwords). Claude believes
      it needs a paid plan; check the switch in the dashboard — if it's free to turn on, turn it on.
- [ ] BEFORE REAL USE also remove the test student account (TEST-0001, 3rd email) with the JOES test data above.

- If the app shows "Loading…" forever and Supabase answers 521/522: Supabase dashboard → e-cfunds → Project Settings
      → General → Restart project (happened once, 2026-11-13 01:03 Manila; data intact after restart).

## Phase 6 (AI chatbot + keep-alive) — DONE 2026-11-13
- [x] Added the Gemini key as Supabase secret `GEMINI_API_KEY` (session 4) — assistant is live.
- [x] GitHub variable `SUPABASE_PUBLISHABLE_KEY` added, PR #2 merged, keep-alive run verified (session 4)

## Phase 7 (installable app + Android APK) — now
- [x] Signing key made by Claude (2026-11-13) in `Documents\E-CFunds-signing` on Neil's PC (random password in
      a .txt there; SHA-256 fingerprint starts 0D:58:C9:73). [ ] Neil: back up that whole folder (Google Drive/USB).
- [ ] GitHub → E-CFunds → Settings → Secrets and variables → Actions → New repository secret, 4 times:
      `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= ecfunds), `ANDROID_KEY_PASSWORD`
- [ ] Actions → "Build Android app" → Run workflow (branch main after merge) → download the APK artifact →
      install on your phone (allow "Install unknown apps" for your browser/Files) → try: sign in with email and
      Student ID, dashboard, export a PDF (share sheet), Ask E-CFunds, airplane mode (offline pill)
- Note: `npm audit` shows 10 moderate/low issues only in BUILD tools (@capacitor/assets, vite-plugin-pwa's
  workbox-build); none ship inside the app (`npm audit --omit=dev` = 0).

## Phase 5 (Google login)
- [ ] In Google Cloud Console, add the new app's URLs to your OAuth client
      (Claude will give you the exact URLs)

## Phase 8 (Deploy)
- [ ] Add the live app address to the `student-login` function: Supabase → Edge Functions → Secrets →
      `ALLOWED_ORIGINS` = `https://<the vercel address>` (Claude will give the exact value)
- [ ] Approve linking the GitHub repo to Vercel (Claude does the rest via the Vercel connector)

## Done
- [x] Name stays "Junior Operation Executive Society (JOES)"; its logo (old `OAES.png`) reads "Office Administration
      Executive Society" — swap the logo in the app if a JOES one turns up (session 4)
- [x] Dues period: Neil let Claude decide → `school_year` for all 10 (matches old system: one payment per student);
      each treasurer can switch their org to `semester` in the app (session 4)
- [x] Put the Supabase secret key in `E-CFunds/.env` (gitignored); Claude uploaded the 10 logos, 10/10 verified (session 4)
- [x] Confirmed `docs/business-rules.md`; full dues only; students see counts only (session 3)
- [x] Approved the "E-CFunds" cloud environment (session 3)
- [x] Installed plugins: supabase, Vercel, Design, frontend-design (session 3)
- [x] Approved Phase 2 mockups (session 3)
- [x] Free Supabase project `e-cfunds` created (session 3)
- [x] First admin = your Claude-account Gmail (auto-approved on first verified sign-in) (session 3)
- [x] School year dates: SAS sets them in the app (session 3)
- [x] Connected `C:\xampp\htdocs\mini system` (session 2)
- [x] Answered Phase 1 money-model questions (session 2)
- [x] Created repo `ramosneil/E-CFunds` (made PUBLIC by Neil on 2026-11-13 — anyone can read the code; never commit keys or student data)
- [x] Gave Claude's GitHub App access to the repo
- [x] Created a new Gemini key
