// The four exports (Neil, 2026-11-13). Everything is read under RLS, so a treasurer can only ever export their own org.
import { supabase } from '../supabase';
import { date, kindLabel, manilaDate, peso } from '../format';
import type { EntityReport, Row } from '../database.types';
import { downloadCsv, slug } from './csv';
import { finish, myName, newDoc, PAGE, room, sectionTitle, tableStyle, text, MUTED } from './pdf';
import { C, hBars, monthly, pocketBar, stackedPockets, tiles } from './charts';

type Year = Row<'school_years'>;
type Entity = Row<'entities'>;
type Ledger = Row<'ledger_entries'>;

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// Same pocket rules as private.d_cash / private.d_saved (business-rules §2).
function dCash(l: Ledger) {
  const a = Number(l.amount);
  switch (l.kind) {
    case 'collection': case 'release': return a;
    case 'remittance': case 'expense': return -a;
    case 'adjustment': case 'reversal': return l.pocket === 'cash' ? (l.direction ?? 1) * a : 0;
    default: return 0;
  }
}
function dSaved(l: Ledger) {
  const a = Number(l.amount);
  switch (l.kind) {
    case 'opening': case 'remittance': return a;
    case 'release': return -a;
    case 'adjustment': case 'reversal': return l.pocket === 'saved' ? (l.direction ?? 1) * a : 0;
    default: return 0;
  }
}
const signed = (n: number) => (n === 0 ? '—' : peso(n, { sign: true }));

async function reportRow(yearId: number, entityId?: number): Promise<EntityReport[]> {
  const rows = await must(supabase.rpc('get_entity_report', { p_school_year_id: yearId }));
  return entityId ? rows.filter((r) => r.entity_id === entityId) : rows;
}
async function ledgerOf(entityId: number, yearId: number): Promise<Ledger[]> {
  return must(supabase.from('ledger_entries').select('*').eq('entity_id', entityId).eq('school_year_id', yearId).order('occurred_on').order('id'));
}

/** Months of the school year (Aug–May style) with money in/out per month from the ledger. */
function byMonth(year: Year, ledger: Ledger[]) {
  const start = new Date(year.starts_on + 'T00:00:00'), end = new Date(year.ends_on + 'T00:00:00');
  const months: { key: string; label: string; in: number; out: number }[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d.setMonth(d.getMonth() + 1)) {
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-PH', { month: 'short' }), in: 0, out: 0 });
  }
  for (const l of ledger) {
    const t = dCash(l) + dSaved(l);                      // transfers (remit/release) net to 0
    const d = new Date(l.occurred_on + 'T00:00:00');
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (!m || t === 0) continue;
    if (t > 0) m.in += t; else m.out += -t;
  }
  return months;
}

