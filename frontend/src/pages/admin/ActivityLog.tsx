import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, History } from 'lucide-react';
import { useEntities } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { describe, thingLabel, type AuditRow } from '../../lib/activity';
import { Button, Card, Empty, Input, PageHeader, Select, Spinner } from '../../components/ui';

const PAGE = 50;
const when = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

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
                {open === r.id && (
                  <div className="px-4 sm:px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                    {(['before_row', 'after_row'] as const).map((k) => (
                      <div key={k} className="rounded-[12px] bg-surface2 p-3 overflow-x-auto">
                        <p className="micro text-muted mb-1">{k === 'before_row' ? 'Before' : 'After'}</p>
                        <pre className="whitespace-pre-wrap break-all font-mono text-[11.5px]">{r[k] ? JSON.stringify(r[k], null, 1) : '—'}</pre>
                      </div>
                    ))}
                  </div>
                )}
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
