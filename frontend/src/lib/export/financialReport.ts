// The SAS "Financial Report" form (Neil's sample FR as of 9.15.25.xlsx), generated from get_financial_report.
// Folio / long bond (8.5 × 13 in), same order and wording as the paper form. Nobody types the numbers: they come
// from the ledger; only the cash count (bills/coins) is typed at download and is not stored.
import type { FinancialReport } from '../database.types';
import { createDoc, logoImage, sealImage, text, INK, MUTED, LINE } from './pdf';
import { saveFile } from './save';
import { slug } from './csv';

export const FOLIO: [number, number] = [215.9, 330.2];
export const DENOMS = [1000, 500, 200, 100, 50, 20] as const;
export type CashCount = { bills: Record<number, number>; coins: number } | null;

const n2 = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: number | string | null | undefined) => {
  const x = Number(v ?? 0);
  return (x < 0 ? '−₱' : '₱') + n2.format(Math.abs(x));
};
/** "Cristina A. Caponpon, PhD" → "CRISTINA A. CAPONPON, PhD" (suffixes after the comma keep their case). */
const upperName = (n: string) => { const [first, ...rest] = n.split(','); return [first.toUpperCase(), ...rest].join(','); };
const qtyFmt = (v: number) => (Number.isInteger(Number(v)) ? String(Number(v)) : n2.format(Number(v)));
const termLabel = (t: number | null) => (t === 1 ? '1st SEMESTER' : t === 2 ? '2nd SEMESTER' : t ? 'SUMMER' : 'WHOLE ACADEMIC YEAR');
const longDate = (d: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(new Date(d + 'T00:00:00'));

export function cashTotal(c: CashCount) {
  if (!c) return 0;
  return DENOMS.reduce((t, d) => t + d * (c.bills[d] || 0), 0) + (c.coins || 0);
}

export async function financialReportPdf(r: FinancialReport, cash: CashCount) {
  const { doc, autoTable } = await createDoc(FOLIO);
  const W = FOLIO[0], H = FOLIO[1], m = 18, right = W - m, cx = W / 2;
  const s = r.settings;
  const [seal, org] = await Promise.all([sealImage(), logoImage(r.entity.logo_path)]);

  // ── Header (centered, like the form) ──
  if (seal) doc.addImage(seal, 'PNG', m, 12, 22, 22);
  if (org) doc.addImage(org, 'PNG', right - 22, 12, 22, 22);
  let y = 16;
  text(doc, s.republic_line, cx, y, { size: 9, align: 'center' }); y += 5;
  text(doc, s.school_name, cx, y, { size: 12, bold: true, align: 'center' }); y += 5;
  text(doc, s.campus_line, cx, y, { size: 9, align: 'center' }); y += 4.5;
  const contact = [s.website && `Website: ${s.website}`, s.email && `Email Address: ${s.email}`].filter(Boolean).join('   ');
  if (contact) { text(doc, contact, cx, y, { size: 8, color: MUTED, align: 'center' }); y += 4; }
  if (s.phone) { text(doc, `Phone: ${s.phone}`, cx, y, { size: 8, color: MUTED, align: 'center' }); y += 4; }
  y = Math.max(y, 36) + 2;
  doc.setDrawColor(INK); doc.setLineWidth(0.5); doc.line(m, y, right, y); y += 9;
  text(doc, r.entity.name.toUpperCase(), cx, y, { size: 12.5, bold: true, align: 'center', maxWidth: W - 2 * m }); y += 9;
  text(doc, 'FINANCIAL REPORT', cx, y, { size: 15, bold: true, align: 'center' }); y += 6;
  text(doc, `A.Y ${r.school_year}, ${termLabel(r.semester_term)}`, cx, y, { size: 10, bold: true, align: 'center' }); y += 5;
  text(doc, `As of ${longDate(r.as_of)}`, cx, y, { size: 9, color: MUTED, align: 'center' }); y += 9;

  // ── The money part: one spreadsheet-like table, the same rows and colours as the SAS form (Neil's sample,
  // 2026-11-20): blue bars for Previous Fund / Total Collection / Sub Total, a salmon heading per activity with its
  // items (No. · Particular · Unit · Quantity · Unit Price · Total Amount) and Sub Total, salmon Grand Total, grey
  // Total Remain Fund. Empty filler rows of the paper form are left out.
  const BLUE = '#1F6E8C', SALMON = '#F4B183', GREY = '#A6A6A6', SKY = '#9DC3E6', RUST = '#C55A11', PEACH = '#FBE2D5', GRID = '#BFBFBF';
  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const rows: Cell[][] = [];
  const L = { halign: 'left' as const };
  const band = (label: string, amount: number | null, fill: string, color = INK) => rows.push([
    { content: label, colSpan: 5, styles: { ...L, fillColor: fill, textColor: color, fontStyle: 'bold' } },
    { content: amount === null ? '' : money(amount), styles: { fillColor: fill, textColor: color, fontStyle: 'bold', halign: 'right' } },
  ]);
  const plain = (label: string, amount: number | null, o: { bold?: boolean; indent?: boolean; muted?: boolean } = {}) => rows.push([
    { content: label, colSpan: 5, styles: { ...L, fontStyle: o.bold ? 'bold' : 'normal', textColor: o.muted ? MUTED : INK, ...(o.indent ? { cellPadding: { top: 1.6, bottom: 1.6, left: 7, right: 2 } } : {}) } },
    { content: amount === null ? '' : money(amount), styles: { halign: 'right', fontStyle: o.bold ? 'bold' : 'normal' } },
  ]);
  const sem = r.semester_term ? 'Sem' : 'Academic Year';
  band(`Previous Fund- (${sem === 'Sem' ? 'Sem/Academic Year' : 'Academic Year'})`, r.previous_fund, BLUE, '#FFFFFF');
  plain('Collection', null, { bold: true });
  const mem = r.membership;
  plain(`Collected Membership Fee (${mem.paid} x ${mem.rate !== null ? qtyFmt(Number(mem.rate)) : 'various'} Remaining ${mem.unpaid})`, r.total_collection, { indent: true });
  band('Total Collection', r.total_collection, BLUE, '#FFFFFF');
  band('Sub Total (Prev. Fund and Collection)', r.subtotal, BLUE, '#FFFFFF');
  plain('Less: Total Expenses', null, { bold: true });
  if (!r.expense_groups.length) plain('No approved expenses in this period.', null, { indent: true, muted: true });
  for (const g of r.expense_groups) {
    rows.push([{ content: g.title, colSpan: 6, styles: { ...L, fillColor: SALMON, fontStyle: 'bold' } }]);
    rows.push(['No.', 'Particular', 'Unit', 'Quantity', 'Unit Price', 'Total Amount'].map((h, i) => ({ content: h, styles: { fontStyle: 'bold', halign: i === 0 ? 'center' : 'left' } })));
    g.items.forEach((it, i) => rows.push([String(i + 1), it.particular, it.unit, qtyFmt(it.qty), money(it.unit_price), money(it.total)]));
    plain('Sub Total', g.subtotal, { bold: true });
  }
  if (Math.abs(Number(r.adjustments)) >= 0.005) plain('Adjustments by SAS (corrections)', r.adjustments);
  band('Grand Total (Expenses)', r.total_expenses, SALMON);
  rows.push([
    { content: `Total Remain Fund (${r.semester_term ? 'Semester' : 'Academic Year'})`, colSpan: 5, styles: { ...L, fillColor: GREY, fontStyle: 'bold' } },
    { content: money(r.remaining_fund), styles: { fillColor: SKY, fontStyle: 'bold', halign: 'right' } },
  ]);
  plain(`Remaining Cash for AY ${r.school_year}${r.semester_term ? `, ${termLabel(r.semester_term).replace('SEMESTER', 'Semester')}` : ''}`, null, { bold: true });
  plain('Cash on hand (with the treasurer)', r.cash_on_hand, { indent: true });
  plain('Saved with SAS', r.saved_with_sas, { indent: true });

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const sheet = {
    theme: 'grid' as const, margin: { left: m, right: m, top: 20, bottom: 20 },
    styles: { font: 'Inter', fontSize: 8.5, textColor: INK, lineColor: GRID, lineWidth: 0.15, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 } },
  };
  autoTable(doc, {
    ...sheet, startY: y, body: rows as never,
    columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 2: { cellWidth: 17 }, 3: { cellWidth: 19, halign: 'right' }, 4: { cellWidth: 27, halign: 'right' }, 5: { cellWidth: 31, halign: 'right' } },
  });
  y = lastY() + 8;

  // ── Cash breakdown (typed by the treasurer; blank to fill in by hand if not given) ──
  if (y > H - 75) { doc.addPage(); y = 20; }
  const cashRows: Cell[][] = [
    [{ content: 'Cash Breakdown', colSpan: 4, styles: { ...L, fillColor: RUST, textColor: '#FFFFFF', fontStyle: 'bold' } }],
    ['No.', 'Denomination', 'Qty', 'Total'].map((h, i) => ({ content: h, styles: { fontStyle: 'bold', fillColor: PEACH, halign: i === 0 ? 'center' : i === 1 ? 'left' : 'right' } })),
    ...DENOMS.map((d, i) => [String(i + 1), d.toLocaleString('en-PH'), cash ? String(cash.bills[d] || 0) : '', cash ? money(d * (cash.bills[d] || 0)) : '']),
    [String(DENOMS.length + 1), 'coins', '', cash ? money(cash.coins || 0) : ''],
    [{ content: 'TOTAL CASH', colSpan: 3, styles: { ...L, fillColor: SALMON, fontStyle: 'bold' } },
     { content: cash ? money(cashTotal(cash)) : '', styles: { fillColor: SALMON, fontStyle: 'bold', halign: 'right' } }],
  ];
  autoTable(doc, {
    ...sheet, startY: y, tableWidth: 120, body: cashRows as never,
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 38 }, 2: { cellWidth: 22, halign: 'right' }, 3: { halign: 'right' } },
  });
  y = lastY() + 12;

  // ── Signatories ──
  // Signatories (Neil, 2026-11-19):
  //   club: treasurer, auditor, SSG auditor, SSG governor, adviser, SAS coordinator (no head)
  //   org:  treasurer, mayor, auditor, SSG auditor, SSG governor, adviser, SAS coordinator
  //   SSG itself: treasurer, governor, auditor, adviser, SAS coordinator
  const sig = r.signatories;
  const ssg = r.entity.is_school_wide ? null : r.ssg_signatories;
  const orgName = r.entity.name;
  const ssgName = 'Supreme Student Government';
  const isClub = r.entity.category === 'club';
  type Block = { label: string; name: string | null | undefined; role: string };
  const coordinator: Block = { label: 'Verified by:', name: s.coordinator_name, role: s.coordinator_title || 'SAS Coordinator' };
  // SSG governor + SSG auditor: typed once by SAS (School year page, Neil 2026-11-20).
  const ssgGovernor = s.ssg_governor_name ?? (r.entity.is_school_wide ? sig?.head_name : ssg?.head_name);
  const ssgAuditor = s.ssg_auditor_name ?? (r.entity.is_school_wide ? sig?.auditor_name : ssg?.auditor_name);
  const blocks: Block[] = r.entity.is_school_wide ? [
    { label: 'Prepared by:', name: r.treasurer_name, role: `Treasurer, ${orgName}` },
    { label: 'Noted by:', name: ssgGovernor, role: `Governor, ${orgName}` },
    { label: 'Audited and Certified by:', name: ssgAuditor, role: `Auditor, ${orgName}` },
    { label: '', name: sig?.adviser_name, role: `Adviser, ${orgName}` },
    coordinator,
  ] : [
    { label: 'Prepared by:', name: r.treasurer_name, role: `Treasurer, ${orgName}` },
    ...(isClub ? [] : [{ label: 'Noted by:', name: sig?.head_name, role: `Mayor, ${orgName}` }]),
    { label: 'Audited and Certified by:', name: sig?.auditor_name, role: `Auditor, ${orgName}` },
    { label: 'Attested and Audited by:', name: ssgAuditor, role: `Auditor, ${ssgName}` },
    { label: 'Noted by:', name: ssgGovernor, role: `Governor, ${ssgName}` },
    { label: '', name: sig?.adviser_name, role: `Adviser, ${orgName}` },
    coordinator,
  ];
  const colW = (right - m - 12) / 2;
  for (let i = 0; i < blocks.length; i += 2) {
    if (y > H - 40) { doc.addPage(); y = 24; }
    const pair = blocks.slice(i, i + 2);
    pair.forEach((b, j) => {
      const x = m + j * (colW + 12), mid = x + colW / 2;
      if (b.label) text(doc, b.label, x, y, { size: 9, color: MUTED });
      if (b.name) text(doc, upperName(b.name), mid, y + 11, { size: 10, bold: true, align: 'center', maxWidth: colW });
      doc.setDrawColor(INK); doc.setLineWidth(0.3); doc.line(x + 4, y + 12.5, x + colW - 4, y + 12.5);
      text(doc, b.role, mid, y + 17, { size: 8.5, align: 'center', maxWidth: colW });
    });
    y += 28;
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  const stamp = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date());
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(m, H - 12, right, H - 12);
    text(doc, `Generated by E-CFunds from recorded transactions · ${stamp}`, m, H - 7.5, { size: 7, color: MUTED });
    text(doc, `Page ${p} of ${pages}`, right, H - 7.5, { size: 7, color: MUTED, align: 'right' });
  }
  const period = r.semester_term ? `${r.semester_term === 1 ? '1st' : '2nd'}_sem` : 'AY';
  await saveFile(`Financial_Report_${slug(r.entity.short_name)}_${r.school_year}_${period}_as_of_${r.as_of}.pdf`, doc.output('blob'));
}
