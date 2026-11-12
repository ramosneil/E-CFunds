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

## Phase 6 (AI chatbot)
- [ ] Add your NEW Gemini key as a Supabase secret named `GEMINI_API_KEY`
      (Supabase dashboard → Project Settings → Edge Functions → Secrets). Never paste it in chat.

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
- [x] Created private repo `ramosneil/E-CFunds`
- [x] Gave Claude's GitHub App access to the repo
- [x] Created a new Gemini key
