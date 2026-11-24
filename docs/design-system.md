# E-CFunds design system (Phase 2, v1, 2026-11-12)

Status: **APPROVED by Neil (session 3)**.
Mockups (light + dark, phone + desktop): https://claude.ai/artifact/DQn6L6aa9LUd4QXeP7vsGF (private, Neil's account)
Self-check: `node scripts/phase2-design-check.js` (34/34 contrast pairs ≥ 4.5:1, 13/13 money checks).

## 1. Idea
Royal blue = trust and the SAS (saved money). Gold = cash the treasurer holds.
The **two-pocket bar** (gold = cash on hand, blue = saved with SAS) appears on every money card,
so the rule "remit/release move money between pockets, total unchanged" is visible at a glance.
Request screens always show an **"If approved"** preview: each pocket before → after, and the total.

## 2. Color tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| bg | `#F4F6FB` | `#080D1C` | page background |
| surface | `#FFFFFF` | `#111934` | cards, sheets |
| surface2 | `#E6EAF3` | `#18223F` | segmented controls, track fills, inset rows |
| border | `#DDE2EE` | `#25304F` | 1 px card borders, dividers |
| text | `#0D1530` | `#EDF0FA` | primary text |
| muted | `#566080` | `#9BA6C6` | secondary text, labels |
| primary (royal blue) | `#1D3FAF` | `#8AA4FF` | primary buttons, links, active nav, saved pocket |
| primarySoft | `#E6ECFB` | `#1B2A5A` | blue tint chips / icon tiles |
| onPrimary | `#FFFFFF` | `#0A1233` | text on primary buttons |
| gold | `#E0A82E` | `#F0C14B` | cash pocket, "Record payment" button (text `#1A1300`) |
| goldText / goldSoft | `#875F0B` / `#FBF2DC` | `#F0C14B` / `#3A2F12` | gold chips |
| ok / okSoft | `#13774A` / `#E2F4EA` | `#4CD38A` / `#0F3324` | Paid, Approved, collections |
| warn / warnSoft | `#9A5B00` / `#FDF0DA` | `#F2B045` / `#3A2A0C` | Pending |
| bad / badSoft | `#B42318` / `#FDE8E6` | `#FF8A80` / `#3E1614` | Unpaid, Rejected, expenses |
| hero / heroMuted | `#13297A` / `#C9D4F7` | `#1A2C78` / `#B9C6F5` | total-fund hero card |
| Pocket bar | cash `#F0C14B`, saved `#8AA4FF` on hero | same | two-pocket bar on the hero card |

Status is never color-only: chips always carry a word (Paid, Pending, Rejected).

## 3. Type
- Headings: **Plus Jakarta Sans** 700–800. Body/UI: **Inter** 400–700.
- Scale: Display 32–40 · Title 20/28 · Section 17–18 · Body 15/22 · Caption 13/18 · Micro label 12 (uppercase, 0.06–0.08em tracking).
- **All money uses tabular figures** (`font-variant-numeric: tabular-nums`), `₱` + 2 decimals (`₱4,260.00`). Signs: `+₱20.00`, `−₱200.00` (true minus sign).

## 4. Layout & shape
- 4 px grid. Phone gutter 20 px. Cards gap 10–18 px.
- Radius: 12 (inputs, small tiles) · 14–16 (buttons, rows) · 18–24 (cards) · 999 (chips, bars).
- Touch targets ≥ 44 px (buttons 48, primary CTA 54). Bottom nav 76 px, 4–5 items, active item = blue pill.
- Desktop: 220–260 px sidebar + fluid content; tables scroll inside their own box on small screens.

## 5. Components (as drawn in the mockups)
Hero money card · two-pocket bar · stat tile · request row (icon tile, title, sub, amount, chip) ·
expanded approval card with "If approved" preview + Approve/Reject · segmented control ·
amount input (large, tabular) · file attachment row · dues progress bar with counts ·
report line list · bottom nav · desktop sidebar + data table.

