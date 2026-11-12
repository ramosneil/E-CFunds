import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntities, useSemesters } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, peso } from '../../lib/format';
import { Alert, Button, Card, Chip, DuesBar, Empty, Field, Input, PageHeader, Sheet, Spinner } from '../../components/ui';
import { NoYear, Segmented } from '../../components/common';

export function Members() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? 0;
  const year = useCurrentYear();
  const entities = useEntities();
  const entity = entities.data?.find((e) => e.id === entityId);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const members = useQuery({
    queryKey: ['memberships', entityId, year.data?.id],
    enabled: !!year.data,
    queryFn: async () => {
      const { data, error } = await supabase.from('memberships')
        .select('*, student:students(id, student_no, full_name, course, year_level)')
        .eq('entity_id', entityId).eq('school_year_id', year.data!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
    const reason = window.prompt(`Undo ${name}'s payment? This adds a reversal to the ledger (nothing is deleted).\n\nReason:`);
    if (!reason || reason.trim().length < 3) return;
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

  return (
    <>
      <PageHeader title="Members" sub={entity ? `${entity.short_name} · dues ${peso(entity.dues_amount)} ${entity.dues_period === 'semester' ? 'per semester' : 'per school year'}` : undefined}
        action={<Button onClick={() => setAdding(true)}><UserPlus className="size-5" /><span className="hidden sm:inline">Add member</span></Button>} />
      <Card className="mb-4"><DuesBar paid={paid} members={all.length} /></Card>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search members" placeholder="Search name or student ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-12" />
        </div>
        <div className="sm:w-72"><Segmented value={show} onChange={setShow} options={[['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid']]} /></div>
      </div>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {members.isLoading ? <Spinner /> : !all.length ? (
        <Card><Empty icon={<Users className="size-6" />} title="No members yet">Add students by their student ID. Their dues start as unpaid.</Empty></Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{m.student?.full_name}</p>
                  <p className="text-[13px] text-muted truncate">{m.student?.student_no}{m.student?.course ? ` · ${m.student.course}` : ''}{m.student?.year_level ? ` ${m.student.year_level}` : ''}{m.is_paid ? ` · paid ${date(m.paid_at)}` : ''}</p>
                </div>
                <span className="money font-semibold hidden sm:block">{peso(m.amount_due)}</span>
                {m.is_paid ? (
                  <button onClick={() => undo(m.id, m.student?.full_name ?? '')} disabled={busy === m.id} className="cursor-pointer" title="Undo payment"><Chip tone="ok">Paid</Chip></button>
                ) : (
                  <Button variant="gold" className="h-10 px-4 text-[14px]" busy={busy === m.id} onClick={() => pay(m.id)}>Record {peso(m.amount_due)}</Button>
                )}
              </li>
            ))}
            {!rows.length && <li className="px-5 py-6 text-center text-muted">No one matches.</li>}
          </ul>
        </Card>
      )}
      {adding && entity && <AddMember onClose={() => setAdding(false)} entityId={entityId} yearId={year.data.id} dues={Number(entity.dues_amount)} perSemester={entity.dues_period === 'semester'} />}
    </>
  );
}

function AddMember({ onClose, entityId, yearId, dues, perSemester }: { onClose: () => void; entityId: number; yearId: number; dues: number; perSemester: boolean }) {
  const qc = useQueryClient();
  const sems = useSemesters(yearId);
  const [no, setNo] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [level, setLevel] = useState('');
  const [found, setFound] = useState<{ id: number; full_name: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function lookup() {
    if (no.trim().length < 3) return;
    const { data, error } = await supabase.from('students').select('id, full_name').eq('student_no', no.trim()).maybeSingle();
    if (error) setErr(errorText(error)); else setFound(data);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      let studentId = found?.id;
      if (!studentId) {
        const s = await supabase.from('students').insert({
          student_no: no.trim(), full_name: name.trim(), course: course.trim() || null, year_level: level ? Number(level) : null,
        }).select('id').single();
        if (s.error) throw s.error;
        studentId = s.data.id;
      }
      const semesterId = perSemester ? sems.data?.find((s) => s.is_current)?.id : undefined;
      if (perSemester && !semesterId) throw new Error('Your dues are per semester, but SAS has not set the current semester yet.');
      const m = await supabase.from('memberships').insert({ student_id: studentId, entity_id: entityId, school_year_id: yearId, semester_id: semesterId ?? null, amount_due: dues });
      if (m.error) throw /duplicate key/.test(m.error.message) ? new Error('This student is already a member.') : m.error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="Add member">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Student ID" hint="We check the school roster first.">
          <Input required value={no} onChange={(e) => { setNo(e.target.value); setFound(undefined); }} onBlur={lookup} placeholder="e.g. 2024-0317" />
        </Field>
        {found ? <Alert tone="ok">On the roster: <b>{found.full_name}</b></Alert> : found === null && (
          <>
            <Alert tone="warn">Not on the roster yet. Add their details:</Alert>
            <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Course"><Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="BSIT" /></Field>
              <Field label="Year level"><Input type="number" min={1} max={6} value={level} onChange={(e) => setLevel(e.target.value)} /></Field>
            </div>
          </>
        )}
        <p className="text-[14px] text-muted">Dues: <b className="text-ink money">{peso(dues)}</b> {perSemester ? 'this semester' : 'this school year'}, starts unpaid.</p>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={found === undefined} className="w-full h-[54px]">Add member</Button>
        {found === undefined && <p className="text-[13px] text-muted text-center -mt-2">Enter the student ID, then tap outside the box to check it.</p>}
      </form>
    </Sheet>
  );
}