// ---------------------------------------------------------------- 1. Org / club financial report
export async function orgReport(format: 'pdf' | 'csv', entity: Entity, year: Year) {
  const [rep] = await reportRow(year.id, entity.id);
  if (!rep) throw new Error('No report for this org/club.');
  const ledger = await ledgerOf(entity.id, year.id);
  const base = `E-CFunds_${slug(entity.short_name)}_report_${year.label}`;

  if (format === 'csv') {
    await downloadCsv(`${base}.csv`,
      ['Date', 'Type', 'Description', 'Pocket', 'Cash change', 'Saved change', 'Total change'],
      ledger.map((l) => {
        const c = dCash(l), s = dSaved(l);
        return [l.occurred_on, kindLabel[l.kind] ?? l.kind, l.description, l.pocket ?? '', c.toFixed(2), s.toFixed(2), (c + s).toFixed(2)];
      }));
    return;
  }

  const { doc, autoTable, top } = await newDoc({
    title: `${entity.short_name} — Financial report`, subtitle: `${entity.name} · School year ${year.label}`,
    orgLogoPath: entity.logo_path, generatedBy: await myName(),
  });
  let y = tiles(doc, top, [
    { label: 'Total fund', value: peso(rep.total_fund) },
    { label: 'Previous funds', value: peso(rep.previous_funds) },
    { label: 'Collected', value: peso(rep.collections) },
    { label: 'Spent', value: peso(rep.expenses) },
  ]);
  y = sectionTitle(doc, 'Where the money is', y + 1);
  y = pocketBar(doc, y + 1, rep.cash_on_hand, rep.saved_with_sas);

  y = sectionTitle(doc, 'Money in and out this school year', room(doc, y + 3, 50));
  y = hBars(doc, y + 2, [
    { label: 'Collected (dues)', value: rep.collections, color: C.in },
    { label: 'Spent (expenses)', value: rep.expenses, color: C.out },
    { label: 'Remitted to SAS', value: rep.remittances, color: C.saved },
    { label: 'Released by SAS', value: rep.releases, color: C.cash },
  ], { labelW: 36 });

  y = sectionTitle(doc, 'Month by month', room(doc, y + 3, 70));
  y = monthly(doc, y + 3, byMonth(year, ledger));
  text(doc, 'Money in = collections and opening balance; money out = expenses. Remittances and releases only move money between pockets.', PAGE.m, y, { size: 7, color: MUTED, maxWidth: 178 });
  y += 8;

  y = sectionTitle(doc, 'Dues', room(doc, y + 2, 20));
  const pct = rep.members ? Math.round((rep.paid_members / rep.members) * 100) : 0;
  y = hBars(doc, y + 2, [{ label: 'Members paid', value: pct, color: C.in, note: `(${rep.paid_members} of ${rep.members})` }], { labelW: 36, fmt: (n) => `${n}%`, max: 100 });

  y = sectionTitle(doc, `Ledger (${ledger.length} entr${ledger.length === 1 ? 'y' : 'ies'})`, room(doc, y + 3, 30));
  autoTable(doc, {
    ...tableStyle(), startY: y + 1,
    head: [['Date', 'Type', 'Description', 'Cash', 'Saved', 'Total']],
    body: ledger.length ? ledger.map((l) => { const c = dCash(l), s = dSaved(l); return [date(l.occurred_on), kindLabel[l.kind] ?? l.kind, l.description, signed(c), signed(s), signed(c + s)]; })
      : [[{ content: 'No money movements yet this school year.', colSpan: 6, styles: { halign: 'center', textColor: MUTED } }]],
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 24 }, 3: { halign: 'right', cellWidth: 22 }, 4: { halign: 'right', cellWidth: 22 }, 5: { halign: 'right', cellWidth: 22, fontStyle: 'bold' } },
    foot: ledger.length ? [['', '', 'Year so far', signed(ledger.reduce((a, l) => a + dCash(l), 0)), signed(ledger.reduce((a, l) => a + dSaved(l), 0)), signed(ledger.reduce((a, l) => a + dCash(l) + dSaved(l), 0))]] : undefined,
    footStyles: { font: 'Inter', fontStyle: 'bold', fillColor: '#F4F6FB', textColor: '#0D1530', halign: 'right' },
  });
  await finish(doc, `${base}.pdf`);
}

// ---------------------------------------------------------------- 2. School-wide summary (admin)
export async function schoolSummary(format: 'pdf' | 'csv', year: Year) {
  const rows = await reportRow(year.id);
  const sum = (k: keyof EntityReport) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const base = `E-CFunds_school-summary_${year.label}`;
  const header = ['Org / club', 'Type', 'Previous funds', 'Collected', 'Spent', 'Cash on hand', 'Saved with SAS', 'Total fund', 'Members', 'Paid'];
  const line = (r: EntityReport) => [r.name, r.category, r.previous_funds, r.collections, r.expenses, r.cash_on_hand, r.saved_with_sas, r.total_fund, r.members, r.paid_members];

  if (format === 'csv') {
    await downloadCsv(`${base}.csv`, header, [
      ...rows.map((r) => line(r).map((v) => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v))),
      ['ALL ORGS & CLUBS', '', sum('previous_funds').toFixed(2), sum('collections').toFixed(2), sum('expenses').toFixed(2), sum('cash_on_hand').toFixed(2), sum('saved_with_sas').toFixed(2), sum('total_fund').toFixed(2), sum('members'), sum('paid_members')],
    ]);
    return;
  }

  const { doc, autoTable, top } = await newDoc({ title: 'School-wide fund summary', subtitle: `All organizations and clubs · School year ${year.label}`, generatedBy: await myName() });
  let y = tiles(doc, top, [
    { label: 'Total funds', value: peso(sum('total_fund')) },
    { label: 'Cash on hand', value: peso(sum('cash_on_hand')) },
    { label: 'Saved with SAS', value: peso(sum('saved_with_sas')) },
    { label: 'Spent', value: peso(sum('expenses')) },
  ]);
  const order = [...rows].sort((a, b) => b.total_fund - a.total_fund || a.short_name.localeCompare(b.short_name));
  y = sectionTitle(doc, 'Funds by org & club', y + 1);
  y = stackedPockets(doc, y + 3, order.map((r) => ({ label: r.short_name, cash: r.cash_on_hand, saved: r.saved_with_sas })));
  y = sectionTitle(doc, 'Dues paid', room(doc, y + 4, 12 + rows.length * 7.5));
  y = hBars(doc, y + 2, order.map((r) => ({
    label: r.short_name, value: r.members ? Math.round((r.paid_members / r.members) * 100) : 0, color: C.in, note: `(${r.paid_members} of ${r.members})`,
  })), { labelW: 30, fmt: (n) => `${n}%`, max: 100 });
  void y;
  doc.addPage();
  y = sectionTitle(doc, 'All organizations and clubs', 20);
  autoTable(doc, {
    ...tableStyle(), startY: y + 1,
    head: [['Org / club', 'Previous', 'Collected', 'Spent', 'Cash', 'Saved', 'Total', 'Paid']],
    body: rows.map((r) => [r.short_name + (r.is_school_wide ? ' (school-wide)' : ''), peso(r.previous_funds), peso(r.collections), peso(r.expenses), peso(r.cash_on_hand), peso(r.saved_with_sas), peso(r.total_fund), `${r.paid_members}/${r.members}`]),
    foot: [['All', peso(sum('previous_funds')), peso(sum('collections')), peso(sum('expenses')), peso(sum('cash_on_hand')), peso(sum('saved_with_sas')), peso(sum('total_fund')), `${sum('paid_members')}/${sum('members')}`]],
    footStyles: { font: 'Inter', fontStyle: 'bold', fillColor: '#F4F6FB', textColor: '#0D1530' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' }, 7: { halign: 'center' } },
  });
  await finish(doc, `${base}.pdf`);
}

