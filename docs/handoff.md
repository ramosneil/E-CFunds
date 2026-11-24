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

## Session 6 — school web address + own email sender — CANCELLED by Neil (2026-11-14)
E-CFunds stays on **https://e-cfunds.vercel.app** with Supabase's built-in email sender ("too complicated" — OMSC IT
had not added the DNS records). Undone by Claude: `ecfunds.omsc.edu.ph` removed from Resend, the IT Gmail draft
discarded, `docs/it-request.md` deleted (still in git history), push VAPID contact set to the vercel.app address.
[x] Neil turned on Vercel 2FA (authenticator app); Claude then removed `ecfunds.omsc.edu.ph` from the Vercel project
    — only `e-cfunds.vercel.app` is left (2026-11-14).
Optional, works with the built-in sender too: branded email templates in `docs/email-templates/`.

## Session 7 — please check on your phone (2026-11-15)
Nothing to install or sign in to. When you have time, as the **treasurer** and **student** accounts:
1. **Student → Home → My dues →** a paid fee shows **View receipt** → open it → **Download PDF**.
2. **Treasurer → Members:** paid rows show "Receipt SSG-2026-…". The card at the top has **Remind unpaid · N** —
   press it only if you want the unpaid students to get a note (once a day).
3. **Treasurer → Requests → Budgets → New budget:** try a small test budget (or tell Claude not to).
   SAS approves it in **Approvals → Budgets**. A **release request now needs an approved budget**.
4. **SAS → Students → Import:** download the Excel template, fill it with the registrar's list, upload.
   Check the preview (it lists any bad lines) before pressing Import.
5. Heads-up: **every Monday 8:00 AM** an automatic unpaid-dues reminder goes out to students with an account
   (the first one is tomorrow, Mon Nov 16). Say if you want it off.

## Financial Report — one-time setup (2026-11-15)
1. **SAS → School year →** bottom card "Financial report — header & SAS Coordinator": type the SAS Coordinator's
   name (e.g. Cristina A. Caponpon, PhD) → Save. Check the website / email / phone lines.
2. **Each treasurer → Home → Financial report →** fill Mayor (or President/Governor), Auditor, Adviser once — they are
   saved for the school year. The **SSG treasurer** must do this too: SSG's Governor + Auditor print on every report.
3. From now on, expenses ask for the receipt's items — that's what fills the report's tables.
4. Try one: Home → Financial report → type the cash count → Download PDF. Compare with the old Excel form.

## Sign-in check on the Android app (2026-11-15) — DONE: Neil confirmed Google sign-in lands on the Dashboard
1. Open the app → it updates itself ("E-CFunds was updated"), close and reopen once if asked.
2. Sign out (My account → Sign out), then **Continue with Google** → you should land on your dashboard.
3. If it still shows the start screen, send Claude a screenshot of it.

## Password reset by 6-digit code — send emails through a Gmail (Neil, 2026-11-15) — DONE (SMTP on, template pasted, code email tested). Optional later: switch the sender to a separate SAS/E-CFunds Gmail (same steps).
Why: Supabase's free built-in email can only send a link and its templates can't be edited. Sending through a
Gmail ("custom SMTP") unlocks the code email, our E-CFunds email designs, and a higher hourly email limit.
Only you do steps 1–3 (they involve your Google password and a secret app password — never paste them in chat).
1. **Pick the Gmail** that will send E-CFunds emails (best: a separate one for SAS/E-CFunds, not your personal one).
   Sign in to it in Chrome.
