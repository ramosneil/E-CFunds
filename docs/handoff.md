# Handoff — things only Neil can do

Claude works through the phases on its own. This list is what it can't do itself.
Update it every session: tick done items, add new ones.

## Phase 4: data migration — DONE 2026-11-12 (nothing left for Neil)

## Phase 5 (app) — now
- [x] JOES TEST data + TEST-0001 wiped (Neil chose full wipe, 2026-11-13)
- [x] Become the first admin: with the dev server running (`npm run dev` in `E-CFunds`), open
      http://localhost:3000 → "Create an account" with your Claude-account Gmail → open the confirmation
      email on this PC → you land back signed in as SAS Admin. Then tell Claude "I'm in".
      If the email link opens a page that won't load: Supabase → Authentication → URL Configuration →
      Site URL `http://localhost:3000`, and add `http://localhost:3000/**` under Redirect URLs.

- [x] Leaked-password protection: Pro plan only (Supabase docs) → stays off on Free; app requires 8+ characters
- [x] Test treasurer, test student and rejected sign-up accounts deleted (Neil approved, 2026-11-13)

- If the app shows "Loading…" forever and Supabase answers 521/522: Supabase dashboard → e-cfunds → Project Settings
      → General → Restart project (happened once, 2026-11-13 01:03 Manila; data intact after restart).

## Phase 6 (AI chatbot + keep-alive) — DONE 2026-11-13
- [x] Added the Gemini key as Supabase secret `GEMINI_API_KEY` (session 4) — assistant is live.
- [x] GitHub variable `SUPABASE_PUBLISHABLE_KEY` added, PR #2 merged, keep-alive run verified (session 4)

## Phase 7 (installable app + Android APK) — DONE 2026-11-13
- [x] Signing key made by Claude (2026-11-13) in `Documents\E-CFunds-signing` on Neil's PC (random password in
      a .txt there; SHA-256 fingerprint starts 0D:58:C9:73). [ ] Neil: back up that whole folder (Google Drive/USB).
- [x] 4 ANDROID_* secrets added (2026-11-13). First signed build: tag v0.7.0-beta.4, run #4, APK fingerprint matches the key.
      Re-paste tip: open the .txt in Notepad → Ctrl+A, Ctrl+C (the clipboard command pasted itself the first time).
- [x] Installed the signed APK (v0.7.0-beta.4) on Neil's phone — works (2026-11-13)
- [x] Merge PR phase-7-pwa → main on GitHub (PR #3, 2026-11-13)
- Note: `npm audit` shows 10 moderate/low issues only in BUILD tools (@capacitor/assets, vite-plugin-pwa's
  workbox-build); none ship inside the app (`npm audit --omit=dev` = 0).

## Phase 8 (live site + Google) — 2026-11-13
- [x] Approved Vercel connector access; installed Vercel's GitHub app (all repos — can narrow to E-CFunds:
      GitHub → Settings → Applications → Vercel → Configure)
- [x] Supabase URL Configuration: Site URL https://e-cfunds.vercel.app + 4 redirect URLs
- [x] Google Cloud project E-CFunds, OAuth web client, Google provider ON in Supabase; Neil's Gmail = test user
- [x] Google app published (Claude filled Branding: home page + privacy link, then Publish → In production)
- [x] Installed v0.8.0 over 0.7 from the site's "Get the Android app"; Google sign-in inside the app works (2026-11-13)
- [x] Merge phase-8-deploy → main (merged from this PC on Neil's OK, 2026-11-13)

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
