import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEntities } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date } from '../../lib/format';
import type { Json, Row } from '../../lib/database.types';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Sheet, Spinner, StatusChip } from '../../components/ui';
import { Segmented } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';
import { alertAsk, confirmAsk } from '../../lib/confirm';

type Entry = Row<'accredited_entries'>;

export function Accredited() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'list' | 'history'>('list');
  const [edit, setEdit] = useState<Entry | 'new' | null>(null);
  const list = useQuery({
    queryKey: ['accredited'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accredited_list').select('*').order('category').order('name');
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: number, name: string) {
    if (!(await confirmAsk({ title: 'Remove from the accredited list?', body: `"${name}" is removed from the list. It stays in the history.`, confirm: 'Remove', tone: 'bad' }))) return;
    const { error } = await supabase.from('accredited_entries').delete().eq('id', id);
    if (error) await alertAsk('Could not remove it', errorText(error));
    void qc.invalidateQueries({ queryKey: ['accredited'] });
    void qc.invalidateQueries({ queryKey: ['accredited-history'] });
  }

  return (
    <>
      <PageHeader title="Accredited list" sub="Expired is worked out from the expiry date, never typed in."
        action={<div className="flex items-center gap-2">
          <ExportMenu options={[
            { label: 'Accredited list', kind: 'pdf', run: async () => (await exportsLib()).accredited('pdf') },
            { label: 'Accredited list', kind: 'csv', run: async () => (await exportsLib()).accredited('csv') },
          ]} />
          <Button onClick={() => setEdit('new')}><Plus className="size-5" />Add</Button>
        </div>} />
      <div className="max-w-xs mb-5"><Segmented value={tab} onChange={setTab} options={[['list', 'List'], ['history', 'History']]} /></div>
      {tab === 'history' ? <HistoryList /> : list.isLoading ? <Spinner /> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] min-w-[760px]">
              <thead><tr className="text-left text-muted border-b border-line">
                {['Name', 'Type', 'Adviser', 'Year', 'Accredited', 'Expires', 'Status', ''].map((h) => <th key={h} className="micro px-4 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {list.data?.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{a.name}{a.remarks && <span className="block text-[13px] text-muted font-normal">{a.remarks}</span>}</td>
                    <td className="px-4 py-3 capitalize">{a.category}</td>
                    <td className="px-4 py-3">{a.adviser ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{a.academic_year ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{date(a.accredited_on)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{date(a.expires_on)}</td>
                    <td className="px-4 py-3"><StatusChip status={a.effective_status ?? 'pending'} /></td>
                    <td className="px-2 py-3 whitespace-nowrap text-right">
                      <button aria-label={`Edit ${a.name}`} onClick={() => setEdit(a as Entry)} className="size-10 inline-grid place-items-center rounded-full hover:bg-surface2 text-muted cursor-pointer"><Pencil className="size-4" /></button>
                      <button aria-label={`Remove ${a.name}`} onClick={() => remove(a.id!, a.name!)} className="size-10 inline-grid place-items-center rounded-full hover:bg-bad-soft hover:text-bad text-muted cursor-pointer"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {edit && <EntrySheet key={edit === 'new' ? 'new' : edit.id} entry={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EntrySheet({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const entities = useEntities();
  const [f, setF] = useState({
    name: entry?.name ?? '', category: entry?.category ?? 'organization', adviser: entry?.adviser ?? '',
    academic_year: entry?.academic_year ?? '', accredited_on: entry?.accredited_on ?? '', expires_on: entry?.expires_on ?? '',
    status: entry?.status ?? 'accredited', remarks: entry?.remarks ?? '', entity_id: entry?.entity_id ? String(entry.entity_id) : '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.accredited_on && f.expires_on && f.expires_on <= f.accredited_on) { setErr('Expiry must be after the accreditation date.'); return; }
    setBusy(true); setErr('');
    const row = {
      name: f.name.trim(), category: f.category as Entry['category'], adviser: f.adviser.trim() || null,
      academic_year: f.academic_year.trim() || null, accredited_on: f.accredited_on || null, expires_on: f.expires_on || null,
      status: f.status as Entry['status'], remarks: f.remarks.trim() || null, entity_id: f.entity_id ? Number(f.entity_id) : null,
    };
    const res = entry ? await supabase.from('accredited_entries').update(row).eq('id', entry.id) : await supabase.from('accredited_entries').insert(row);
    setBusy(false);
    if (res.error) { setErr(errorText(res.error)); return; }
    void qc.invalidateQueries({ queryKey: ['accredited'] });
    void qc.invalidateQueries({ queryKey: ['accredited-history'] });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={entry ? 'Edit entry' : 'Add to accredited list'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><Input required value={f.name} onChange={set('name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.category} onChange={set('category')}><option value="organization">Organization</option><option value="club">Club</option></Select></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')}><option value="accredited">Accredited</option><option value="pending">Pending</option><option value="revoked">Revoked</option></Select></Field>
          <Field label="Adviser"><Input value={f.adviser} onChange={set('adviser')} /></Field>
          <Field label="Academic year"><Input value={f.academic_year} onChange={set('academic_year')} placeholder="2026-2027" /></Field>
          <Field label="Accredited on"><Input type="date" value={f.accredited_on} onChange={set('accredited_on')} /></Field>
          <Field label="Expires on"><Input type="date" value={f.expires_on} onChange={set('expires_on')} /></Field>
        </div>
        <Field label="Linked org / club"><Select value={f.entity_id} onChange={set('entity_id')}><option value="">None</option>{entities.data?.map((x) => <option key={x.id} value={x.id}>{x.short_name}</option>)}</Select></Field>
        <Field label="Remarks"><Input value={f.remarks} onChange={set('remarks')} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">{entry ? 'Save changes' : 'Add'}</Button>
      </form>
    </Sheet>
  );
}

const FIELDS: [string, string][] = [['name', 'Name'], ['adviser', 'Adviser'], ['academic_year', 'Year'], ['accredited_on', 'Accredited'],
  ['expires_on', 'Expires'], ['status', 'Status'], ['remarks', 'Remarks'], ['category', 'Type']];

function HistoryList() {
  const h = useQuery({
    queryKey: ['accredited-history'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accredited_history').select('*').order('changed_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  if (h.isLoading) return <Spinner />;
  const obj = (j: Json | null) => (j && typeof j === 'object' && !Array.isArray(j) ? j as Record<string, Json> : {});
  return (
    <Card>
      <ul className="divide-y divide-line">
        {h.data?.map((x) => {
          const b = obj(x.before_row), a = obj(x.after_row);
          const migrated = 'migrated_from' in a;
          const changed = x.action === 'update' && !migrated ? FIELDS.filter(([k]) => JSON.stringify(b[k]) !== JSON.stringify(a[k])) : [];
          const title = String(a.name ?? b.name ?? `Entry #${x.entry_id}`);
          return (
            <li key={x.id} className="py-3 flex gap-3">
              <span className="size-10 rounded-[12px] bg-primary-soft text-primary grid place-items-center shrink-0"><History className="size-5" /></span>
              <div className="min-w-0">
                <p className="font-semibold">{title} <span className="text-muted font-normal">· {x.action === 'insert' ? 'added' : x.action === 'delete' ? 'removed' : 'edited'}</span></p>
                <p className="text-[13px] text-muted">{new Date(x.changed_at).toLocaleString('en-PH')}{migrated ? ' · from the old system (only the name was logged)' : ''}</p>
                {changed.length > 0 && (
                  <ul className="mt-1 text-[13px] space-y-0.5">
                    {changed.map(([k, label]) => <li key={k}><span className="text-muted">{label}:</span> <s className="text-muted">{String(b[k] ?? '—')}</s> → <b>{String(a[k] ?? '—')}</b></li>)}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
