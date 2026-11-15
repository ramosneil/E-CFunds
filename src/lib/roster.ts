// Student list imports — SAS (Students → Import, import_students) and club treasurers (Members → Import,
// import_members). Reads an .xlsx or .csv, finds the columns by their titles, checks every row the same way the
// database does (migrations 31 + 37), and builds the template file.
import { normStudentNo } from './format';
import { saveFile } from './export/save';

export type RosterRow = { line: number; student_no: string; full_name: string; course: string | null; year_level: string; section: string };
export type RowError = { line: number; message: string };
export type Parsed = { rows: RosterRow[]; errors: RowError[]; missing: string[] };

const HEADERS = { student_no: 'Student ID', full_name: 'Full name', course: 'Course', year_level: 'Year level', section: 'Section' } as const;
type Key = keyof typeof HEADERS;
// Titles people actually use in registrar lists, all lower-cased with spaces/dots/underscores removed.
const ALIASES: Record<Key, string[]> = {
  student_no: ['studentid', 'studentno', 'studentnumber', 'idnumber', 'idno', 'id'],
  full_name: ['fullname', 'name', 'studentname', 'completename'],
  course: ['course', 'program', 'courseprogram'],
  year_level: ['yearlevel', 'year', 'yr', 'yrlevel', 'yearandsection', 'yearsection', 'yrsec', 'yrandsec'],
  section: ['section', 'sec', 'sect', 'block'],
};
const squash = (s: string) => s.toLowerCase().replace(/[\s._\-/#&]+/g, '');
export const normCourse = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();
export const YEARS = ['1', '2', '3', '4'] as const;
export const SECTIONS = ['A', 'B', 'C', 'D'] as const;
/** "1A", "Year 2", or "" — how a group/student is labelled everywhere. */
export const yearSection = (year: number | string | null | undefined, section: string | null | undefined) =>
  year ? `${year}${section ?? ''}` : '';

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

/** Reads the file and checks each row. `courses` = valid course codes (upper-case). `nameOptional`: club import —
 *  a student already on the list needs only the Student ID (the database checks names for new ones). */
export async function parseRoster(file: File, courses: string[], opts: { nameOptional?: boolean } = {}): Promise<Parsed> {
  const table = await readTable(file);
  // The header is the first row that has a Student ID (and, for SAS, a name) column — skips a title line above it.
  let h = -1; let col: Partial<Record<Key, number>> = {};
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const found: Partial<Record<Key, number>> = {};
    table[i].forEach((v, j) => {
      const s = squash(v);
      (Object.keys(ALIASES) as Key[]).forEach((k) => { if (found[k] === undefined && ALIASES[k].includes(s)) found[k] = j; });
    });
    if (found.student_no !== undefined && (opts.nameOptional || found.full_name !== undefined)) { h = i; col = found; break; }
  }
  if (h < 0) return { rows: [], errors: [], missing: opts.nameOptional ? [HEADERS.student_no] : [HEADERS.student_no, HEADERS.full_name] };

  const valid = new Set(courses);
  const rows: RosterRow[] = []; const errors: RowError[] = []; const seen = new Map<string, number>();
  for (let i = h + 1; i < table.length; i++) {
    const r = table[i]; const line = i + 1;
    const get = (k: Key) => (col[k] === undefined ? '' : String(r[col[k]!] ?? '').trim());
    const raw = { no: get('student_no'), name: get('full_name'), course: get('course'), year: get('year_level'), sec: get('section') };
    if (!raw.no && !raw.name && !raw.course && !raw.year && !raw.sec) continue;            // blank line
    const no = normStudentNo(raw.no); const name = raw.name.replace(/\s+/g, ' ');
    const course = raw.course ? normCourse(raw.course) : null;
    let year = raw.year.replace(/(st|nd|rd|th)\s*(year)?$/i, '').replace(/^year\s*/i, '').trim();   // "2nd year" → "2"
    let section = raw.sec.replace(/^sec(tion)?\s*/i, '').trim().toUpperCase();
    const both = year.match(/^([1-4])\s*[-\s]?\s*([A-Za-z])$/);                                  // "2B", "2-B" in one column
    if (both && !section) { year = both[1]; section = both[2].toUpperCase(); }
    const err = (message: string) => errors.push({ line, message });
    if (!no) err('Student ID is missing');
    else if (no.length < 3 || no.length > 30) err('Student ID must be 3–30 characters');
    else if (seen.has(no)) err(`Student ID ${no} is also on line ${seen.get(no)}`);
    if (no && !seen.has(no)) seen.set(no, line);
    if (!name && !opts.nameOptional) err('Full name is missing'); else if (name.length > 120) err('Full name is too long');
    if (course && !valid.has(course)) err(`Unknown course “${raw.course}”. Use one of: ${courses.join(', ')}`);
    if (year && !/^[1-4]$/.test(year)) err(`Year level “${raw.year}” — use 1 to 4`);
    if (section && !/^[A-D]$/.test(section)) err(`Section “${raw.sec || section}” — use A, B, C or D`);
    rows.push({ line, student_no: no, full_name: name, course, year_level: year, section });
  }
  return { rows, errors, missing: [] };
}

/** Empty template: the header row, plus a second sheet that explains each column. */
export async function downloadTemplate(kind: 'xlsx' | 'csv', courses: string[], who: 'sas' | 'club' = 'sas') {
  const head = [HEADERS.student_no, HEADERS.full_name, HEADERS.course, HEADERS.year_level, HEADERS.section];
  const file = who === 'club' ? 'Club members template' : 'Student roster template';
  if (kind === 'csv') {
    const { downloadCsv } = await import('./export/csv');
    return downloadCsv(`${file}.csv`, head, []);
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const bold = (v: string) => ({ value: v, fontWeight: 'bold' as const });
  const blob = await writeXlsxFile([
    { sheet: 'Students', data: [head.map(bold)], columns: [{ width: 18 }, { width: 34 }, { width: 14 }, { width: 11 }, { width: 10 }], stickyRowsCount: 1 },
    { sheet: 'How to fill', columns: [{ width: 16 }, { width: 70 }], data: [
      [bold('Column'), bold('What to type')],
      [HEADERS.student_no, 'Required. As printed on the school ID, e.g. 2026-00123. Spaces are removed.'],
      [HEADERS.full_name, who === 'club' ? 'Required for students not yet on the school list. e.g. Juan Dela Cruz' : 'Required. e.g. Juan Dela Cruz'],
      [HEADERS.course, `Optional. One of: ${courses.join(', ')}`],
      [HEADERS.year_level, 'Optional. 1, 2, 3 or 4'],
      [HEADERS.section, 'Optional. A, B, C or D (so 2nd year section B = Year level 2, Section B → "2B")'],
      ['', who === 'club'
        ? 'Each student becomes a member of your club this semester (to collect). Already members are skipped.'
        : 'Students already on the list are updated (matched by Student ID). Nobody is deleted.'],
    ] },
  ]).toBlob();
  return saveFile(`${file}.xlsx`, blob);
}