// ---------------------------------------------------------------- 3. Members & dues (CSV)
export async function membersCsv(entity: Entity, year: Year) {
  const rows = await must(supabase.from('memberships')
    .select('amount_due, is_paid, paid_at, student:students(student_no, full_name, course, year_level)')
    .eq('entity_id', entity.id).eq('school_year_id', year.id));
  const sorted = [...rows].sort((a, b) => (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? ''));
  await downloadCsv(`E-CFunds_${slug(entity.short_name)}_members_${year.label}.csv`,
    ['Student ID', 'Full name', 'Course', 'Year level', 'Amount due', 'Status', 'Paid on'],
    sorted.map((m) => [m.student?.student_no, m.student?.full_name, m.student?.course, m.student?.year_level, Number(m.amount_due).toFixed(2), m.is_paid ? 'Paid' : 'Unpaid', m.paid_at ? manilaDate(m.paid_at) : '']));
}

// ---------------------------------------------------------------- 4. Accredited list (admin)
export async function accredited(format: 'pdf' | 'csv') {
  const rows = await must(supabase.from('accredited_list').select('*').order('category').order('name'));
  const status = (s: string | null) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const today = manilaDate();
  if (format === 'csv') {
    await downloadCsv(`E-CFunds_accredited-list_${today}.csv`,
      ['Name', 'Type', 'Adviser', 'Academic year', 'Accredited on', 'Expires on', 'Status', 'Remarks'],
      rows.map((a) => [a.name, a.category, a.adviser, a.academic_year, a.accredited_on, a.expires_on, status(a.effective_status), a.remarks]));
    return;
  }
  const { doc, autoTable, top } = await newDoc({ title: 'Accredited organizations and clubs', subtitle: `As of ${date(today)} · "Expired" is worked out from the expiry date`, generatedBy: await myName(), landscape: true });
  const tone: Record<string, [string, string]> = { accredited: ['#E2F4EA', '#13774A'], expired: ['#FDE8E6', '#B42318'], revoked: ['#FDE8E6', '#B42318'], pending: ['#FDF0DA', '#9A5B00'] };
  autoTable(doc, {
    ...tableStyle(), startY: top,
    head: [['Name', 'Type', 'Adviser', 'Academic year', 'Accredited', 'Expires', 'Status', 'Remarks']],
    body: rows.map((a) => [a.name ?? '', status(a.category), a.adviser ?? '—', a.academic_year ?? '—', date(a.accredited_on), date(a.expires_on), status(a.effective_status), a.remarks ?? '']),
    columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 6: { halign: 'center', fontStyle: 'bold' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 6) {
        const t = tone[String(rows[d.row.index]?.effective_status)];
        if (t) { d.cell.styles.fillColor = t[0]; d.cell.styles.textColor = t[1]; }
      }
    },
  });
  await finish(doc, `E-CFunds_accredited-list_${today}.pdf`);
}
