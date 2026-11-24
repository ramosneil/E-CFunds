// Welcome page v3 text (Neil, 2026-11-24). Only features E-CFunds really has (docs/business-rules.md).

export type RoleKey = 'sas' | 'treasurer' | 'student';
export const ROLES: { key: RoleKey; tab: string; title: string; device: string; points: string[]; note: string }[] = [
  { key: 'sas', tab: 'SAS', title: 'The Office of Student Affairs', device: 'On a computer or the app',
    points: ['Approve remittances, resolution requests and liquidations', 'See every organization’s cash and savings at once', 'Approve accounts, close the school year, read the activity log'],
    note: 'Every request reaches SAS with its file, and every decision is recorded with its reason.' },
  { key: 'treasurer', tab: 'Treasurer', title: 'The organization’s treasurer', device: 'On the phone app or a computer',
    points: ['Record dues by year level and section', 'Remit to SAS and send resolution requests', 'Liquidate with receipts, then print the Financial Report'],
    note: 'Each payment gets a numbered receipt the moment it is recorded.' },
  { key: 'student', tab: 'Student', title: 'Every member', device: 'On the phone app or a computer',
    points: ['Your dues for each semester, paid or to collect', 'Your receipts, ready to open', 'Where each organization’s money went'],
    note: 'Students see totals and approved spending, never other students’ names.' },
];

export const STEPS: { when: string; title: string; body: string }[] = [
  { when: 'Enrollment week', title: 'Members pay. Receipts number themselves.', body: 'The treasurer records each member’s dues by section. A receipt like SPORTSCLUB-2026-0012 is issued at once and is never reused.' },
  { when: 'After collection', title: 'Cash goes to SAS.', body: 'The treasurer remits the cash on hand. When SAS approves, it moves from cash on hand to savings with SAS.' },
  { when: 'Before the activity', title: 'One file, one request.', body: 'The treasurer attaches the signed resolution. SAS reads the amount in the file and releases it from the club’s savings.' },
  { when: 'After the activity', title: 'Receipts in, unspent back.', body: 'The treasurer lists each receipt item and attaches the files. When SAS approves, the unspent money goes back to savings.' },
  { when: 'End of semester', title: 'The report fills itself in.', body: 'Collections, every activity’s items and the totals come from the ledger, in the SAS Financial Report form, ready to sign.' },
];

