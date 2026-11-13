# E-CFunds — Business Rules (Phase 1)

Status: **CONFIRMED v1, 2026-11-12** (Neil approved in session 3; Phase 1 gate passed).
Source: the old PHP system (`C:\xampp\htdocs\mini system`), read line by line, plus Neil's answers on 2026-11-12.
Self-check: `scripts/phase1-rules-check.sql` (all checks pass; see §9).

---

## 1. The money model in one paragraph
Each org/club has one **capital fund**: the student dues it collects. The fund sits in two pockets.
**Cash on hand** is money the treasurer is holding. **Saved with SAS** is money the treasurer has
remitted, which SAS keeps for the org/club and its future officers. Remittances and releases only
move money between the two pockets, so they never change the org's total. Only collections
(+) and approved expenses (−) change the total. At the end of the school year, all cash must be remitted.
The saved amount then becomes the next officers' **Previous Funds**.

```
             collection (+)                      remittance (cash → saved)
 students ─────────────────►  CASH ON HAND  ─────────────────────────────►  SAVED WITH SAS
                              (treasurer)   ◄─────────────────────────────  (for next officers)
                                   │            release (saved → cash),
                                   │            budget-based, SAS approves
                                   ▼
                     expense (−), treasurer files with receipt, SAS approves
```

## 2. Formulas (the only ones; every screen uses these)
All values come from one append-only ledger (`ledger_entries`). Totals are never stored.

| Ledger kind | Cash on hand | Saved with SAS | Total fund |
|---|---|---|---|
| `opening` (migration only) | — | **+** | + |
| `collection` (student paid dues) | **+** | — | + |
| `remittance` (approved by SAS) | **−** | **+** | 0 |
| `release` (approved by SAS) | **+** | **−** | 0 |
| `expense` (approved by SAS) | **−** | — | − |
| `adjustment` / `reversal` (admin, with reason) | ± (one pocket) | ± (one pocket) | ± |

```
cash_on_hand    = Σcollections − Σremittances + Σreleases − Σexpenses ± cash adjustments
saved_with_sas  = Σopening + Σremittances − Σreleases ± saved adjustments
total_fund      = cash_on_hand + saved_with_sas
                = Σopening + Σcollections − Σexpenses ± adjustments
previous_funds(year Y) = total_fund at the close of year Y−1   (computed, never typed in)
```

Request limits (checked when the request is filed **and** again when SAS approves):
```
available_to_remit   = cash_on_hand − pending remittances − pending expenses
available_to_spend   = cash_on_hand − pending remittances − pending expenses
available_to_release = saved_with_sas − pending releases
```
No pocket may go below ₱0.

**School-wide summary (Admin dashboard and Student view):** the sum of the per-entity values above, plus
counts of orgs and clubs, students, paid and unpaid dues, and pending requests.

## 3. Roles & who does what
| Action | SAS Admin | Treasurer (own org/club only) | Student |
|---|---|---|---|
| Manage orgs/clubs, accredited list, approve accounts | ✅ | — | — |
| Set dues (period + amount) for the org/club | ✅ | ✅ | — |
| Add/edit/remove roster students, mark dues Paid | ✅ | ✅ | — |
| File remittance / expense / release request | — | ✅ | — |
| Approve or reject those requests | ✅ | — | — |
| Release funds directly (no request) | ✅ | — | — |
| Adjustments & reversals (with written reason) | ✅ | — | — |
| Close the school year (turnover) | ✅ | — | — |
| See transaction-level ledger | ✅ all | ✅ own | ❌ |
| See per-org/club report and school summary | ✅ | ✅ | ✅ |
| See own dues status | — | — | ✅ |
| Messaging | ✅ all treasurers / broadcast | ✅ with SAS | — |

## 4. Workflows
### 4.1 Dues & membership
- **Dues are set by each org/club** (Neil: "each org decides"). Each entity has a `dues_period`
  (`school_year` or `semester`) and a `dues_amount`. A membership is one student × entity × period,
  with its own `amount_due`, which is copied from the entity default and can be edited before payment.
- **Organizations are mandatory by course** (Neil, 2026-11-13; migration 15 `course_memberships`):
  | Course | Organizations (automatic) |
  |---|---|
  | BSIT (BS Information Technology) | SSG, PADC, LSC |
  | BEED (Bachelor of Elementary Education) | SSG, YMO, LSC |
  | BSBA OM (Operations Management) | SSG, LSC, JOES |
  | BSBA FM (Financial Management) | SSG, LSC, JFMS |
  | any other course / no course | SSG only (+ max 1 organization added by hand) |
  Whoever adds the student (any org or club treasurer), they are enrolled in SSG + their course organizations
  for the current school year, Unpaid, at each org's own dues; each org collects its own dues. A course student
  cannot join an organization outside their course. Course change: new course orgs added, unpaid old ones
  removed, paid ones kept. New school year/semester made current → everyone enrolled again.
  Rules live in `public.courses` + `public.course_orgs` (SAS can change them).
