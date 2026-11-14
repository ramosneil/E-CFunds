// Student roster import (SAS → Students → Import): read an .xlsx or .csv, find the columns by their titles, check
// every row the same way the database does (import_students, migration 31), and build the template file.
import { normStudentNo } from './format';
import { saveFile } from './export/save';

export type RosterRow = { line: number; student_no: string; full_name: string; course: string | null; year_level: string };
export type RowError = { line: number; message: string };
export type Parsed = { rows: RosterRow[]; errors: RowError[]; missing: string[] };

const HEADERS = { student_no: 'Student ID', full_name: 'Full name', course: 'Course', year_level: 'Year level' } as const;
type Key = keyof typeof HEADERS;
// Titles people actually use in registrar lists, all lower-cased with spaces/dots/underscores removed.
const ALIASES: Record<Key, string[]> = {
  student_no: ['studentid', 'studentno', 'studentnumber', 'idnumber', 'idno', 'id'],
  full_name: ['fullname', 'name', 'studentname', 'completename'],
  course: ['course', 'program', 'courseprogram'],
  year_level: ['yearlevel', 'year', 'yr', 'yrlevel'],
};
const squash = (s: string) => s.toLowerCase().replace(/[\s._\-/#]+/g, '');
export const normCourse = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

/** Minimal RFC 4180 reader (quotes, "" escapes, CRLF), comma or semicolon separated. */
function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const out: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); out.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

async function readTable(file: File): Promise<string[][]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Use an Excel (.xlsx) or CSV (.csv) file. Old .xls files: open in Excel and “Save as” .xlsx first.');
  const { readSheet } = await import('read-excel-file/browser');
  const data = await readSheet(file);
  return data.map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))));
}

/** Reads the file and checks each row. `courses` = valid course codes (upper-case). */
export async function parseRoster(file: File, courses: string[]): Promise<Parsed> {
  const table = await readTable(file);
  // The header is the first row that has a Student ID and a name column (skips a title line above it).
  let h = -1; let col: Partial<Record<Key, number>> = {};
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const found: Partial<Record<Key, number>> = {};
    table[i].forEach((v, j) => {
      const s = squash(v);
      (Object.keys(ALIASES) as Key[]).forEach((k) => { if (found[k] === undefined && ALIASES[k].includes(s)) found[k] = j; });
    });
    if (found.student_no !== undefined && found.full_name !== undefined) { h = i; col = found; break; }
  }
  if (h < 0) return { rows: [], errors: [], missing: [HEADERS.student_no, HEADERS.full_name] };

  const valid = new Set(courses);
  const rows: RosterRow[] = []; const errors: RowError[] = []; const seen = new Map<string, number>();
  for (let i = h + 1; i < table.length; i++) {
    const r = table[i]; const line = i + 1;
    const get = (k: Key) => (col[k] === undefined ? '' : String(r[col[k]!] ?? '').trim());
    const raw = { no: get('student_no'), name: get('full_name'), course: get('course'), year: get('year_level') };
    if (!raw.no && !raw.name && !raw.course && !raw.year) continue;            // blank line
    const no = normStudentNo(raw.no); const name = raw.name.replace(/\s+/g, ' ');
    const course = raw.course ? normCourse(raw.course) : null;
    const year = raw.year.replace(/(st|nd|rd|th)\s*(year)?$/i, '').trim();      // "2nd year" → "2"
    const err = (message: string) => errors.push({ line, message });
    if (!no) err('Student ID is missing');
    else if (no.length < 3 || no.length > 30) err('Student ID must be 3–30 characters');
    else if (seen.has(no)) err(`Student ID ${no} is also on line ${seen.get(no)}`);
    if (no && !seen.has(no)) seen.set(no, line);
    if (!name) err('Full name is missing'); else if (name.length > 120) err('Full name is too long');
    if (course && !valid.has(course)) err(`Unknown course “${raw.course}”. Use one of: ${courses.join(', ')}`);
    if (year && !/^[1-6]$/.test(year)) err(`Year level “${raw.year}” — use 1 to 6`);
    rows.push({ line, student_no: no, full_name: name, course, year_level: year });
  }
  return { rows, errors, missing: [] };
}

/** Empty template: the header row, plus a second sheet that explains each column. */
export async function downloadTemplate(kind: 'xlsx' | 'csv', courses: string[]) {
  const head = [HEADERS.student_no, HEADERS.full_name, HEADERS.course, HEADERS.year_level];
  if (kind === 'csv') {
    const { downloadCsv } = await import('./export/csv');
    return downloadCsv('Student roster template.csv', head, []);
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const bold = (v: string) => ({ value: v, fontWeight: 'bold' as const });
  const blob = await writeXlsxFile([
    { sheet: 'Students', data: [head.map(bold)], columns: [{ width: 18 }, { width: 34 }, { width: 14 }, { width: 11 }], stickyRowsCount: 1 },
    { sheet: 'How to fill', columns: [{ width: 16 }, { width: 70 }], data: [
      [bold('Column'), bold('What to type')],
      [HEADERS.student_no, 'Required. As printed on the school ID, e.g. 2026-00123. Spaces are removed.'],
      [HEADERS.full_name, 'Required. e.g. Juan Dela Cruz'],
      [HEADERS.course, `Optional. One of: ${courses.join(', ')}`],
      [HEADERS.year_level, 'Optional. A number from 1 to 6'],
      ['', 'Students already on the list are updated (matched by Student ID). Nobody is deleted.'],
    ] },
  ]).toBlob();
  return saveFile('Student roster template.xlsx', blob);
}
