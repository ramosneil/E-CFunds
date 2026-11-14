import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { BellRing, Info, MoreVertical, Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntities, useSemesters } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, normStudentNo, peso } from '../../lib/format';
import { Alert, Button, Card, Chip, DuesBar, Empty, Field, Input, PageHeader, Select, Sheet, Spinner } from '../../components/ui';
import { NoYear, Segmented } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';
import { confirmAsk, promptAsk } from '../../lib/confirm';
import { toast } from '../../lib/toast';

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
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const members = useQuery({
    queryKey: ['memberships', entityId, year.data?.id, perSemester ? sem?.id : null],
    enabled: !!year.data && !!entity && (!perSemester || !!sem),
    queryFn: async () => {
      // Fees are per semester: each semester has its own member list (clubs are chosen again every semester).
      let qy = supabase.from('memberships')
        .select('*, student:students(id, student_no, full_name, course, year_level)')
        .eq('entity_id', entityId).eq('school_year_id', year.data!.id);
      if (perSemester && sem) qy = qy.eq('semester_id', sem.id);
      const { data, error } = await qy.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Receipt number of each paid member (active receipts only; voided ones stay on the receipt page).
  const receipts = useQuery({
    queryKey: ['receipts', entityId, year.data?.id],
    enabled: !!year.data && !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase.from('receipts').select('membership_id, receipt_no')
        .eq('entity_id', entityId).eq('school_year_id', year.data!.id).is('voided_at', null);
      if (error) throw error;
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
          {entity && <ExportMenu label="CSV" options={[{ label: 'Members & dues', kind: 'csv', run: async () => (await exportsLib()).membersCsv(entity, year.data!) }]} />}
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
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate flex items-center gap-2">
                    <span className="truncate">{m.student?.full_name}</span>
                    {isClub && m.via_course && <span className="shrink-0 text-[11px] font-semibold px-2 h-5 rounded-full inline-flex items-center bg-primary-soft text-primary" title="Added automatically by the student's course">From course</span>}
                    {m.carried_over && !m.is_paid && <span className="shrink-0 text-[11px] font-semibold px-2 h-5 rounded-full inline-flex items-center bg-warn-soft text-warn" title="Member last semester. Record the fee if they stay; if they join another club, this listing is removed.">Carried over</span>}
                  </p>
                  <p className="text-[13px] text-muted truncate">{m.student?.student_no}{m.student?.course ? ` · ${m.student.course}` : ''}{m.student?.year_level ? ` ${m.student.year_level}` : ''}{m.is_paid ? ` · paid ${date(m.paid_at)}` : ''}</p>
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
            ))}
            {!rows.length && <li className="px-5 py-6 text-center text-muted">No one matches.</li>}
          </ul>
        </Card>
      )}
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
  const [found, setFound] = useState<{ id: number; full_name: string; course: string | null } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ name: string; membershipId: number | null; due: number; toCollect: string[] } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const me = entities.data?.find((e) => e.id === entityId);
  // The course that will count: the roster's, if the student already has one; otherwise what the treasurer picks.
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

  async function lookup() {
    if (normStudentNo(no).length < 3) return;
    const { data, error } = await supabase.from('students').select('id, full_name, course').eq('student_no', normStudentNo(no)).maybeSingle();
    if (error) setErr(errorText(error)); else setFound(data);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (found === null && !pick) { setErr('Choose the student’s course.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('add_member', {
      p_student_no: normStudentNo(no), p_full_name: name.trim(), p_course: course || null,
      p_year_level: level ? Number(level) : null,
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
        <Field label="Student ID" hint="We check the school roster first.">
          <Input required value={no} onChange={(e) => { setNo(e.target.value); setFound(undefined); setErr(''); }} onBlur={lookup} placeholder="e.g. 2024-0317" />
        </Field>
        {found ? <Alert tone="ok">On the roster: <b>{found.full_name}</b>{found.course ? ` · ${found.course}` : ''}</Alert> : found === null && (
          <>
            <Alert tone="warn">Not on the roster yet. Add their details:</Alert>
            <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Course">
                <Select required value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="" disabled>Choose…</option>
                  {(rules.data?.courses ?? []).map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                  <option value={OTHER}>Other course…</option>
                </Select>
              </Field>
              <Field label="Year level"><Input type="number" inputMode="numeric" min={1} max={6} value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
            </div>
            {pick === OTHER && <Field label="Other course" hint="Students of other courses join SSG automatically."><Input required value={otherCourse} onChange={(e) => setOtherCourse(e.target.value)} placeholder="e.g. BSCRIM" /></Field>}
          </>
        )}
        {found !== undefined && (course || found) && (blocked ? (
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
        <Button type="submit" busy={busy} disabled={found === undefined || blocked} className="w-full h-[54px]">Add member</Button>
        {found === undefined && <p className="text-[13px] text-muted text-center -mt-2">Enter the student ID, then tap outside the box to check it.</p>}
      </form>
    </Sheet>
  );
}
