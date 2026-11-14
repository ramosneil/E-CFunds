// The SAS "Financial Report" form (Neil's sample FR as of 9.15.25.xlsx), generated from get_financial_report.
// Folio / long bond (8.5 × 13 in), same order and wording as the paper form. Nobody types the numbers: they come
// from the ledger; only the cash count (bills/coins) is typed at download and is not stored.
import type { FinancialReport, Signatories } from '../database.types';
import { createDoc, logoImage, sealImage, text, INK, MUTED, LINE, SOFT } from './pdf';
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

  // Two-column "label …… amount" rows.
  const line = (label: string, amount: number | null, o: { bold?: boolean; indent?: number; rule?: boolean } = {}) => {
    if (y > H - 30) { doc.addPage(); y = 20; }
    text(doc, label, m + (o.indent ?? 0), y, { size: 10, bold: o.bold, maxWidth: right - m - 45 - (o.indent ?? 0) });
    if (amount !== null) text(doc, money(amount), right, y, { size: 10, bold: o.bold, align: 'right' });
    if (o.rule) { doc.setDrawColor(LINE); doc.setLineWidth(0.25); doc.line(m, y + 2, right, y + 2); }
    y += 7;
  };
  const sem = r.semester_term ? 'Sem' : 'Academic Year';
  line(`Previous Fund (${sem})`, r.previous_fund, { bold: true, rule: true });
  line('Collection', null, { bold: true });
  const mem = r.membership;
  line(`Collected Membership Fee (${mem.paid} x ${mem.rate !== null ? qtyFmt(Number(mem.rate)) : 'various'}, Remaining ${mem.unpaid})`, r.total_collection, { indent: 6 });
  line('Total Collection', r.total_collection, { bold: true, rule: true });
  line('Sub Total (Prev. Fund and Collection)', r.subtotal, { bold: true, rule: true });
  line('Less: Total Expenses', null, { bold: true });

  // ── One table per activity ──
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const tableBase = {
    theme: 'grid' as const, margin: { left: m, right: m, top: 20, bottom: 20 }, showHead: 'everyPage' as const,
    styles: { font: 'Inter', fontSize: 8.5, textColor: INK, lineColor: LINE, lineWidth: 0.15, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 } },
    headStyles: { font: 'Inter', fontStyle: 'bold' as const, fillColor: SOFT, textColor: INK, fontSize: 8 },
    footStyles: { font: 'Inter', fontStyle: 'bold' as const, fillColor: SOFT, textColor: INK },
  };
  if (!r.expense_groups.length) {
    text(doc, 'No approved expenses in this period.', m + 6, y, { size: 9, color: MUTED }); y += 8;
  }
  for (const g of r.expense_groups) {
    if (y > H - 50) { doc.addPage(); y = 20; }
    text(doc, g.title, m, y, { size: 10, bold: true, maxWidth: right - m }); y += 2;
    autoTable(doc, {
      ...tableBase, startY: y,
      head: [['No.', 'Particular', 'Unit', 'Quantity', 'Unit Price', 'Total Amount']],
      body: g.items.map((it, i) => [String(i + 1), it.particular, it.unit, qtyFmt(it.qty), money(it.unit_price), money(it.total)]),
      foot: [[{ content: 'Sub Total', colSpan: 5 }, money(g.subtotal)]],
      columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 2: { cellWidth: 17 }, 3: { cellWidth: 19, halign: 'right' }, 4: { cellWidth: 27, halign: 'right' }, 5: { cellWidth: 31, halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 5) d.cell.styles.halign = 'right'; },
    });
    y = lastY() + 8;
  }
  if (Math.abs(Number(r.adjustments)) >= 0.005) line('Adjustments by SAS (corrections)', r.adjustments, { rule: true });
  line('Grand Total (Expenses)', r.total_expenses, { bold: true, rule: true });
  line(`Total Remain Fund (${r.semester_term ? 'Semester' : 'Academic Year'})`, r.remaining_fund, { bold: true, rule: true });
  y += 2;
  line(`Remaining Cash for AY ${r.school_year}${r.semester_term ? `, ${termLabel(r.semester_term).replace('SEMESTER', 'Semester')}` : ''}`, null, { bold: true });
  line('Cash on hand (with the treasurer)', r.cash_on_hand, { indent: 6 });
  line('Saved with SAS', r.saved_with_sas, { indent: 6, rule: true });

  // ── Cash breakdown (typed by the treasurer; blank rows to fill in if not given) ──
  if (y > H - 75) { doc.addPage(); y = 20; }
  text(doc, 'Cash Breakdown', m, y, { size: 10, bold: true }); y += 2;
  const rows = DENOMS.map((d, i) => [String(i + 1), money(d), cash ? String(cash.bills[d] || 0) : '', cash ? money(d * (cash.bills[d] || 0)) : '']);
  rows.push([String(DENOMS.length + 1), 'Coins', '', cash ? money(cash.coins || 0) : '']);
  autoTable(doc, {
    ...tableBase, startY: y, tableWidth: 120,
    head: [['No.', 'Denomination', 'Qty', 'Total']], body: rows,
    foot: [[{ content: 'TOTAL CASH', colSpan: 3 }, cash ? money(cashTotal(cash)) : '']],
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 38 }, 2: { cellWidth: 22, halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 3) d.cell.styles.halign = 'right'; },
  });
  y = lastY() + 12;

  // ── Signatories ──
  const sig = r.signatories;
  const ssg = r.entity.is_school_wide ? null : r.ssg_signatories;
  const orgName = r.entity.name;
  const ssgName = 'Supreme Student Government';
  type Block = { label: string; name: string | null | undefined; role: string };
  const blocks: Block[] = [
    { label: 'Prepared by:', name: r.treasurer_name, role: `Treasurer, ${orgName}` },
    { label: 'Audited and Certified by:', name: sig?.auditor_name, role: `Auditor, ${orgName}` },
    ...(r.entity.is_school_wide ? [] : [{ label: 'Attested and Audited by:', name: ssg?.auditor_name, role: `Auditor, ${ssgName}` }]),
    { label: 'Noted by:', name: sig?.head_name, role: `${sig?.head_title || 'Mayor'}, ${orgName}` },
    ...(r.entity.is_school_wide ? [] : [{ label: '', name: ssg?.head_name, role: `${(ssg as Signatories | null)?.head_title || 'Governor'}, ${ssgName}` }]),
    { label: '', name: sig?.adviser_name, role: `Adviser, ${orgName}` },
    { label: 'Verified by:', name: s.coordinator_name, role: s.coordinator_title || 'SAS Coordinator' },
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