## 6. Screens in the mockups (sample data, same imaginary year everywhere)
| Role | Screens |
|---|---|
| SAS Admin (phone) | Dashboard, Approvals |
| Treasurer — JOES (phone) | Home, New request (release) |
| Student (phone) | Home (my dues + school summary + reports), Org report |
| SAS Admin (desktop) | Dashboard with funds table + approvals panel |
Each screen exists in light and dark. Students see counts only ("53 of 80 paid"), never who paid,
and no transaction-level ledger (business-rules §3, §8).

## 7. Theme behavior
Default follows the phone/OS setting; a manual toggle (sun/moon) overrides and is remembered per device.

## 8. Welcome page (2026-11-24, approved by Neil)
- `src/pages/auth/Welcome.tsx`: desktop landing (lg+) and a one-screen phone welcome (hero blue, gold Sign in, outline
  Create account, buttons at the bottom). `SampleFundCard` and `LegalFooter` live in `AuthLayout.tsx`.
- Example numbers are always labelled "Example". Sign in ⇄ Create account switch = blue pill like `Segmented`.
- Checked: phone 375, tablet 768, desktop 1440, light + dark, keyboard focus ring on every link.

## 9. Welcome v2 — navy and gold (2026-11-24, Neil: "business-like, at its best for deployment")
- Signed-out screens only (inner pages next round). Ground `.lux-ground` (navy #0A1747 → #13297A → #1D3FAF with a
  gold light top right and a blue light bottom left) + `.lux-grid` (faint ledger grid); gold gradient text and buttons
  (`.lux-gold-text`, `.lux-gold-btn`); buttons step on hover and press on click (`.lux-press`); the hero enters once
  (`.lux-enter`, rests under reduced motion; `.lux-entered` shows everything after 1.2 s whatever happens).
- Product visuals in `src/pages/auth/landing.tsx`: the SAS dashboard in an app window, a receipt chip, the Financial
  Report form, the treasurer's Home in a phone. Example numbers only, each marked "Example". No photographs (campus
  photos only from SAS / the school, with permission).
- Desktop landing: hero (app window + receipt) with 4 trust points → How it works (gold numbered steps) → Who it's for
  (a UI row per role) → Reports (dark band + report) → Mobile app (phone) → closing call + footer.
- Phone / app: gradient welcome with the example fund card (hidden under 700 px tall); sign-in screens get a gradient
  band with the title and the form on a sheet. Checked 375 / 768 / 1024 / 1440, light and dark, keyboard.

## 10. Signed-in pages — navy and gold (2026-11-24, plan approved by Neil)
- Done through the shared parts, so every page follows: `Shell.tsx` (navy gradient sidebar `.lux-side` with a gold
  bar on the active item; school-year chip on computers; navy phone top bar `.lux-topbar` with light icons; bottom
  menu active pill = blue gradient), `ui.tsx` (`Button` primary = `.lux-primary` gradient, gold = `.lux-gold-btn`,
  every button `.lux-press`; `Card`/`Stat` soft shadow `.lux-card`, `Stat` tone dot; `HeroCard` = `.lux-ground` +
  grid; `Sheet` grab handle + shadow; `PageHeader` larger + optional `eyebrow`; `Greeting`), `Segmented` active =
  `.lux-primary`.
- Home screens: greeting line (Manila time); treasurer quick actions as tiles (Record payment gold); SAS funds table
  tinted header + row hover; student "Hi, Neil" in normal case.
- Focus ring on navy areas is gold. Checked: SAS, treasurer, student home + Approvals + Requests at 412 / 1366, light
  and dark; keyboard Tab through the sidebar.

## 11. Welcome page v3 — dark and bold (2026-11-24, after Neil's reference corefitness-site.vercel.app)
- Welcome page only (sign-in and signed-in pages unchanged), dark all the way: `.lux-night` (near-black navy + faint
  gold/blue specks). Patterns borrowed, not assets: heavy uppercase headlines, the product in a royal-blue tablet frame
  (`DeviceFrame`) with the phone, big rounded stages (`.lux-stage` / `.lux-inset`) — role tabs (SAS / Treasurer /
  Student), a statement that lights up word by word on scroll (`.lux-word`, all lit under reduced motion), "One semester
  at a club" timeline (5 steps, plays itself with Pause, stops off-screen and under reduced motion), a searchable feature
  list (`welcomeContent.ts`, 25 real features), a reading-progress line, closing call. No mascots, no purple/orange.
