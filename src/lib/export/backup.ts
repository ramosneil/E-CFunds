// Full backup for SAS: every table in one Excel workbook, one sheet each (read as SAS, so RLS lets everything through).
// Values are written as plain text/number cells — never formulas. Accounts carry no passwords or tokens (none are
// stored in these tables); the activity log is left out (it is large and lives in the database).
import { supabase } from '../supabase';
import { saveFile } from './save';
import { myName } from './pdf';

type Rec = Record<string, unknown>;
const SHEETS: [string, string, string][] = [
  // sheet name, table/view, order by
  ['Orgs & clubs', 'entities', 'id'],
  ['School years', 'school_years', 'id'],
  ['Semesters', 'semesters', 'id'],
  ['Courses', 'courses', 'sort'],
  ['Students', 'students', 'id'],
  ['Memberships', 'memberships', 'id'],
  ['Receipts', 'receipts', 'id'],
  ['Ledger', 'ledger_entries', 'id'],
  ['Requests', 'fund_requests', 'id'],
  ['Budgets', 'budget_status', 'id'],
  ['Budget items', 'budget_items', 'id'],
  ['Year closures', 'year_closures', 'closed_at'],
  ['Dues reminders', 'dues_reminders', 'id'],
  ['Accounts', 'profiles', 'created_at'],
  ['Accredited list', 'accredited_list', 'id'],
];

async function readAll(table: string, order: string): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let from = 0; ; from += 1000) {
    // Table names come from the fixed list above.
    const { data, error } = await (supabase.from(table as 'entities') as unknown as {
      select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => Promise<{ data: Rec[] | null; error: Error | null }> } };
    }).select('*').order(order).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function cell(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export async function fullBackup() {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const data = await Promise.all(SHEETS.map(([, t, o]) => readAll(t, o)));
  const orgName = new Map((data[0] as { id: number; short_name: string }[]).map((e) => [e.id, e.short_name]));
  const bold = (v: string) => ({ value: v, fontWeight: 'bold' as const });

  const sheets = SHEETS.map(([name], i) => {
    const rows = data[i];
    let cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    // Put a readable org name next to entity_id so the workbook makes sense on its own.
    const withOrg = cols.includes('entity_id');
    if (withOrg) cols = cols.flatMap((c) => (c === 'entity_id' ? ['entity_id', 'org'] : [c]));
    const body = rows.map((r) => cols.map((c) => (c === 'org' && withOrg ? cell(orgName.get(r.entity_id as number) ?? null) : cell(r[c]))));
    return { sheet: name, data: [cols.map(bold), ...body], stickyRowsCount: 1, columns: cols.map((c) => ({ width: Math.min(40, Math.max(10, c.length + 2)) })) };
  });

  const when = new Date();
  const stamp = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(when);
  const about = {
    sheet: 'About', columns: [{ width: 22 }, { width: 60 }],
    data: [
      [bold('E-CFunds full backup'), ''],
      ['Generated', stamp],
      ['By', (await myName()) ?? ''],
      ['', ''],
      [bold('Sheet'), bold('Rows')],
      ...SHEETS.map(([name], i) => [name, data[i].length]),
    ],
  };
  const blob = await writeXlsxFile([about, ...sheets]).toBlob();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(when);
  await saveFile(`E-CFunds backup ${day}.xlsx`, blob);
}