- **SSG is school-wide:** every student on the roster is automatically an SSG member every semester.
- **Fees are per SEMESTER** for every organization and club (Neil, 2026-11-13; migration 16); each treasurer sets
  their own amount. SSG + course organizations are enrolled again when SAS makes a semester current.
- **Clubs are the student's choice each semester** (max **1 club per semester**): when a semester starts, a student
  who paid a club last semester is listed in the same club again, "To collect", tagged "Carried over" (migration
  17). Staying = the club records the fee; switching = the new club adds them and the old carried listing is
  removed automatically. A club already paid this semester blocks a switch.
- **The fee is mandatory — pay when added:** a treasurer adds a member only when the student pays; Add member
  records the payment (collection line) at once. Course organizations that didn't add the student list them as
  **"To collect"** until their own treasurer records the payment.
- **Marking Paid:** the treasurer marks a membership Paid, which writes one `collection` entry
  (amount = `amount_due`, date, recorded_by). Only full payment is supported, the same as the old system.
- **Undoing Paid** (a mistake): this writes a `reversal` that cancels the collection. Nothing is deleted.
  (Old bug: switching back to Unpaid left the income row in place.)

### 4.2 Remittance (treasurer → saved with SAS)
1. The treasurer files a request: amount ≤ `available_to_remit`, plus a description. Status is `pending`.
2. SAS approves, which writes a `remittance` entry (status `approved`), or rejects with remarks (status `rejected`).
3. **When and how much to remit is each org/club's own policy.** The system enforces no schedule,
   except the turnover rule in §4.5.

### 4.3 Release (saved with SAS → treasurer), budget-based
1. The treasurer files a release request with a purpose or activity, the amount, and the budget attached.
   SAS can also release directly without a request.
2. **There is no fixed cap.** The amount depends on the budget requirement. It must be ≤ `available_to_release`.
3. SAS approves, which writes a `release` entry. Or SAS rejects with remarks.
   (Old system: a fixed lifetime cap of ₱5,000 that was checked against the wrong balance. Both are removed.)

### 4.4 Expense (treasurer spends from cash on hand)
1. The treasurer files an expense: date, description, amount ≤ `available_to_spend`, and a **receipt photo or PDF**.
2. SAS approves, which writes an `expense` entry. Or SAS rejects with remarks. Pending expenses
   reduce what can still be remitted or spent, so the cash pocket can't be overdrawn.

### 4.5 Turnover / school-year close (officer term = 1 school year)
1. Before closing, the outgoing treasurer must **remit all collected funds**: `cash_on_hand = ₱0`,
   and there are no pending requests for that org/club.
2. SAS closes the year for the org/club. The next year's `previous_funds` is computed automatically
   (= `saved_with_sas`). No balance is typed in by hand.
3. A new treasurer account is approved for the new officers. The old account loses its access.
4. Semesters still exist, for semester dues and for per-semester reports.

