// CSV for Excel: UTF-8 with a byte-order mark (so Excel shows ₱ correctly), CRLF lines, RFC 4180 quoting.
// Cells starting with = + - @ are prefixed with ' so a spreadsheet never runs them as formulas.
export type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? String(v) : v;
  // Plain numbers (e.g. "-20.00") stay numbers; anything else that starts like a formula is neutralised.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** File-name-safe piece: "Sci-Math Club" → "Sci-Math_Club". */
export function slug(s: string) {
  return s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
}
