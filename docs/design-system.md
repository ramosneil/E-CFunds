# E-CFunds design system (Phase 2, v1, 2026-11-12)

Status: **DRAFT, waiting for Neil's approval** (Phase 2 gate).
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
