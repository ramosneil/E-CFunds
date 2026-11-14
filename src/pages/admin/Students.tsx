import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, GraduationCap, Pencil, Search, Upload } from 'lucide-react';
import { supabase, errorText } from '../../lib/supabase';
import { normStudentNo } from '../../lib/format';
import { downloadTemplate, parseRoster, type Parsed } from '../../lib/roster';
import type { Row } from '../../lib/database.types';
import { Alert, Button, Card, Chip, Empty, Field, Input, PageHeader, Select, Sheet, Spinner } from '../../components/ui';
import { Segmented } from '../../components/common';
import { confirmAsk } from '../../lib/confirm';
import { toast } from '../../lib/toast';

type Student = Row<'students'>;
const PER_PAGE = 50;

function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('code, name').order('sort');
      if (error) throw error;
      return data;
    },
  });
}

/** SAS: the student roster. Import the registrar's file to add or update many students at once; edit one here. */
export function Students() {
  const courses = useCourses();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<Student | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(0); }, [term, course, year, status]);

  const list = useQuery({
    queryKey: ['students', term, course, year, status, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let qy = supabase.from('students').select('*', { count: 'exact' });
      if (term) {
        const safe = term.replace(/[%_,()*\\]/g, ' ');
        qy = qy.or(`full_name.ilike.%${safe}%,student_no.ilike.%${normStudentNo(safe)}%`);
      }
      if (course === '-') qy = qy.is('course', null); else if (course) qy = qy.eq('course', course);
      if (year) qy = qy.eq('year_level', Number(year));
      if (status !== 'all') qy = qy.eq('is_active', status === 'active');
      const { data, error, count } = await qy.order('full_name').range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const total = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <PageHeader title="Students" sub="Everyone on the student list. Import the registrar’s file to add or update many at once."
        action={<Button onClick={() => setImporting(true)}><Upload className="size-5" aria-hidden />Import</Button>} />
      <div className="grid gap-3 mb-4 sm:grid-cols-[1fr_auto_auto] items-center">
        <label className="relative block">
          <Search className="size-5 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or Student ID" className="pl-11" aria-label="Search students" />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:w-[340px]">
          <Select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
            <option value="">All courses</option>
            {courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            <option value="-">No course</option>
          </Select>
          <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year level">
            <option value="">All years</option>
            {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </Select>
        </div>
        <div className="sm:w-[270px]"><Segmented value={status} onChange={setStatus} options={[['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']]} /></div>
      </div>

      {list.isLoading ? <Spinner /> : list.error ? <Alert>{errorText(list.error)}</Alert> : !total ? (
        <Card><Empty icon={<GraduationCap className="size-6" />} title={term || course || year ? 'No one matches' : 'No students yet'}>
          {term || course || year ? 'Try another name, Student ID or filter.' : 'Import the registrar’s list (Excel or CSV) to get started.'}
        </Empty></Card>
      ) : (
        <Card className="p-0">
          <p className="px-4 sm:px-5 pt-4 pb-1 text-[13px] text-muted">{total.toLocaleString('en-PH')} student{total === 1 ? '' : 's'}</p>
          <ul className={`divide-y divide-line ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
            {list.data!.rows.map((s) => (
              <li key={s.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate flex items-center gap-2">
                    <span className="truncate">{s.full_name}</span>
                    {!s.is_active && <Chip tone="muted">Inactive</Chip>}
                  </p>
                  <p className="text-[13px] text-muted truncate">
                    <span className="money">{s.student_no}</span>{s.course ? ` · ${s.course}` : ' · no course'}{s.year_level ? ` ${s.year_level}` : ''}
                  </p>
                </div>
                <button onClick={() => setEdit(s)} aria-label={`Edit ${s.full_name}`} title="Edit"
                  className="size-11 -mr-2 grid place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink cursor-pointer shrink-0">
                  <Pencil className="size-[18px]" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-line">
              <Button variant="ghost" className="h-11 px-3" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="size-5" aria-hidden />Previous</Button>
              <span className="text-[13px] text-muted">Page {page + 1} of {pages}</span>
              <Button variant="ghost" className="h-11 px-3" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next<ChevronRight className="size-5" aria-hidden /></Button>
            </div>
          )}
        </Card>
      )}
      {edit && <EditSheet key={edit.id} s={edit} courses={courses.data ?? []} onClose={() => setEdit(null)} />}
      {importing && <ImportSheet courses={(courses.data ?? []).map((c) => c.code)} onClose={() => setImporting(false)} />}
    </>
  );
}

function EditSheet({ s, courses, onClose }: { s: Student; courses: { code: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: s.full_name, course: s.course ?? '', year_level: s.year_level ? String(s.year_level) : '', active: s.is_active ? 'yes' : 'no' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = f.full_name.trim().replace(/\s+/g, ' ');
    if (!name) { setErr('Type the full name.'); return; }
    const courseChanged = (f.course || null) !== s.course;
    if (courseChanged && !(await confirmAsk({
      title: 'Change course?',
      body: `${name} moves to ${f.course || 'no course'}. Unpaid fees of course organizations they leave are removed; they join the new course’s organizations. Paid fees stay.`,
      confirm: 'Change course',
    }))) return;
    if (f.active === 'no' && s.is_active && !(await confirmAsk({
      title: 'Mark as inactive?', body: `${name} no longer appears as a new member anywhere. Their records and payments stay.`, confirm: 'Mark inactive', tone: 'bad',
    }))) return;
    setBusy(true); setErr('');
    const { error } = await supabase.from('students').update({
      full_name: name, course: f.course || null, year_level: f.year_level ? Number(f.year_level) : null, is_active: f.active === 'yes',
    }).eq('id', s.id);
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    toast({ title: 'Saved', body: name, tone: 'ok', silent: true });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Edit student">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student ID" hint="The Student ID can’t be changed. If it’s wrong, mark this one inactive and import the right one.">
          <Input value={s.student_no} disabled className="money" />
        </Field>
        <Field label="Full name"><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Course">
            <Select value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })}>
              <option value="">No course</option>
              {courses.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
          <Field label="Year level">
            <Select value={f.year_level} onChange={(e) => setF({ ...f, year_level: e.target.value })}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Status"><Segmented value={f.active} onChange={(v) => setF({ ...f, active: v })} options={[['yes', 'Active'], ['no', 'Inactive']]} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Save changes</Button>
      </form>
    </Sheet>
  );
}

function ImportSheet({ courses, onClose }: { courses: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // How many rows are new vs already on the roster (looked up in chunks).
  const ids = useMemo(() => parsed && !parsed.errors.length ? parsed.rows.map((r) => r.student_no) : [], [parsed]);
  const existing = useQuery({
    queryKey: ['roster-existing', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const found = new Set<string>();
      for (let i = 0; i < ids.length; i += 300) {
        const { data, error } = await supabase.from('students').select('student_no').in('student_no', ids.slice(i, i + 300));
        if (error) throw error;
        data.forEach((x) => found.add(x.student_no));
      }
      return found;
    },
  });

  async function pick(f: File | undefined) {
    setErr(''); setParsed(null); setFile(f ?? null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErr('That file is over 5 MB. Remove extra sheets or columns and try again.'); return; }
    setReading(true);
    try { setParsed(await parseRoster(f, courses)); } catch (e) { setErr(e instanceof Error ? e.message : errorText(e)); } finally { setReading(false); }
  }

  async function run() {
    if (!parsed) return;
    const n = parsed.rows.length;
    if (!(await confirmAsk({ title: `Import ${n.toLocaleString('en-PH')} student${n === 1 ? '' : 's'}?`,
      body: 'New Student IDs are added; existing ones get the name, course and year from the file and become active. New students join SSG and their course organizations for this school year.',
      confirm: 'Import' }))) return;
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('import_students', {
      p_rows: parsed.rows.map((r) => ({ student_no: r.student_no, full_name: r.full_name, course: r.course, year_level: r.year_level })),
    });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    const res = data as { ok: boolean; added?: number; updated?: number; unchanged?: number; errors?: { row: number; message: string }[] };
    if (!res.ok) {   // the database found something the preview didn't: show it on the right lines
      setParsed({ ...parsed, errors: (res.errors ?? []).map((e) => ({ line: parsed.rows[e.row - 1]?.line ?? e.row, message: e.message })) });
      return;
    }
    void qc.invalidateQueries();
    toast({ title: 'Roster imported', body: `${res.added} added · ${res.updated} updated · ${res.unchanged} unchanged`, tone: 'ok' });
    onClose();
  }

  const errs = parsed?.errors ?? [];
  const isNew = (no: string) => existing.data && !existing.data.has(no);
  const newCount = existing.data ? ids.filter((x) => !existing.data!.has(x)).length : null;

  return (
    <Sheet open onClose={onClose} title="Import students">
      <div className="space-y-4">
        <div className="rounded-[16px] bg-surface2 p-4 text-[14px]">
          <p className="font-semibold mb-1">1. Download the template</p>
          <p className="text-muted mb-3">Columns: Student ID, Full name, Course, Year level. A registrar file with the same column titles works too.</p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
            <Button variant="ghost" className="h-11 px-3 text-[14px] bg-surface" onClick={() => void downloadTemplate('xlsx', courses)}><FileSpreadsheet className="size-4" aria-hidden />Excel</Button>
            <Button variant="ghost" className="h-11 px-3 text-[14px] bg-surface" onClick={() => void downloadTemplate('csv', courses)}><FileSpreadsheet className="size-4" aria-hidden />CSV</Button>
          </div>
        </div>
        <Field label="2. Choose the filled-in file" hint="Excel (.xlsx) or CSV (.csv), up to 5,000 students.">
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void pick(e.target.files?.[0])}
            className="block w-full text-[14px] file:mr-3 file:h-11 file:px-4 file:rounded-[12px] file:border-0 file:bg-primary-soft file:text-primary file:font-semibold file:cursor-pointer cursor-pointer" />
        </Field>
        {reading && <Spinner label="Reading the file" />}
        {err && <Alert>{err}</Alert>}
        {parsed && parsed.missing.length > 0 && (
          <Alert>Couldn’t find the {parsed.missing.join(' and ')} columns in {file?.name}. Put the column titles in the first row (see the template).</Alert>
        )}
        {parsed && !parsed.missing.length && !parsed.rows.length && <Alert tone="warn">The file has column titles but no students under them.</Alert>}
        {parsed && parsed.rows.length > 0 && (
          <>
            <p className="font-semibold">3. Check, then import</p>
            {errs.length > 0 ? (
              <div className="rounded-[16px] border border-bad/40 bg-bad-soft p-4">
                <p className="font-semibold text-bad flex items-center gap-2"><AlertTriangle className="size-5" aria-hidden />
                  {errs.length} problem{errs.length === 1 ? '' : 's'} — fix {errs.length === 1 ? 'it' : 'them'} in the file, then choose it again</p>
                <ul className="mt-2 text-[14px] space-y-1 max-h-56 overflow-y-auto">
                  {errs.slice(0, 200).map((e, i) => <li key={i}><b>Line {e.line}:</b> {e.message}</li>)}
                  {errs.length > 200 && <li className="text-muted">…and {errs.length - 200} more</li>}
                </ul>
              </div>
            ) : (
              <Alert tone="ok">{parsed.rows.length.toLocaleString('en-PH')} student{parsed.rows.length === 1 ? '' : 's'} ready
                {newCount !== null && <> · {newCount.toLocaleString('en-PH')} new, {(parsed.rows.length - newCount).toLocaleString('en-PH')} already on the list</>}.</Alert>
            )}
            <div className="rounded-[16px] border border-line overflow-hidden">
              <ul className="divide-y divide-line max-h-80 overflow-y-auto">
                {parsed.rows.slice(0, 100).map((r) => {
                  const bad = errs.some((e) => e.line === r.line);
                  return (
                    <li key={r.line} className={`px-3 py-2.5 flex items-center gap-3 ${bad ? 'bg-bad-soft' : ''}`}>
                      <span className="text-[12px] text-muted w-9 shrink-0 tabular-nums">L{r.line}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[14px] truncate">{r.full_name || '—'}</p>
                        <p className="text-[13px] text-muted truncate"><span className="money">{r.student_no || '—'}</span>
                          {' · '}{r.course ?? 'no course'}{r.year_level ? ` ${r.year_level}` : ''}</p>
                      </div>
                      <span className="shrink-0">{bad ? <Chip tone="bad">Fix</Chip> : isNew(r.student_no) ? <Chip tone="primary">New</Chip> : existing.data ? <Chip tone="muted">Update</Chip> : null}</span>
                    </li>
                  );
                })}
              </ul>
              {parsed.rows.length > 100 && <p className="px-3 py-2 text-[13px] text-muted border-t border-line">Showing the first 100 of {parsed.rows.length.toLocaleString('en-PH')}.</p>}
            </div>
            <Button className="w-full h-[54px]" busy={busy} disabled={errs.length > 0} onClick={run}>
              Import {parsed.rows.length.toLocaleString('en-PH')} student{parsed.rows.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
