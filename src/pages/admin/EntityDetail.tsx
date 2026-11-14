import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, HandCoins } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityReport } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, kindLabel, peso } from '../../lib/format';
import { Alert, Button, Card, DuesBar, EntityLogo, Field, HeroCard, Input, Sheet, Spinner, Stat } from '../../components/ui';
import { IfApproved, NoYear } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';

export function useLedger(entityId: number | undefined, yearId: number | undefined) {
  return useQuery({
    queryKey: ['ledger', entityId, yearId],
    enabled: !!entityId && !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ledger_entries').select('*')
        .eq('entity_id', entityId!).eq('school_year_id', yearId!).order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
}

/** Signed effect of one ledger row on the total fund (transfers between pockets show as 0). */
export function totalEffect(e: { kind: string; amount: number; direction: number | null }): number {
  const a = Number(e.amount);
  switch (e.kind) {
    case 'opening': case 'collection': return a;
    case 'expense': return -a;
    case 'adjustment': case 'reversal': return a * (e.direction ?? 1);
    default: return 0;
  }
}

export function LedgerList({ entries }: { entries: { id: number; kind: string; amount: number; direction: number | null; description: string; occurred_on: string; pocket: string | null }[] }) {
  if (!entries.length) return <p className="text-muted text-[14px] py-6 text-center">No money movements yet this school year.</p>;
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => {
        const t = totalEffect(e);
        return (
          <li key={e.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{kindLabel[e.kind] ?? e.kind}{e.pocket ? ` · ${e.pocket === 'cash' ? 'cash' : 'saved'}` : ''}</p>
              <p className="text-[13px] text-muted truncate">{e.description} · {date(e.occurred_on)}</p>
            </div>
            <p className={`money font-semibold shrink-0 ${t > 0 ? 'text-ok' : t < 0 ? 'text-bad' : 'text-muted'}`}>
              {t === 0 ? peso(e.amount) : peso(t, { sign: true })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function EntityDetail() {
  const { id } = useParams();
  const entityId = Number(id);
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const ledger = useLedger(entityId, year.data?.id);
  const [releasing, setReleasing] = useState(false);
  const e = entities.data?.find((x) => x.id === entityId);
  const r = report.data?.find((x) => x.entity_id === entityId);

  if (year.isLoading || entities.isLoading) return <Spinner />;
  if (!e) return <p className="text-muted">Not found.</p>;
  return (
    <>
      <Link to="/orgs" className="inline-flex items-center gap-1 text-primary font-semibold mb-4"><ArrowLeft className="size-4" />Orgs & clubs</Link>
      <div className="flex items-center gap-4 mb-5">
        <EntityLogo path={e.logo_path} name={e.name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-extrabold leading-tight">{e.short_name}</h1>
          <p className="text-muted truncate">{e.name}</p>
        </div>
        {year.data && <ExportMenu options={[
          { label: 'Financial report', kind: 'pdf', run: async () => (await exportsLib()).orgReport('pdf', e, year.data!) },
          { label: 'Ledger', kind: 'csv', run: async () => (await exportsLib()).orgReport('csv', e, year.data!) },
          { label: 'Members & dues', kind: 'csv', run: async () => (await exportsLib()).membersCsv(e, year.data!) },
        ]} />}
      </div>
      {!year.data ? <NoYear admin /> : !r ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <HeroCard label={`Total fund · ${year.data.label}`} total={r.total_fund} cash={r.cash_on_hand} saved={r.saved_with_sas}
              foot={<>Previous funds {peso(r.previous_funds)}{r.is_closed ? ' · Year closed' : ''}</>} />
            <div className="grid grid-cols-2 gap-3 content-start">
              <Stat label="Collections" value={peso(r.collections)} tone={r.collections ? 'ok' : undefined} />
              <Stat label="Expenses" value={peso(r.expenses)} tone={r.expenses ? 'bad' : undefined} />
              <Stat label="Remitted" value={peso(r.remittances)} />
              <Stat label="Released" value={peso(r.releases)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] mt-4 items-start">
            <Card>
              <h2 className="font-display text-[17px] font-bold mb-1">Ledger</h2>
              {ledger.isLoading ? <Spinner /> : <LedgerList entries={ledger.data ?? []} />}
            </Card>
            <div className="space-y-4">
              <Card>
                <h2 className="font-display text-[17px] font-bold mb-3">Dues · this semester</h2>
                <DuesBar paid={r.paid_members} members={r.members} />
              </Card>
              <Card>
                <h2 className="font-display text-[17px] font-bold">Release funds</h2>
                <p className="text-[14px] text-muted mt-1 mb-4">Give the treasurer cash from what's saved with SAS, without a request.</p>
                <Button variant="gold" className="w-full" disabled={r.saved_with_sas <= 0} onClick={() => setReleasing(true)}><HandCoins className="size-5" />Release</Button>
              </Card>
            </div>
          </div>
          <ReleaseSheet open={releasing} onClose={() => setReleasing(false)} entityId={entityId} cash={r.cash_on_hand} saved={r.saved_with_sas} max={r.available_to_release} />
        </>
      )}
    </>
  );
}

function ReleaseSheet({ open, onClose, entityId, cash, saved, max }: { open: boolean; onClose: () => void; entityId: number; cash: number; saved: number; max: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const a = Number(amount);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(a > 0)) { setErr('Enter an amount above ₱0.'); return; }
    if (a > max) { setErr(`Only ${peso(max)} can be released right now.`); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('admin_release', { p_entity_id: entityId, p_amount: a, p_description: desc.trim() });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    setAmount(''); setDesc(''); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Release funds">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Amount" hint={`Up to ${peso(max)}`}><Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="money text-[22px] h-14 font-semibold" placeholder="0.00" /></Field>
        <Field label="What is it for?"><Input required minLength={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Intramurals budget" /></Field>
        <IfApproved kind="release" amount={a || 0} cash={cash} saved={saved} />
        {err && <Alert>{err}</Alert>}
        <Button type="submit" variant="gold" busy={busy} className="w-full h-[54px]">Release {a > 0 ? peso(a) : ''}</Button>
      </form>
    </Sheet>
  );
}