2. **Turn on 2-Step Verification** for it: myaccount.google.com → Security → 2-Step Verification → Turn on.
3. **Create an App password:** myaccount.google.com/apppasswords → name it `E-CFunds` → Create → Google shows a
   16-letter password. Keep that page open (don't screenshot it).
4. **Paste it into Supabase:** supabase.com → project `e-cfunds` → Authentication → Emails → **SMTP Settings** →
   turn on **Enable custom SMTP** and fill in:
   - Sender email: the Gmail from step 1 · Sender name: `E-CFunds`
   - Host: `smtp.gmail.com` · Port: `465`
   - Username: the same Gmail · Password: the 16-letter app password (spaces don't matter)
   - **Save**. Then close the app-password page.
5. Tell Claude "SMTP done". Claude then (with your OK, already given) pastes the code template into
   Reset password, deploys the code screen, and sends one test code to nirrukurisuchan@gmail.com.

## Phone checks — sections, import, auto updates, Back, auto log out (2026-11-15)
0. **Sign in again in Chrome** (the first auto-log-out version signed you out by mistake; fixed).
1. Treasurer (club) → Members → **Add member**: all fields show at once; type a Student ID that's on the list → the
   name fills in. Pick Year + Section → the member appears under e.g. **2B**.
2. Treasurer (club) → Members → **Import** → Excel template → fill a few rows (with Section) → preview → Add.
3. Android app: **Back** on Home → "Log out of E-CFunds?" → Stay / Log out.
4. Android app: press **Home**, wait 5+ minutes, open E-CFunds → signed out, and a notification still arrives
   for that account afterwards.
5. Pull down on any page → spinner → numbers refresh. Updates now arrive by themselves (no "Check for updates").

## After the system check (2026-11-17)
1. DONE 2026-11-17 15:50 (Claude, at Neil's request): Sports Club reopened, reason "Closed by mistake during testing"; Christian jay Perucho approved again. — **Sports Club 2026–2027 was closed on Nov 16** (it turned off Christian jay Perucho's treasurer account). If that was
   a test: SAS → Orgs & clubs → Sports Club → **Reopen 2026–2027** → type the reason. His account comes back.
2. DONE 2026-11-17 (Claude, Neil's request): SAS Coordinator = Cristina A. Caponpon, PhD (from Neil's FR sample). — School year page → fill in the **SAS Coordinator** name (Financial Report "Verified by").
3. Accredited list: every entry is **Expired** (2024–2025) — add this year's accreditations.
4. Phone: tap a notification while signed out → sign in → it should open what the notification was about.

## Phone checks after the 2026-11-17 update (app updates itself)
1. **Notifications**: everyone (students, treasurers) opens the updated app and signs in once, then allows notifications
   — that registers the phone. After that they arrive even when the app is closed or signed out.
2. With the app **open**, a new notification should also appear in the phone's notification shade.
3. **Back on the Dashboard** → "Log out of E-CFunds?" shows right away and the app stays open (Stay / Log out).
4. New budget → Send to SAS → the question appears on top (no Back needed).
5. Liquidate → Attach files → send; SAS sees the files on the budget card.

### Phone test results (2026-11-17, with Neil, SAS admin + SSG treasurer on Android)
- Passed: new version loads (fund card Cash on hand + Saved with SAS, no total; header row); Back on Dashboard asks Log out? and the app stays open; inner pages go back one page; push notifications arrive with the app **open** (in the notification list), **closed**, and **signed out** (server: sent 2 each); New budget → Send to SAS question on top (SSG test budget "Hsjshs" ₱10 reached SAS + notification); 5-minute auto logout.
- Liquidate → Attach files: passed on the phone 2026-11-17 22:57 (Sports Club "Gggaha", 1 PDF 465 KB stored under 7/liq-8/; SAS can read it, SSG treasurer cannot; SAS notified). Returned as "Test only" → no money moved. The SSG test budget "Hsjshs" was cancelled by the treasurer.

## Phone checks after the 2026-11-20 update (resolution requests)
1. Treasurer → Requests → **Resolution request** → attach the resolution file → Send. SAS → Approvals → open the file,
   type the amount → Approve. Treasurer's **Saved with SAS** goes down and **Cash on hand** goes up by that amount.
   (Use a small real resolution, or Reject it with a reason if it's only a test — reject moves no money.)
2. On the approved resolution → **Liquidate** → attach receipts + type the amount spent → SAS approves or returns.
3. Bell: delete one notification, then **Delete all**; tap a notification → it opens that exact request/receipt.
4. Members → tap a section tile → its list pops up; PDF for all / one year / one section prints cleanly.
5. Financial Report: club shows no Mayor line; org shows Mayor; fill in auditor/adviser names if blank.

## Project folders changed (2026-11-20)
- The app now lives in `frontend/`: run `npm run dev` inside `C:\xampp\htdocs\E-CFunds\frontend`. If you use Android Studio, open `frontend\android` (the old `android` folder is gone).

## Phone check — liquidation items (2026-11-20) — DONE 2026-11-24: liquidation #54 with items approved; Neil saw the activity and its items in the Financial Report PDF on his phone
1. Treasurer → Requests → an approved resolution → **Liquidate**: type the activity name, add each receipt item (the amount spent fills itself), attach the receipts → Send.
2. SAS → Approvals: the liquidation card shows the activity name and the items → Approve (or Return).
3. Financial report → Download PDF: the activity appears as a salmon heading with its items and Sub Total, like the SAS spreadsheet.
4. School year page: type the real **SSG governor** and **SSG auditor** names → Save (they print on every report).

## Phone check — welcome page (2026-11-24)
1. On a phone that never used E-CFunds (or after clearing the browser's site data): the blue welcome screen shows, with Sign in and Create an account at the bottom.
2. Tap Sign in → the Sign in ⇄ Create account switch is at the top; switching works.
3. In the Android app after it updates: sign out → you land on Sign in (this phone has signed in before), and the logo opens the welcome screen.

## Phone check — new look inside the app (2026-11-24)
1. Open the app (it updates itself), sign in: navy top bar, greeting, gradient fund card, blue pill on the active bottom-menu item.
2. Open Members, Requests, Messages, Reports and a pop-up (e.g. Record payment): everything works as before, only the look changed.

## Phone check — dark app (2026-11-24) — DONE: Neil confirmed on his phone (updated, dark, everything works)
1. After the app updates, it opens dark. The sun button in the top bar switches to light (and stays light).
2. Page titles are big and uppercase (DASHBOARD, MEMBERS…); everything else works as before.

## After the OMSU / new logo change (2026-11-24)
1. **Android app icon** — DONE 2026-11-24: release v1.1.2 (build 12) published with the new coin icon and splash. On each phone: download E-CFunds.apk from the website (Get the Android app) and install it over the old app; accounts and data stay.
2. **Email templates** in Supabase (Authentication → Email Templates) still say "OMSC Mamburao" at the bottom. The fixed copies are in docs/email-templates/; paste them in (or let Claude do it in your Chrome).
3. If the school has a new **OMSU seal**, send the image: the PDF letterhead still uses the old seal picture.
4. If the website/email changed to omsu addresses, edit them on the School year page.
