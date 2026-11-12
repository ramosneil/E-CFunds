import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Pencil } from 'lucide-react';
import { useSchoolYears, useSemesters } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, manilaDate } from '../../lib/format';
import { Alert, Button, Card, Chip, Empty, Field, Input, PageHeader, SectionTitle, Sheet, Spinner } from '../../components/ui';
import type { Row } from '../../lib/database.types';

export function Calendar() {
  const years = useSchoolYears();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeader title="School year" sub="Dues, requests and reports belong to the current school year."
        action={<Button onClick={() => setAdding(true)}><CalendarPlus className="size-5" /><span className="sm:hidden">New</span><span className="hidden sm:inline">New school year</span></Button>} />
      {years.isLoading ? <Spinner /> : years.data?.length ? (
        <div className="space-y-4">{years.data.map((y) => <YearCard key={y.id} y={y} />)}</div>
      ) : (
        <Card><Empty icon={<CalendarPlus className="size-6" />} title="No school years yet">Create the current school year to start. Its two semesters are added for you.</Empty></Card>
      )}
      <NewYearSheet open={adding} onClose={() => setAdding(false)} hasCurrent={!!years.data?.some((y) => y.is_current)} />
    </>
  );
}

function YearCard({ y }: { y: Row<'school_years'> }) {
  const sems = useSemesters(y.id);
  const qc = useQueryClient();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function makeCurrent(kind: 'year' | 'sem', id: number) {
    setBusy(kind + id); setErr('');
    // One current row per table (unique index): clear the old one, then set the new one.
    const table = kind === 'year' ? 'school_years' : 'semesters';
    const clear = await supabase.from(table).update({ is_current: false }).eq('is_current', true);
    const set = clear.error ? clear : await supabase.from(table).update({ is_current: true }).eq('id', id);
    setBusy(null);
    if (set.error) setErr(errorText(set.error));
    void qc.invalidateQueries();
  }

  return (
    <Card>
      <SectionTitle action={y.is_current ? <Chip tone="ok">Current</Chip>
        : <Button variant="soft" className="h-10" busy={busy === 'year' + y.id} onClick={() => makeCurrent('year', y.id)}>Make current</Button>}>
        {y.label}
      </SectionTitle>
      <div className="flex items-center justify-between gap-3 -mt-2 mb-4">
        <p className="text-muted text-[14px]">{date(y.starts_on)} – {date(y.ends_on)}</p>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-primary font-semibold text-[14px] cursor-pointer"><Pencil className="size-4" />Edit dates</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sems.data?.map((s) => (
          <div key={s.id} className="rounded-[16px] bg-surface2 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{s.term === 1 ? '1st' : s.term === 2 ? '2nd' : 'Summer'} semester</p>
              <p className="text-[13px] text-muted">{date(s.starts_on)} – {date(s.ends_on)}</p>
            </div>
            {s.is_current ? <Chip tone="ok">Current</Chip>
              : y.is_current && <Button variant="ghost" className="h-10 px-3 text-[14px]" busy={busy === 'sem' + s.id} onClick={() => makeCurrent('sem', s.id)}>Make current</Button>}
          </div>
        ))}
      </div>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {editing && sems.data && <EditDatesSheet y={y} sems={sems.data} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function EditDatesSheet({ y, sems, onClose }: { y: Row<'school_years'>; sems: Row<'semesters'>[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(y.label);
  const [d, setD] = useState(() => Object.fromEntries(sems.map((s) => [s.id, { start: s.starts_on, end: s.ends_on }])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ordered = [...sems].sort((a, b) => a.term - b.term);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const seq = ordered.flatMap((s) => [d[s.id].start, d[s.id].end]);
    if (seq.some((v, i) => !v || (i > 0 && v <= seq[i - 1]))) { setErr('Dates must run in order: each semester starts after the previous one ends.'); return; }
    setBusy(true); setErr('');
    try {
      for (const s of ordered) {
        const r = await supabase.from('semesters').update({ starts_on: d[s.id].start, ends_on: d[s.id].end }).eq('id', s.id);
        if (r.error) throw r.error;
      }
      const r = await supabase.from('school_years').update({ label: label.trim(), starts_on: seq[0], ends_on: seq[seq.length - 1] }).eq('id', y.id);
      if (r.error) throw r.error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title={`Edit ${y.label}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label"><Input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026-2027" /></Field>
        {ordered.map((s) => (
          <div key={s.id} className="grid grid-cols-2 gap-3">
            <Field label={`${s.term === 1 ? '1st' : s.term === 2 ? '2nd' : 'Summer'} sem starts`}>
              <Input type="date" required value={d[s.id].start} onChange={(e) => setD({ ...d, [s.id]: { ...d[s.id], start: e.target.value } })} />
            </Field>
            <Field label="Ends">
              <Input type="date" required value={d[s.id].end} onChange={(e) => setD({ ...d, [s.id]: { ...d[s.id], end: e.target.value } })} />
            </Field>
          </div>
        ))}
        <p className="text-[13px] text-muted">The school year runs from the first semester's start to the last semester's end.</p>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Save dates</Button>
      </form>
    </Sheet>
  );
}

function NewYearSheet({ open, onClose, hasCurrent }: { open: boolean; onClose: () => void; hasCurrent: boolean }) {
  const qc = useQueryClient();
  const now = new Date();
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const [label, setLabel] = useState(`${startYear}-${startYear + 1}`);
  const [s1, setS1] = useState(`${startYear}-08-01`);
  const [e1, setE1] = useState(`${startYear}-12-31`);
  const [s2, setS2] = useState(`${startYear + 1}-01-01`);
  const [e2, setE2] = useState(`${startYear + 1}-05-31`);
  const [current, setCurrent] = useState(!hasCurrent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(s1 < e1 && e1 < s2 && s2 < e2)) { setErr('Dates must run in order: 1st semester, then 2nd semester.'); return; }
    setBusy(true); setErr('');
    try {
      if (current) {
        const c = await supabase.from('school_years').update({ is_current: false }).eq('is_current', true);
        if (c.error) throw c.error;
        const cs = await supabase.from('semesters').update({ is_current: false }).eq('is_current', true);
        if (cs.error) throw cs.error;
      }
      const y = await supabase.from('school_years').insert({ label: label.trim(), starts_on: s1, ends_on: e2, is_current: current }).select().single();
      if (y.error) throw y.error;
      const today = manilaDate();
      const sem = await supabase.from('semesters').insert([
        { school_year_id: y.data.id, term: 1, starts_on: s1, ends_on: e1, is_current: current && today <= e1 },
        { school_year_id: y.data.id, term: 2, starts_on: s2, ends_on: e2, is_current: current && today > e1 },
      ]);
      if (sem.error) throw sem.error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="New school year">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Label"><Input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026-2027" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="1st sem starts"><Input type="date" required value={s1} onChange={(e) => setS1(e.target.value)} /></Field>
          <Field label="1st sem ends"><Input type="date" required value={e1} onChange={(e) => setE1(e.target.value)} /></Field>
          <Field label="2nd sem starts"><Input type="date" required value={s2} onChange={(e) => setS2(e.target.value)} /></Field>
          <Field label="2nd sem ends"><Input type="date" required value={e2} onChange={(e) => setE2(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-3 rounded-[14px] bg-surface2 p-4 cursor-pointer">
          <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          <span><b>Make this the current school year</b><span className="block text-[13px] text-muted">New dues, requests and reports will use it.</span></span>
        </label>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Create school year</Button>
      </form>
    </Sheet>
  );
}