### 4.6 Accounts
- **Self-registration → approval.** Treasurers are approved by SAS. Students must match a roster
  student ID. (Old system: anyone could register as any org's treasurer and was logged in immediately.)
- Login: students use Google or their Student ID + password. Staff use email + password or Google.
  There are no shared default passwords. (Old system: every treasurer had the same seeded password.)

### 4.7 Accredited list (kept, improved)
- Fields: name, type (Organization/Club), adviser, academic year, accredited date, expiry, status, remarks.
- Every change and delete goes into history with the **full before-and-after record**. (Old system: an
  update logged only the id and name.)
- **Change:** status `Expired` is derived when `expiry_date` < today, so it isn't typed by hand.
  (Old data shows "Accredited" rows whose expiry dates are already past.)

### 4.8 Messaging & chatbot (kept)
- Treasurer ↔ SAS threads per org/club, broadcast to all treasurers, unread counts.
  Users can delete their own messages, and SAS can delete a whole thread.
- The AI chatbot answers from the **same views** as §2 (old chatbot computed its own totals),
  limited to what the asking role is allowed to see.

## 5. Audit & corrections
- Ledger rows are **never edited or deleted**. Corrections are `reversal`/`adjustment` rows that
  carry a reason and an actor.
- Every insert, update and delete on every table is written to `audit_log` (who, when, before, after).
- Request status changes keep `reviewed_by`, `reviewed_at` and `remarks`.

## 6. What the old system did (for the record) and why it changes
| # | Old behavior (file) | Problem | New rule |
|---|---|---|---|
| 1 | Six different "remaining funds" formulas: organization.php detail vs list, clubs.php card vs total, treasurer.php, financial.php | Screens disagree as soon as a remit, release or expense exists | One formula set (§2), used by every screen |
| 2 | Remitted money subtracted from the org's funds (organization.php, financial.php) | Contradicts the real rule: remitted money is still the org's money, saved for the next officers | Remittance = transfer to saved (§4.2) |
| 3 | Release deducts `previous_funds` **and** is added as income (organization.php); financial.php then forgets to add it back | Financial page under-reports by the amount released | Release = transfer saved → cash (§4.3) |
| 4 | ₱5,000 lifetime release cap per org/club, checked against the total balance | No cap exists in practice ("depends on budget") | Budget-based, ≤ saved (§4.3) |
| 5 | Clubs page ignores releases and remittances; org list "Rem" ignores expenses | Wrong numbers on those screens | §2 |
| 6 | Treasurer counts approved `remit_requests`; Admin counts `financial_records` Remit rows; financial.php can delete those rows | Totals drift apart after a delete | One ledger, no deletes (§5) |
| 7 | `transactions` + `financial_records` + stored `entity_funds` totals, patched by `fix_release.php`, `patch_deduct_releases.sql`, `reset_funds.php` and `set_previous_funds.php` (which hard-codes ₱10,000) | Double deductions, manual resets | Computed views only |
| 8 | Remit approval logs an **Income** transaction for the org | Wrong direction in the activity feed | Typed ledger kinds |
| 9 | Admin "Total Expenses" card = sum of fund releases | Mislabelled | Cards: Total Fund, Cash on hand, Saved with SAS, Expenses |
| 10 | Treasurers had no screen for recording expenses | Expenses only came from admin or seed data | §4.4 |
| 11 | Paid → Unpaid leaves the collection in place | Inflated income log | Reversal (§4.1) |
| 12 | Organizations are hard-deleted, clubs are soft-deleted | Inconsistent; hard delete loses history | Archive (`is_active=false`) only |
| 13 | Open self-registration as treasurer; shared seeded password; Gemini key in code | Security | §4.6, secrets in Supabase |

## 7. Data facts from the dump (`mini_system_db.sql`, generated 2026-05-10)
- 10 entities: 6 organizations (SSG, JOES, PADC, YMO, LSC, JFMS) and 4 clubs (Sports, English, Sci-Math, SamFilko).
- 11 users (1 admin, 10 treasurers), 2 messages, 10 accredited entries, 3 history rows.
- 500 student rows but only **50 distinct names**: test data made by `insert_students.php`
  (50 per entity, 27 Paid and 23 Unpaid each). Dues: SSG ₱15, JOES ₱20, PADC ₱35, YMO ₱35, LSC ₱10, the rest ₱20.
- `previous_funds` = ₱10,000 for every entity (placeholder from `set_previous_funds.php`).
- `transactions`, `financial_records`, `remit_requests` and `fund_releases` are **empty**.
- Old dashboard on this data: Total Collections **₱5,805**, Total Expenses ₱0, Financial "Total Fund" **₱105,805**.
- **Neil's decision: start fresh.** Phase 4 migrates only entities (with logos), the accredited list
  and its history, and the admin account. Test students, placeholder funds and seeded treasurer
  accounts are **not** migrated. Real rosters will be imported later (CSV/Excel import screen).

## 8. Decisions log (Neil, 2026-11-12)
| Question | Answer |
|---|---|
| Whose money is a remittance? | Still the org/club's money; saved for the next set of officers |
| Release cap | No fixed cap; depends on the budget requirement |
| Can SAS release saved money mid-term? | Yes (budget-based) |
| Turnover | Saved amount becomes the new officers' starting fund (Previous Funds) |
| Unremitted cash at turnover | Must be remitted before turnover |
| Officer term | 1 school year |
| When to remit | Each org/club's own policy |
| Who records expenses | Treasurer, SAS approves |
| Dues period | Each org decides (per year or per semester) |
| SSG | School-wide; doesn't count toward the 1-org limit |
| Data migration | Start fresh; real data later |
| Partial dues payments? (session 3) | **No.** Full amount only; a membership is Paid or Unpaid |
| Can students see who else paid? (session 3) | **No.** Students see paid/unpaid counts and their own status only |

## 9. Self-check (Phase 1 gate)
`scripts/phase1-rules-check.sql` builds a prototype ledger and the §2 views on synthetic data, then asserts:
- saved = opening + remitted − released ✔
- cash = collections − remitted + released − expenses ± adjustments ✔
- total = opening + collections − expenses (remit and release are transfers) ✔
- total = cash + saved, always ✔
- previous funds for a year = closing total of all earlier years ✔
- after the turnover remittance, cash = 0 and everything is saved ✔
- **parity:** on the dump's shape (no remits, releases or expenses), new total = old "Remaining Funds"
  (e.g. SSG ₱10,000 + ₱405 = ₱10,405). Checked for all 10 entities against the old formulas on the real dump ✔
- negative test: a planted wrong value makes the script fail ✔

Where the new numbers differ from the old ones, the old formula was a bug or contradicted §8 (see §6).

## 10. Open questions
None. Both §10 questions were answered in session 3 and moved to §8.
