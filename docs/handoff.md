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

## Session 6 — school web address + own email sender (Neil + OMSC IT)
Claude already registered `ecfunds.omsc.edu.ph` in Vercel (2026-11-14). The letter for IT is `docs/it-request.md`.

### A. Make the Resend account (about 10 minutes) — do this first, so IT gets one request
1. Open **https://resend.com** → **Sign up** → **Continue with Google** (use the SAS/your Gmail).
2. Left menu → **Domains** → **Add Domain**.
3. Domain: `ecfunds.omsc.edu.ph`. Region: pick the one closest to the Philippines (Tokyo, if listed). → **Add**.
4. Resend shows a table of DNS records (usually 1 **MX** and 2 **TXT**). Leave that page open.
5. Open `docs/it-request.md` (in VS Code or Notepad). In section **2. Email sending**, replace the placeholder row
   with each record: **Type**, **Name**, **Value**, and **Priority** (only the MX has one). Copy with Resend's copy
   buttons — one wrong letter breaks it. Save the file.
6. Tell Claude "Resend records added" — Claude checks the letter before you send it.

### B. Send the letter to OMSC IT
1. Copy the part of `docs/it-request.md` between the two lines into an email to the IT / MIS office.
2. When IT replies that it's done, tell Claude "IT done". Claude checks the website records and switches the app.

### C. After IT is done (Claude tells you when)
1. **Resend** → Domains → `ecfunds.omsc.edu.ph` → **Verify DNS Records** → all should turn green ("Verified").
2. **Resend** → **API Keys** → **Create API Key** → Name `E-CFunds Supabase`, Permission **Sending access**,
   Domain `ecfunds.omsc.edu.ph` → **Add** → **Copy** the key (it's shown only once). Don't paste it in chat.
3. **Supabase** → project `e-cfunds` → **Authentication** → **Emails** (or Settings) → **SMTP Settings** →
   turn on **Enable custom SMTP** and fill in:
   - Sender email: `no-reply@ecfunds.omsc.edu.ph` · Sender name: `E-CFunds`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: paste the API key
   → **Save**.
4. **Supabase** → **Authentication** → **URL Configuration**:
   - Site URL: `https://ecfunds.omsc.edu.ph`
   - Redirect URLs → **Add URL**: `https://ecfunds.omsc.edu.ph/**` (keep all the old ones) → **Save**.
5. Email templates: Claude put ready designs in `docs/email-templates/` — steps are in that folder's README.
6. Test: on the new address, **Forgot password?** with your email → the email should come from
   `no-reply@ecfunds.omsc.edu.ph`. Tell Claude what you see.