- Buttons: gold `.lux-gold-btn`, royal `.lux-royal` (same in both themes). Android app: one-screen welcome on `.lux-night`.
- Checked 320 / 390 / 412 / 768 / 1024 / 1440 (no sideways scroll), keyboard tabs (arrows), focus ring gold.

## 12. The app in the welcome page's style (2026-11-24, Neil: dark by default, bold titles, calm content)
- **Dark by default**: `index.html` sets `data-theme` to the saved choice or `dark`; `theme.ts` `getTheme()` → `dark`.
  The sun/moon button still switches to light, and a saved light choice wins.
- Dark tokens = the welcome page: bg `#060B1E`, surface `#0D1533`, surface2 `#152049`, border `#222E57`, text
  `#EEF1FB`, muted `#A9B5DA` (contrast check `frontend/scripts/phase2-design-check.js`: all pass). Dark page background
  carries the faint gold/blue specks; main buttons, tab pills, the bottom-menu pill and the Ask button are royal blue
  with white text in dark; cards get the panels' soft top light.
- **Bold titles**: `.lux-title` (uppercase Plus Jakarta 800) on `PageHeader` and the treasurer Home title; section
  titles, tables, forms and lists keep normal case. `PageHeader` buttons wrap under the title on narrow phones.

## 13. New logo and brand colours (2026-11-24, Neil's logo sheet "E-CFunds Logo.pdf"); OMSC is now OMSU
- **Logo**: the gold ₱ coin on an OMSU-navy rounded tile (`src/components/BrandMark.tsx`, same drawing as
  `public/icon.svg`) + the wordmark "E-CFunds" with a gold dash (`Brand` in `AuthLayout.tsx`): navy on light; "E-C"
  white and "Funds" gold on dark/navy (`--brand-ink`, `--brand-funds`). Web icons regenerated (`npx pwa-assets-generator`);
  Android icon + splash regenerated (`node scripts/make-app-assets.mjs` → `npx capacitor-assets generate --android`) —
  they reach phones only with the next APK.
- **Colours** from the sheet: OMSU Navy `#283891` (primary, tiles), Coin Gold `#FDD20A` (gold, cash pocket, gold
  buttons), Night `#0E1640` (dark page, welcome ground, theme colour), Paper `#FBFAF6` (light page). Dark surfaces sit
  lighter than Night: surface `#151F55`, surface2 `#1C2864`, border `#2C3A78`. Contrast check passes.
- **Names**: every visible "OMSC" → "OMSU" and "Occidental Mindoro State College" → "…State University" (app, PDFs,
  Privacy/Terms, assistant, email templates in docs/). Not changed on purpose: the Android app id and sign-in link
  `ph.edu.omsc.ecfunds` (changing them breaks installed apps and Google sign-in) and the school
  website/email addresses (SAS edits those on the School year page).
- **Seal** (2026-11-24, Neil's file): every PDF letterhead (Financial Report and all other exports, every org/club)
  uses the OMSU seal `frontend/public/brand/omsu-seal.png` (600 px, round, transparent). Org/club logos are their own.

## 14. Fold boxes, clear buttons, course/section boxes (2026-11-25)
- `FoldCard` (ui.tsx): title + "Hide/Show" (chevron, aria-expanded, 44px) on the first line; actions (Clear all, All ›)
  beside it on desktop, on their own line on phones; `flush` for full-width lists. Fold state in localStorage.
- `ClearButton` (×, 44px, muted → red on hover) and `ClearAllButton` (text) — clearing only hides for that person.
- Course cards with section boxes reuse the Members tile (surface2, 14px radius, bold 17px label, count, paid bar on
  Members); 2 columns on phones, 3 on tablets, 5 on desktop (one row = A–E).
