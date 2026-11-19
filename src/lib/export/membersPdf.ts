// Print-ready member list (Neil, 2026-11-19): all members, one year level, or one section — A4 portrait, letterhead,
// grouped by year-section, with paid status, receipt numbers, totals and page numbers.
import { finish, myName, newDoc, PAGE, room, tableStyle, text, MUTED } from './pdf';
import { peso } from '../format';

export type MemberLine = {
  student_no: string; full_name: string; course: string | null; year_level: number | null; section: string | null;
  is_paid: boolean; amount_due: number; receipt_no: string | null;
};

const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} year`;
const groupKey = (m: MemberLine) => (m.year_level ? `${m.year_level}${m.section ?? ''}` : '');
const groupLabel = (k: string) => (!k ? 'No year / section' : /^\d$/.test(k) ? `${ord(Number(k))} · no section` : `${ord(Number(k[0]))} · Section ${k.slice(1)}`);

export async function membersPdf(o: {
  entity: { name: string; short_name: string; logo_path: string | null };
  schoolYear: string; period: string;            // e.g. "2026–2027", "1st semester"
  scope: string;                                  // "All members" / "3rd year" / "Section 3A"
  rows: MemberLine[];
}) {
  const { doc, autoTable, top } = await newDoc({
    title: `${o.entity.short_name} — Members · ${o.scope}`,
    subtitle: `${o.entity.name} · School year ${o.schoolYear} · ${o.period}`,
    orgLogoPath: o.entity.logo_path, generatedBy: await myName(),
  });
  const W = doc.internal.pageSize.getWidth(), m = PAGE.m;
  const paid = o.rows.filter((r) => r.is_paid), unpaid = o.rows.filter((r) => !r.is_paid);
  const sum = (l: MemberLine[]) => l.reduce((t, r) => t + Number(r.amount_due), 0);

  // Summary line
  text(doc, `${o.rows.length} members · ${paid.length} paid (${peso(sum(paid))}) · ${unpaid.length} to collect (${peso(sum(unpaid))})`, m, top, { size: 9.5, bold: true });
  let y = top + 6;

  // One table per year-section, in order (1A, 1B … 4D, then without section)
  const by = new Map<string, MemberLine[]>();
  for (const r of o.rows) by.set(groupKey(r), [...(by.get(groupKey(r)) ?? []), r]);
  const keys = [...by.keys()].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  let n = 0;
  for (const k of keys) {
    const list = by.get(k)!.sort((a, b) => a.full_name.localeCompare(b.full_name));
    y = room(doc, y, 24);
    text(doc, `${groupLabel(k)}`, m, y + 4, { size: 10.5, bold: true });
    text(doc, `${list.length} member${list.length === 1 ? '' : 's'} · ${list.filter((r) => r.is_paid).length} paid`, W - m, y + 4, { size: 8.5, color: MUTED, align: 'right' });
    autoTable(doc, {
      ...tableStyle(), startY: y + 6,
      head: [['No.', 'Student ID', 'Name', 'Course', 'Yr-Sec', 'Status', 'Receipt no.']],
      body: list.map((r) => [String(++n), r.student_no, r.full_name, r.course ?? '', groupKey(r) || '—',
        r.is_paid ? 'Paid' : `To collect ${peso(r.amount_due)}`, r.receipt_no ?? '']),
      columnStyles: { 0: { cellWidth: 10, halign: 'right' }, 1: { cellWidth: 24 }, 3: { cellWidth: 16 }, 4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 29 }, 6: { cellWidth: 42 } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 5) d.cell.styles.textColor = String(d.cell.raw).startsWith('Paid') ? '#13774A' : '#9A5B00';
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }
  if (!o.rows.length) text(doc, 'No members in this list.', m, y + 4, { size: 10, color: MUTED });

  // Signature lines for checking
  y = room(doc, y + 4, 26);
  const colW = (W - 2 * m - 16) / 2;
  ['Prepared by (Treasurer)', 'Checked by'].forEach((label, i) => {
    const x = m + i * (colW + 16);
    doc.setDrawColor('#0D1530'); doc.setLineWidth(0.3); doc.line(x, y + 14, x + colW, y + 14);
    text(doc, label, x + colW / 2, y + 19, { size: 8.5, color: MUTED, align: 'center' });
  });

  const safe = (s: string) => s.replace(/[^\w-]+/g, '_');
  await finish(doc, `E-CFunds_${safe(o.entity.short_name)}_members_${safe(o.scope)}_${safe(o.schoolYear)}.pdf`);
}