export type Feature = { title: string; line: string; who: string; steps: [string, string, string] };
export const FEATURE_GROUPS: { name: string; blurb: string; items: Feature[] }[] = [
  { name: 'Treasurers', blurb: 'Members, dues and the club’s requests.', items: [
    { title: 'Members by year and section', line: 'Year cards with section tiles; tap a section to see its members.', who: 'Treasurers of clubs and organizations.', steps: ['Open Members.', 'Tap a section tile, like 3A.', 'Record a payment or open a receipt from the list.'] },
    { title: 'Dues with numbered receipts', line: 'Every payment gets its own receipt number that is never reused.', who: 'Treasurers record; members see their receipt.', steps: ['Record the payment.', 'A receipt number is issued at once.', 'An undo voids the receipt; the number is never given again.'] },
    { title: 'Remit to SAS', line: 'Move cash on hand into savings with SAS.', who: 'Treasurers send; SAS approves.', steps: ['Type the amount and send it.', 'SAS approves or rejects with a reason.', 'Approved money shows as Saved with SAS.'] },
    { title: 'Resolution requests', line: 'Attach the signed resolution; SAS releases the amount written in it.', who: 'Treasurers file; SAS decides.', steps: ['Attach the resolution file.', 'SAS opens it and types the amount.', 'The amount moves from savings to cash on hand.'] },
    { title: 'Liquidation with receipt items', line: 'Activity name, items and files; the amount spent adds itself up.', who: 'Treasurers liquidate; SAS checks.', steps: ['Type the activity name and each receipt item.', 'Attach the receipts and send.', 'On approval, unspent money returns to savings.'] },
    { title: 'Remind unpaid members', line: 'One tap sends a reminder to members who still owe dues.', who: 'Treasurers.', steps: ['Open Members.', 'Tap Remind unpaid.', 'Members who still owe get a notification.'] },
  ] },
  { name: 'SAS', blurb: 'Approvals and the whole school at a glance.', items: [
    { title: 'Approvals in one place', line: 'Remittances, resolution requests, liquidations and new accounts.', who: 'The SAS admin.', steps: ['Open Approvals.', 'Open the file or the receipts.', 'Approve, or reject with a reason the treasurer sees.'] },
    { title: 'Every organization’s funds', line: 'Cash on hand, savings and dues progress for each org and club.', who: 'The SAS admin.', steps: ['Open the Dashboard.', 'Read cash and savings per organization.', 'Open an organization for its ledger and charts.'] },
    { title: 'Close and reopen the school year', line: 'A checklist before closing; reopening needs a reason.', who: 'The SAS admin.', steps: ['Open the organization.', 'Check the list: no cash left, nothing pending.', 'Close the year; reopen later with a written reason.'] },
    { title: 'Student list and import', line: 'Import the list from Excel or CSV, or add a late enrollee.', who: 'The SAS admin.', steps: ['Open Students.', 'Import the file or add one student.', 'New accounts match against this list.'] },
    { title: 'Messages and announcements', line: 'One conversation per organization, and announcements to all.', who: 'SAS and treasurers.', steps: ['Open Messages.', 'Pick an organization or write an announcement.', 'The other side gets a notification.'] },
  ] },
  { name: 'Students', blurb: 'What you owe, what you paid, where it went.', items: [
    { title: 'My dues', line: 'Each semester’s dues per organization, paid or to collect.', who: 'Students.', steps: ['Sign in.', 'Read your dues on Home.', 'Pay your treasurer; it updates when recorded.'] },
    { title: 'My receipts', line: 'Open any receipt, or save it as a PDF.', who: 'Students.', steps: ['Open a paid due.', 'View the receipt.', 'Save it as a PDF if you need a copy.'] },
    { title: 'Where the money goes', line: 'Charts and approved spending for every organization.', who: 'Students.', steps: ['Open Reports.', 'Pick an organization.', 'See collections, approved expenses and what is left.'] },
  ] },
  { name: 'Reports and exports', blurb: 'Paperwork that writes itself.', items: [
    { title: 'Financial Report in the SAS form', line: 'Activities, items, totals and signatories, as a PDF.', who: 'Treasurers and SAS.', steps: ['Open Financial report.', 'Count the cash on hand.', 'Download the PDF, ready to sign.'] },
    { title: 'Member list PDF', line: 'All members, one year level or one section, ready to print.', who: 'Treasurers.', steps: ['Open Members.', 'Pick all, a year, or a section.', 'Download the print-ready PDF.'] },
    { title: 'Summaries and backups', line: 'Summary reports, CSV files and a full Excel backup for SAS.', who: 'Treasurers and SAS.', steps: ['Open Export.', 'Pick the report.', 'Save it to your device.'] },
  ] },
  { name: 'Trust and security', blurb: 'Records nobody can quietly change.', items: [
    { title: 'A ledger nobody can quietly edit', line: 'Mistakes are corrected with a reversal, never by editing.', who: 'Everyone, automatically.', steps: ['Every peso is one ledger entry.', 'Entries are never edited or deleted.', 'A correction is a new, visible reversal.'] },
    { title: 'Every account approved by SAS', line: 'Students must match the school’s list before they get in.', who: 'Everyone who signs up.', steps: ['Create an account.', 'SAS checks it against the list.', 'Once approved, you see your role’s screens.'] },
    { title: 'Each role sees only its own data', line: 'Rules in the database decide what every account can read.', who: 'Everyone, automatically.', steps: ['You sign in.', 'The database checks your role.', 'You see only what your role may see.'] },
    { title: 'Activity log', line: 'Every change in plain words, recorded automatically.', who: 'The SAS admin.', steps: ['Open Activity log.', 'Filter by person, date or kind.', 'Open an entry to see what changed.'] },
  ] },
  { name: 'The app', blurb: 'On every phone, and up to date.', items: [
    { title: 'Android app with notifications', line: 'Notifications arrive even when the app is closed.', who: 'Everyone on Android.', steps: ['Get the Android app.', 'Sign in and allow notifications.', 'Requests, decisions and messages reach your phone.'] },
    { title: 'Updates itself', line: 'New versions install on their own, no new download.', who: 'Everyone on Android.', steps: ['Open the app.', 'A new version downloads by itself.', 'It is ready the next time you open it.'] },
    { title: 'iPhone Home Screen app', line: 'Add the website to the Home Screen for a full-screen app.', who: 'iPhone users.', steps: ['Open the site in Safari.', 'Share, then Add to Home Screen.', 'Open E-CFunds from the Home Screen.'] },
    { title: 'Ask E-CFunds', line: 'An assistant that answers from the data your role can see.', who: 'Everyone.', steps: ['Tap Ask E-CFunds.', 'Ask in plain words.', 'It answers from your own records.'] },
  ] },
];
