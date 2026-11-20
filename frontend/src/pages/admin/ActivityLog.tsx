import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, History } from 'lucide-react';
import { useEntities } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { describe, thingLabel, type AuditRow } from '../../lib/activity';
import { peso } from '../../lib/format';
import { Button, Card, Empty, Input, PageHeader, Select, Spinner } from '../../components/ui';

const PAGE = 50;
const when = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

// "What changed" in plain words (Neil, 2026-11-20: no raw Before/After data). The full rows stay in audit_log.
type Names = { entity: (id: unknown) => string; person: (id: unknown) => string };
const HIDDEN = new Set(['id', 'created_at', 'updated_at', 'updated_by', 'search', 'school_year_id', 'semester_id', 'student_id', 'membership_id', 'request_id']);
const LABELS: Record<string, string> = {
  entity_id: 'Org / club', filed_by: 'Filed by', reviewed_by: 'Reviewed by', reviewed_at: 'Reviewed', filed_at: 'Filed',
  is_paid: 'Paid', paid_at: 'Paid on', amount_due: 'Amount due', file_name: 'File', attachment_path: 'Attachment',
  liquidation_status: 'Liquidation', liquidation_spent: 'Amount spent', liquidation_files: 'Liquidation files',
  liquidation_remarks: 'Liquidation note', liquidated_by: 'Liquidation checked by', liquidated_at: 'Liquidation checked',
  liquidation_submitted_at: 'Liquidation sent', full_name: 'Name', student_no: 'Student ID', year_level: 'Year level',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label = (k: string) => LABELS[k] ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_id$/, '').replace(/_/g, ' ');
function show(k: string, v: unknown, names: Names): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (k === 'entity_id') return names.entity(v);
  if (typeof v === 'string' && UUID.test(v)) return names.person(v);
  if (Array.isArray(v)) return v.length ? `${v.length} file${v.length === 1 ? '' : 's'}` : 'none';
  if (/amount|spent|total|due/.test(k) && !Number.isNaN(Number(v))) return peso(Number(v));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return when.format(new Date(v));
  if (typeof v === 'string' && /path$/.test(k)) return v.split('/').pop() ?? v;
  if (typeof v === 'object') return '(details)';
  return String(v);
}
function Changes({ r, names }: { r: AuditRow; names: Names }) {
  const before = (r.before_row ?? {}) as Record<string, unknown>, after = (r.after_row ?? {}) as Record<string, unknown>;
  const lines = r.action === 'update'
    ? Object.keys({ ...before, ...after }).filter((k) => !HIDDEN.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => ({ k, text: <>{show(k, before[k], names)} <span className="text-muted">→</span> <b>{show(k, after[k], names)}</b></> }))
    : Object.entries(r.action === 'delete' ? before : after).filter(([k, v]) => !HIDDEN.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
      .slice(0, 10).map(([k, v]) => ({ k, text: <b>{show(k, v, names)}</b> }));
  return (
    <div className="px-4 sm:px-5 pb-4 pl-9 sm:pl-10">
      <p className="micro text-muted mb-1.5">{r.action === 'update' ? 'What changed' : r.action === 'delete' ? 'What was removed' : 'Details'}</p>
      {lines.length ? (
        <ul className="space-y-1 text-[13.5px]">
          {lines.map(({ k, text }) => <li key={k} className="break-words"><span className="text-muted">{label(k)}:</span> {text}</li>)}
        </ul>
      ) : <p className="text-[13.5px] text-muted">Nothing else to show.</p>}
    </div>
  );
}

/** SAS: every change in E-CFunds (audit_log — written by database triggers, never edited), newest first. */
export function ActivityLog() {
  const entities = useEntities();
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [person, setPerson] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const people = useQuery({
    queryKey: ['profiles', 'names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, role');
      if (error) throw error;
      return data;
    },
  });
  const log = useQuery({
    queryKey: ['audit', table, action, from, to, person, page],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      if (table) q = q.eq('table_name', table);
      if (action) q = q.eq('action', action);
      if (person) q = q.eq('actor', person);
      if (from) q = q.gte('at', `${from}T00:00:00+08:00`);
      if (to) q = q.lte('at', `${to}T23:59:59+08:00`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data as unknown as AuditRow[], count: count ?? 0 };
    },
  });

  const names = useMemo(() => {
    const ents = new Map((entities.data ?? []).map((e) => [e.id, e.short_name]));
    const ppl = new Map((people.data ?? []).map((p) => [p.id, p.full_name || p.email || 'Someone']));
    return { entity: (id: unknown) => ents.get(Number(id)) ?? 'an org', person: (id: unknown) => (id ? ppl.get(String(id)) ?? 'Someone' : 'System') };
  }, [entities.data, people.data]);
  const reset = () => setPage(0);
  const total = log.data?.count ?? 0;

  return (
    <>
      <PageHeader title="Activity log" sub="Every change in E-CFunds, newest first. Recorded automatically — nobody can edit it." />
      <Card className="mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Select aria-label="What changed" value={table} onChange={(e) => { setTable(e.target.value); reset(); }}>
            <option value="">Everything</option>
            {['fund_requests', 'ledger_entries', 'memberships', 'receipts', 'budgets', 'profiles', 'students', 'entities', 'messages', 'year_closures', 'semesters', 'school_years', 'accredited_entries']
              .map((t) => <option key={t} value={t}>{thingLabel(t)}</option>)}
          </Select>
          <Select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); reset(); }}>
            <option value="">Any action</option><option value="insert">Added</option><option value="update">Changed</option><option value="delete">Deleted</option>
          </Select>
          <Select aria-label="Person" value={person} onChange={(e) => { setPerson(e.target.value); reset(); }}>
            <option value="">Anyone</option>
            {(people.data ?? []).filter((p) => p.role !== 'student').map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} />
        </div>
      </Card>
      {log.isLoading ? <Spinner /> : !log.data?.rows.length ? (
        <Card><Empty icon={<History className="size-6" />} title="Nothing found">Try fewer filters.</Empty></Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {log.data.rows.map((r) => (
              <li key={r.id}>
                <button onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}
                  className="w-full text-left px-4 sm:px-5 py-3 flex items-start gap-3 hover:bg-surface2/60 cursor-pointer">
                  <span className={`mt-1.5 size-2 rounded-full shrink-0 ${r.action === 'delete' ? 'bg-bad' : r.action === 'insert' ? 'bg-ok' : 'bg-primary'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[14px]">{describe(r, names)}</span>
                    <span className="block text-[12.5px] text-muted">{names.person(r.actor)} · {when.format(new Date(r.at))}</span>
                  </span>
                  <ChevronDown className={`size-4 text-muted shrink-0 mt-1 transition ${open === r.id ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {open === r.id && <Changes r={r} names={names} />}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-line text-[13px] text-muted">
            <span>{page * PAGE + 1}–{Math.min(total, page * PAGE + PAGE)} of {total}</span>
            <span className="flex gap-2">
              <Button variant="soft" className="h-11 px-4 text-[14px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
              <Button variant="soft" className="h-11 px-4 text-[14px]" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Older</Button>
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
