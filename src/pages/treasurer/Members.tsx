import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { BellRing, ChevronRight, FileDown, Info, MoreVertical, Search, Upload, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntities, useSemesters } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, normStudentNo, peso } from '../../lib/format';
import { Alert, Button, Card, Chip, DuesBar, Empty, Field, Input, PageHeader, Select, Sheet, Spinner } from '../../components/ui';
import { NoYear, Segmented } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';
import { confirmAsk, promptAsk } from '../../lib/confirm';
import { toast } from '../../lib/toast';
import { fetchAll } from '../../lib/fetchAll';
import { SECTIONS, YEARS, yearSection } from '../../lib/roster';
import { ImportSheet, useCourses } from '../admin/Students';

export function Members() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? 0;
  const year = useCurrentYear();
  const entities = useEntities();
  const entity = entities.data?.find((e) => e.id === entityId);
  const sems = useSemesters(year.data?.id);
  const perSemester = entity?.dues_period === 'semester';
  const isClub = entity?.category === 'club';   // only clubs add students; organizations get them by course
  const sem = sems.data?.find((s) => s.is_current);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [params] = useSearchParams();   // Home's Dues card and "Record payment" open the "To collect" list
  const [show, setShow] = useState<'all' | 'unpaid' | 'paid'>(() => {
    const s = params.get('show');
    return s === 'unpaid' || s === 'paid' ? s : 'all';
  });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const courses = useCourses();
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [openGroup, setOpenGroup] = useState<string | null>(null);   // the year-section shown in the pop-up list
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ['memberships', entityId, year.data?.id, perSemester ? sem?.id : null],
    enabled: !!year.data && !!entity && (!perSemester || !!sem),
    queryFn: async () => {
      // Fees are per semester: each semester has its own member list (clubs are chosen again every semester).
      // Every member, page by page — SSG has every student, past the server's 1,000-rows-per-request limit.
      return fetchAll((from, to) => {
        let qy = supabase.from('memberships')
          .select('*, student:students(id, student_no, full_name, course, year_level, section)')
          .eq('entity_id', entityId).eq('school_year_id', year.data!.id);
        if (perSemester && sem) qy = qy.eq('semester_id', sem.id);
        return qy.order('created_at', { ascending: false }).order('id').range(from, to);
      });
    },
  });

  // Receipt number of each paid member (active receipts only; voided ones stay on the receipt page).
  const receipts = useQuery({
    queryKey: ['receipts', entityId, year.data?.id],
    enabled: !!year.data && !!entityId,
    queryFn: async () => {
      const data = await fetchAll((from, to) => supabase.from('receipts').select('membership_id, receipt_no')
        .eq('entity_id', entityId).eq('school_year_id', year.data!.id).is('voided_at', null).order('id').range(from, to));
      return new Map(data.map((x) => [x.membership_id, x.receipt_no]));
    },
  });

  // Last "Remind unpaid" for this org/club (button: max once a day; a weekly automatic one goes out on Mondays).
  const lastReminder = useQuery({
    queryKey: ['dues-reminders', entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase.from('dues_reminders').select('sent_at, sent_on, sent_by, students')
        .eq('entity_id', entityId).order('sent_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [reminding, setReminding] = useState(false);
  async function remind(unpaid: number) {
    if (!(await confirmAsk({ title: `Remind ${unpaid} unpaid member${unpaid === 1 ? '' : 's'}?`,
      body: 'Each student with an E-CFunds account gets a note with the amount they still owe. You can send one reminder a day; an automatic one also goes out every Monday.',
      confirm: 'Send reminder', tone: 'primary' }))) return;
    setReminding(true); setErr('');
    const { data, error } = await supabase.rpc('remind_unpaid', { p_entity_id: entityId });
    setReminding(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries({ queryKey: ['dues-reminders', entityId] });
    toast({ title: 'Reminder sent', body: data ? `${data} student${data === 1 ? '' : 's'} with an account were reminded.` : 'None of the unpaid members has an E-CFunds account yet.', tone: 'ok', silent: true });
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (members.data ?? []).filter((m) =>
      (show === 'all' || (show === 'paid') === m.is_paid) &&
      (!s || m.student?.full_name.toLowerCase().includes(s) || m.student?.student_no.toLowerCase().includes(s)))
      .sort((a, b) => (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? ''));
  }, [members.data, q, show]);

  // Grouped by year + section (1A, 1B … 4D), then year only, then "No year / section".
  const groups = useMemo(() => {
    const by = new Map<string, typeof rows>();
    for (const m of rows) {
      const k = yearSection(m.student?.year_level, m.student?.section) || '~';
      by.set(k, [...(by.get(k) ?? []), m]);
    }
    const label = (k: string) => (k === '~' ? 'No year / section' : /^\d$/.test(k) ? `Year ${k} · no section` : k);
    return [...by.entries()].sort(([a], [b]) => (a === '~' ? 1 : b === '~' ? -1 : a.localeCompare(b)))
      .map(([key, list]) => ({ key, label: label(key), rows: list }));
  }, [rows]);

  // Year level → its section groups, for the tiles (Neil, 2026-11-19: tap a section to see its list).
  const years = useMemo(() => {
    const by = new Map<number, typeof groups>();
    for (const g of groups) {
      const y = g.key === '~' ? 0 : Number(g.key[0]);
      by.set(y, [...(by.get(y) ?? []), g]);
    }
    return [...by.entries()].sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
  }, [groups]);
  const yearName = (y: number) => (y === 0 ? 'No year level' : `${y}${y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} year`);

  // Print-ready PDF of everyone, one year level, or one section (always the full list, whatever the filter).
  async function exportPdf(scope: string, pick: (m: NonNullable<typeof members.data>[number]) => boolean, key: string) {
    if (!entity || !year.data) return;
    setPdfBusy(key); setErr('');
    try {
      const { membersPdf } = await import('../../lib/export/membersPdf');
      await membersPdf({
        entity, schoolYear: year.data.label,
        period: perSemester ? (sem ? `${sem.term === 1 ? '1st' : '2nd'} semester` : 'this semester') : 'whole school year',
        scope,
        rows: (members.data ?? []).filter(pick).map((m) => ({
          student_no: m.student?.student_no ?? '', full_name: m.student?.full_name ?? '', course: m.student?.course ?? null,
          year_level: m.student?.year_level ?? null, section: m.student?.section ?? null,
          is_paid: m.is_paid, amount_due: Number(m.amount_due), receipt_no: receipts.data?.get(m.id) ?? null,
        })),
      });
    } catch (x) { setErr(errorText(x)); } finally { setPdfBusy(null); }
  }
  const keyOf = (m: NonNullable<typeof members.data>[number]) => yearSection(m.student?.year_level, m.student?.section) || '~';

  async function pay(id: number) {
    setBusy(id); setErr('');
    const { error } = await supabase.rpc('record_payment', { p_membership_id: id });
    setBusy(null);
    if (error) setErr(errorText(error));
    void qc.invalidateQueries();
  }
  async function undo(id: number, name: string) {
    const reason = await promptAsk({ title: `Undo ${name}'s payment?`, body: 'This adds a correction (reversal) to the ledger — nothing is deleted.', confirm: 'Undo payment', tone: 'bad',
      input: { label: 'Reason', placeholder: 'e.g. Recorded for the wrong student', minLength: 3 } });
    if (!reason) return;
    setBusy(id); setErr('');
    const { error } = await supabase.rpc('undo_payment', { p_membership_id: id, p_reason: reason.trim() });
    setBusy(null);
    if (error) setErr(errorText(error));
    void qc.invalidateQueries();
  }

  const renderRow = (m: NonNullable<typeof members.data>[number]) => (
              <li key={m.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate flex items-center gap-2">
                    <span className="truncate">{m.student?.full_name}</span>
                    {isClub && m.via_course && <span className="shrink-0 text-[11px] font-semibold px-2 h-5 rounded-full inline-flex items-center bg-primary-soft text-primary" title="Added automatically by the student's course">From course</span>}
                    {m.carried_over && !m.is_paid && <span className="shrink-0 text-[11px] font-semibold px-2 h-5 rounded-full inline-flex items-center bg-warn-soft text-warn" title="Member last semester. Record the fee if they stay; if they join another club, this listing is removed.">Carried over</span>}
                  </p>
                  <p className="text-[13px] text-muted truncate">{m.student?.student_no}{m.student?.course ? ` · ${m.student.course}` : ''}{m.is_paid ? ` · paid ${date(m.paid_at)}` : ''}</p>
                  {m.is_paid && receipts.data?.get(m.id) && (
                    <Link to={`/receipt/${receipts.data.get(m.id)}`} className="inline-flex items-center min-h-8 text-[13px] font-semibold text-primary hover:underline money">
                      Receipt {receipts.data.get(m.id)}
                    </Link>
                  )}
                </div>
                <span className="money font-semibold hidden sm:block">{peso(m.amount_due)}</span>
                {m.is_paid ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Chip tone="ok">Paid</Chip>
                    <button onClick={() => undo(m.id, m.student?.full_name ?? '')} disabled={busy === m.id}
                      aria-label={`Undo ${m.student?.full_name ?? 'this member'}'s payment`} title="Undo payment"
                      className="size-11 -mr-2 grid place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink cursor-pointer disabled:opacity-50">
                      <MoreVertical className="size-5" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <Button variant="gold" className="h-10 px-4 text-[14px]" busy={busy === m.id} onClick={() => pay(m.id)}>Record {peso(m.amount_due)}</Button>
                )}
              </li>
  );

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Members" /><NoYear /></>;
  const all = members.data ?? [];
  const paid = all.filter((m) => m.is_paid).length;
  const collected = all.filter((m) => m.is_paid).reduce((t, m) => t + Number(m.amount_due), 0);
  const toCollect = all.filter((m) => !m.is_paid).reduce((t, m) => t + Number(m.amount_due), 0);

  return (
    <>
      <PageHeader title="Members" sub={entity ? `${entity.short_name} · ${peso(entity.dues_amount)} ${perSemester ? (sem ? `· ${sem.term === 1 ? '1st' : '2nd'} semester` : 'per semester') : 'per school year'}` : undefined}
        action={<div className="flex items-center gap-2">
          {entity && <ExportMenu label="Export" options={[
            { label: 'All members (print-ready)', kind: 'pdf', run: () => exportPdf('All members', () => true, 'all') },
            { label: 'Members & dues', kind: 'csv', run: async () => (await exportsLib()).membersCsv(entity, year.data!) },
          ]} />}
          {isClub && <Button variant="soft" aria-label="Import members" onClick={() => setImporting(true)}><Upload className="size-5" /><span className="hidden sm:inline">Import</span></Button>}
          {isClub && <Button aria-label="Add member" onClick={() => setAdding(true)}><UserPlus className="size-5" /><span className="hidden sm:inline">Add member</span></Button>}
        </div>} />
      <Card className="mb-4">
        <DuesBar paid={paid} members={all.length} />
        {all.length > 0 && (
          <p className="text-[13px] text-muted mt-1">
            <b className="money text-ok">{peso(collected)}</b> collected · <b className="money text-ink">{peso(toCollect)}</b> to collect
          </p>
        )}
        {all.length - paid > 0 && (() => {
          const last = lastReminder.data;
          const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
          const sentToday = last?.sent_on === today;
          return (
            <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button variant="soft" className="h-11 px-4 text-[14px]" busy={reminding} disabled={sentToday} onClick={() => remind(all.length - paid)}>
                <BellRing className="size-4" aria-hidden />Remind unpaid · {all.length - paid}
              </Button>
              <span className="text-[13px] text-muted">
                {last ? `${sentToday ? 'Sent today' : `Last sent ${date(last.sent_at)}`}${last.sent_by ? '' : ' (automatic)'} · ${last.students} reminded` : 'An automatic reminder also goes out every Monday.'}
              </span>
            </div>
          );
        })()}
      </Card>
      {entity && !isClub && (
        <div className="mb-4 rounded-[16px] bg-primary-soft text-primary p-4 flex gap-3 text-[14px]">
          <Info className="size-5 shrink-0" aria-hidden />
          <p>{entity.is_school_wide
            ? `Students join ${entity.short_name} automatically when a club adds them.`
            : `Students join ${entity.short_name} automatically, by their course, when a club adds them.`} Record each fee when it’s paid.</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search members" placeholder="Search name or student ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-12" />
        </div>
        <div className="sm:w-72"><Segmented value={show} onChange={setShow} options={[['all', 'All'], ['unpaid', 'To collect'], ['paid', 'Paid']]} /></div>
      </div>
      {perSemester && sems.isSuccess && !sem && <div className="mb-3"><Alert tone="warn">SAS hasn’t set the current semester yet, so members can’t be added. Ask SAS to open it on the School year page.</Alert></div>}
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {members.isLoading ? <Spinner /> : !all.length ? (
        <Card><Empty icon={<Users className="size-6" />} title="No members yet this semester">{isClub
          ? 'Add students who join your club. They start as to collect; record the fee when they pay.'
          : 'Members appear here automatically: when a club adds a student, they join SSG and their course organizations.'}</Empty></Card>
      ) : (
        q.trim() === '' ? (
        <div className="space-y-4">
          {years.map(([y, list]) => {
            const n = list.reduce((t, g) => t + g.rows.length, 0), np = list.reduce((t, g) => t + g.rows.filter((m) => m.is_paid).length, 0);
            return (
              <Card key={y}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-[18px]">{yearName(y)}</h2>
                    <p className="text-[13px] text-muted">{n} member{n === 1 ? '' : 's'} · {np} paid</p>
                  </div>
                  <Button variant="soft" className="h-11 px-3 text-[14px]" busy={pdfBusy === `y${y}`}
                    onClick={() => exportPdf(yearName(y), (m) => (m.student?.year_level ?? 0) === y, `y${y}`)}>
                    <FileDown className="size-4" aria-hidden /><span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {list.map((g) => {
                    const gp = g.rows.filter((m) => m.is_paid).length;
                    return (
                      <button key={g.key} type="button" onClick={() => setOpenGroup(g.key)}
                        className="text-left rounded-[14px] border border-line bg-surface2 hover:bg-primary-soft hover:border-primary/40 p-3 cursor-pointer transition">
                        <span className="flex items-center gap-1 font-display font-extrabold text-[17px]">{g.key === '~' ? 'No section' : /^\d$/.test(g.key) ? `${g.key} · no section` : g.key}<ChevronRight className="size-4 ml-auto text-muted" aria-hidden /></span>
                        <span className="block text-[12.5px] text-muted mt-0.5">{g.rows.length} · {gp} paid</span>
                        <span className="block h-1.5 mt-2 rounded-full bg-line overflow-hidden"><span className="block h-full bg-ok" style={{ width: `${g.rows.length ? (gp / g.rows.length) * 100 : 0}%` }} /></span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {!rows.length && <Card><p className="text-center text-muted py-2">No one in this list.</p></Card>}
        </div>
        ) : (
        <div className="space-y-4">
          {groups.map((g) => (
          <Card key={g.key} className="p-0 overflow-hidden">
          <div className="px-4 sm:px-5 py-2.5 bg-surface2 border-b border-line flex items-center justify-between gap-3">
            <h2 className="font-display font-bold text-[16px]">{g.label}</h2>
            <span className="text-[13px] text-muted">{g.rows.length} member{g.rows.length === 1 ? '' : 's'} · {g.rows.filter((m) => m.is_paid).length} paid</span>
          </div>
          <ul className="divide-y divide-line">
            {g.rows.map(renderRow)}
          </ul>
          </Card>
          ))}
          {!rows.length && <Card><p className="text-center text-muted py-2">No one matches.</p></Card>}
        </div>
        )
      )}
      {openGroup && (() => {
        const g = groups.find((x) => x.key === openGroup);
        const label = openGroup === '~' ? 'No year / section' : /^\d$/.test(openGroup) ? `Year ${openGroup} · no section` : `Section ${openGroup}`;
        return (
          <Sheet open onClose={() => setOpenGroup(null)} title={`${label} · ${entity?.short_name ?? ''}`}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-[14px] text-muted flex-1">{g ? `${g.rows.length} member${g.rows.length === 1 ? '' : 's'} · ${g.rows.filter((m) => m.is_paid).length} paid` : 'No one here with this filter.'}</p>
              <Button variant="soft" className="h-11 px-3 text-[14px]" busy={pdfBusy === `g${openGroup}`}
                onClick={() => exportPdf(label, (m) => keyOf(m) === openGroup, `g${openGroup}`)}><FileDown className="size-4" aria-hidden />PDF</Button>
            </div>
            {g && <ul className="divide-y divide-line -mx-5 border-t border-line">{g.rows.map(renderRow)}</ul>}
          </Sheet>
        );
      })()}
      {importing && isClub && <ImportSheet mode="club" courses={(courses.data ?? []).map((c) => c.code)} onClose={() => setImporting(false)} />}
      {adding && entity && isClub && <AddMember onClose={() => setAdding(false)} entityId={entityId} dues={Number(entity.dues_amount)} perSemester={entity.dues_period === 'semester'} />}
    </>
  );
}

/** Course list + which organizations each course belongs to (SAS-managed rules; SSG is everyone). */
function useCourseRules() {
  return useQuery({
    queryKey: ['course-rules'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [c, o] = await Promise.all([
        supabase.from('courses').select('code, name, sort').order('sort'),
        supabase.from('course_orgs').select('course, entity_id'),
      ]);
      if (c.error) throw c.error;
      if (o.error) throw o.error;
      return { courses: c.data, orgs: o.data };
    },
  });
}

const OTHER = '__other';

function AddMember({ onClose, entityId, dues, perSemester }: { onClose: () => void; entityId: number; dues: number; perSemester: boolean }) {
  const qc = useQueryClient();
  const rules = useCourseRules();
  const entities = useEntities();
  const [no, setNo] = useState('');
  const [name, setName] = useState('');
  const [pick, setPick] = useState('');          // course code, OTHER, or '' (not chosen)
  const [otherCourse, setOtherCourse] = useState('');
  const [level, setLevel] = useState('');
  const [section, setSection] = useState('');
  type Found = { id: number; full_name: string; course: string | null; year_level: number | null; section: string | null };
  const [found, setFound] = useState<Found | null | undefined>(undefined);   // undefined = not checked yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ name: string; membershipId: number | null; due: number; toCollect: string[] } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const me = entities.data?.find((e) => e.id === entityId);
  // The course that will count: the list's, if the student already has one; otherwise what the treasurer picks.
  const course = (found?.course ?? (pick === OTHER ? otherCourse : pick)).trim().toUpperCase().replace(/\s+/g, ' ');
  const courseOrgIds = (rules.data?.orgs ?? []).filter((o) => o.course === course).map((o) => o.entity_id);
  const isCourseStudent = courseOrgIds.length > 0;
  const ssg = entities.data?.filter((e) => e.is_school_wide) ?? [];
  const preview = [
    ...ssg,
    ...(entities.data ?? []).filter((e) => courseOrgIds.includes(e.id) && !e.is_school_wide),
    ...(me && !me.is_school_wide && !courseOrgIds.includes(me.id) ? [me] : []),
  ];
  // An organization treasurer cannot take a student whose course belongs to other organizations.
  const blocked = !!me && me.category === 'organization' && !me.is_school_wide && isCourseStudent && !courseOrgIds.includes(me.id);

  // Look the Student ID up while typing (short pause): a student already on the list fills in the rest.
  useEffect(() => {
    const id = normStudentNo(no);
    if (id.length < 3) { setFound(undefined); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.from('students').select('id, full_name, course, year_level, section').eq('student_no', id).maybeSingle();
      if (!alive) return;
      if (error) { setErr(errorText(error)); return; }
      setFound(data);
      if (data) {
        setName(data.full_name);
        if (data.year_level) setLevel(String(data.year_level));
        if (data.section) setSection(data.section);
      }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [no]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (normStudentNo(no).length < 3) { setErr('Type the Student ID.'); return; }
    if (!found && !name.trim()) { setErr('Type the student’s full name.'); return; }
    if (!found && !pick) { setErr('Choose the student’s course.'); return; }
    if (pick === OTHER && !found && !otherCourse.trim()) { setErr('Type the other course.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('add_member', {
      p_student_no: normStudentNo(no), p_full_name: name.trim(), p_course: course || null,
      p_year_level: level ? Number(level) : null, p_section: section || null,
    });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    setDone({ name: found?.full_name ?? name.trim(), membershipId: data?.membership_id ?? null, due: Number(data?.amount_due ?? dues), toCollect: data?.to_collect ?? [] });
  }

  if (done) return (
    <Sheet open onClose={onClose} title="Member added">
      <Alert tone="ok"><b>{done.name}</b> is now a member of {me?.short_name}{paid ? <> · <b className="money">{peso(done.due)}</b> recorded as paid</> : <> · <b>to collect</b> <span className="money">{peso(done.due)}</span></>}.</Alert>
      {done.toCollect.length > 0 && (
        <p className="text-[14px] text-muted mt-3">Also listed by their course, <b className="text-ink">to collect</b> by each treasurer: {done.toCollect.join(', ')}.</p>
      )}
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {!paid && done.membershipId && done.due > 0 ? (
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Button variant="soft" className="h-[54px]" onClick={onClose}>Not yet</Button>
          <Button variant="gold" className="h-[54px]" busy={paying} onClick={async () => {
            setPaying(true); setErr('');
            const { error } = await supabase.rpc('record_payment', { p_membership_id: done.membershipId! });
            setPaying(false);
            if (error) { setErr(errorText(error)); return; }
            setPaid(true); void qc.invalidateQueries();
          }}>They paid · {peso(done.due)}</Button>
        </div>
      ) : (
        <Button className="w-full h-[54px] mt-5" onClick={onClose}>Done</Button>
      )}
    </Sheet>
  );

  return (
    <Sheet open onClose={onClose} title="Add member">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student ID" hint={found ? undefined : 'If the student is already on the school list, the rest fills in by itself.'}>
          <Input required value={no} onChange={(e) => { setNo(e.target.value); setErr(''); if (found) { setFound(undefined); setName(''); setLevel(''); setSection(''); } }} placeholder="e.g. 24-1-03178" autoComplete="off" className="money" />
        </Field>
        {found && <Alert tone="ok">On the school list: <b>{found.full_name}</b>{found.course ? ` · ${found.course}` : ''}. Check the year and section.</Alert>}
        <Field label="Full name"><Input required={!found} value={name} onChange={(e) => setName(e.target.value)} disabled={!!found} autoComplete="off" placeholder="e.g. Juan Dela Cruz" /></Field>
        <Field label="Course">
          {found?.course ? <Input value={found.course} disabled /> : (
            <Select required={!found} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="" disabled>Choose…</option>
              {(rules.data?.courses ?? []).map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
              <option value={OTHER}>Other course…</option>
            </Select>
          )}
        </Field>
        {pick === OTHER && !found?.course && <Field label="Other course" hint="Students of other courses join SSG automatically."><Input required value={otherCourse} onChange={(e) => setOtherCourse(e.target.value)} placeholder="e.g. BSCRIM" /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year level">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">—</option>
              {YEARS.map((y) => <option key={y} value={y}>{y === '1' ? '1st' : y === '2' ? '2nd' : y === '3' ? '3rd' : '4th'} year</option>)}
            </Select>
          </Field>
          <Field label="Section">
            <Select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">—</option>
              {SECTIONS.map((x) => <option key={x} value={x}>Section {x}</option>)}
            </Select>
          </Field>
        </div>
        {(course || found) && (blocked ? (
          <Alert>
            {course} students belong to {['SSG', ...(entities.data ?? []).filter((x) => courseOrgIds.includes(x.id)).map((x) => x.short_name)].join(', ')}, set by their course.
            They can’t be added to {me?.short_name}.
          </Alert>
        ) : (
          <div className="rounded-[16px] bg-primary-soft text-primary p-4 text-[14px]">
            <p className="font-semibold">Will be a member of</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {preview.map((x) => (
                <span key={x.id} className={`px-2.5 h-7 rounded-full inline-flex items-center text-[13px] font-semibold ${x.id === entityId ? 'bg-primary text-on-primary' : 'bg-surface text-ink border border-line'}`}>{x.short_name}</span>
              ))}
            </div>
            <p className="text-[12.5px] mt-2 opacity-90">{isCourseStudent ? `Organizations come from the course (${course}). ` : ''}Each one collects its own fee.</p>
          </div>
        ))}
        <p className="text-[14px] text-muted">
          They start as <b className="text-ink">to collect</b> (<span className="money">{peso(dues)}</span> {perSemester ? 'this semester' : 'this school year'}). Record the payment when they pay — right after adding, or later from the list.
        </p>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={blocked} className="w-full h-[54px]">Add member</Button>
      </form>
    </Sheet>
  );
}
