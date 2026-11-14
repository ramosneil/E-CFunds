import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, HandCoins, Scale, XCircle } from 'lucide-react';
import type { EntityReport } from '../../lib/database.types';
import { useCurrentYear, useEntities, useEntityFinance, useEntityReport } from '../../lib/data';
import { FinancePanel } from '../../components/finance/FinancePanel';
import { supabase, errorText } from '../../lib/supabase';
import { date, kindLabel, peso } from '../../lib/format';
import { Alert, Button, Card, DuesBar, EntityLogo, Field, HeroCard, Input, Select, Sheet, Spinner, Stat } from '../../components/ui';
import { BudgetCard, isOpen, releaseLeft, useBudgets } from '../../components/budgets';
import { IfApproved, NoYear, Segmented } from '../../components/common';
import { confirmAsk, promptAsk } from '../../lib/confirm';
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

type LedgerRow = { id: number; kind: string; amount: number; direction: number | null; description: string; occurred_on: string; pocket: string | null; reverses_id?: number | null };
/** Kinds SAS can correct with a reversal (private.reverse_entry). Dues payments use "undo payment" in Members. */
const REVERSIBLE = new Set(['opening', 'expense', 'adjustment']);

export function LedgerList({ entries, onCorrect }: { entries: LedgerRow[]; onCorrect?: (e: LedgerRow) => void }) {
  if (!entries.length) return <p className="text-muted text-[14px] py-6 text-center">No money movements yet this school year.</p>;
  const reversed = new Set(entries.map((e) => e.reverses_id).filter(Boolean));
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => {
        const t = totalEffect(e);
        const done = reversed.has(e.id);
        return (
          <li key={e.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={`font-semibold truncate ${done ? 'line-through text-muted' : ''}`}>{kindLabel[e.kind] ?? e.kind}{e.pocket ? ` · ${e.pocket === 'cash' ? 'cash' : 'saved'}` : ''}</p>
              <p className="text-[13px] text-muted truncate">{e.description} · {date(e.occurred_on)}{done ? ' · corrected' : ''}</p>
            </div>
            <p className={`money font-semibold shrink-0 ${done ? 'text-muted line-through' : t > 0 ? 'text-ok' : t < 0 ? 'text-bad' : 'text-muted'}`}>
              {t === 0 ? peso(e.amount) : peso(t, { sign: true })}
            </p>
            {onCorrect && REVERSIBLE.has(e.kind) && !done && (
              <button onClick={() => onCorrect(e)} aria-label={`Correct this ${kindLabel[e.kind]?.toLowerCase() ?? 'entry'}`}
                className="h-11 px-3 shrink-0 rounded-[12px] border border-line text-[13px] font-semibold hover:bg-surface2 cursor-pointer">Correct…</button>
            )}
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
  const [allLedger, setAllLedger] = useState(false);
  const finance = useEntityFinance(entityId, year.data?.id);
  const [adjusting, setAdjusting] = useState(false);
  const [corrErr, setCorrErr] = useState('');
  const qc = useQueryClient();
  const e = entities.data?.find((x) => x.id === entityId);
  const r = report.data?.find((x) => x.entity_id === entityId);

  /** Reverse a wrong entry (opening, expense, adjustment) with a written reason — a new "reversal" entry, nothing deleted. */
  async function correct(l: { id: number; kind: string; amount: number; description: string }) {
    const what = `${kindLabel[l.kind] ?? l.kind} of ${peso(l.amount)} (“${l.description}”)`;
    const reason = await promptAsk({
      title: `Correct this ${(kindLabel[l.kind] ?? 'entry').toLowerCase()}?`, confirm: 'Correct it', tone: 'bad',
      body: `This cancels the ${what} with a reversal entry. ${l.kind === 'expense' ? 'The money goes back to cash on hand and the expense leaves the students’ report.' : ''}`,
      input: { label: 'Reason', placeholder: 'e.g. Approved twice by mistake', minLength: 3 },
    });
    if (!reason) return;
    setCorrErr('');
    const { error } = await supabase.rpc('reverse_entry', { p_entry_id: l.id, p_reason: reason.trim() });
    if (error) setCorrErr(errorText(error)); else void qc.invalidateQueries();
  }

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
          <div className="mt-4">
            <FinancePanel finance={finance.data} loading={finance.isLoading} title="Where the money goes — what students see"
              note="Students see these charts and the approved expenses, but not receipts or the receipt mark." />
          </div>
          {/* Phones: Dues + Release first, then the ledger. Computers: ledger left, the two cards right. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] mt-4 items-start">
            <Card className="order-2 lg:order-1">
              <h2 className="font-display text-[17px] font-bold mb-1">Ledger</h2>
              {ledger.isLoading ? <Spinner /> : <>
                {corrErr && <div className="my-2"><Alert>{corrErr}</Alert></div>}
                <LedgerList entries={allLedger ? (ledger.data ?? []) : (ledger.data ?? []).slice(0, 10)} onCorrect={correct} />
                {(ledger.data?.length ?? 0) > 10 && (
                  <Button variant="soft" className="w-full mt-3 h-11" onClick={() => setAllLedger((v) => !v)}>
                    {allLedger ? 'Show the latest 10' : `Show all ${ledger.data!.length}`}
                  </Button>
                )}
              </>}
            </Card>
            <div className="space-y-4 order-1 lg:order-2">
              <Card>
                <h2 className="font-display text-[17px] font-bold mb-3">Dues · this semester</h2>
                <DuesBar paid={r.paid_members} members={r.members} />
              </Card>
              <Card>
                <h2 className="font-display text-[17px] font-bold">Release funds</h2>
                <p className="text-[14px] text-muted mt-1 mb-4">Give the treasurer cash from what's saved with SAS, without a request.</p>
                <Button variant="gold" className="w-full" disabled={r.saved_with_sas <= 0} onClick={() => setReleasing(true)}><HandCoins className="size-5" />Release</Button>
              </Card>
              <Card>
                <h2 className="font-display text-[17px] font-bold">Corrections</h2>
                <p className="text-[14px] text-muted mt-1 mb-4">Fix a mistake: use <b>Correct…</b> on a ledger entry, or add an adjustment. Nothing is deleted — every correction is a new entry with your reason.</p>
                <Button variant="soft" className="w-full" onClick={() => setAdjusting(true)}><Scale className="size-5" />Add an adjustment</Button>
              </Card>
              <TurnoverCard entityId={entityId} yearId={year.data.id} yearLabel={year.data.label} r={r} />
            </div>
          </div>
          <EntityBudgets entityId={entityId} />
          <ReleaseSheet open={releasing} onClose={() => setReleasing(false)} entityId={entityId} cash={r.cash_on_hand} saved={r.saved_with_sas} max={r.available_to_release} />
          {adjusting && <AdjustSheet onClose={() => setAdjusting(false)} entityId={entityId} cash={r.cash_on_hand} saved={r.saved_with_sas} />}
        </>
      )}
    </>
  );
}

/** This org/club's activity budgets: budget vs released vs spent. */
function EntityBudgets({ entityId }: { entityId: number }) {
  const budgets = useBudgets(entityId);
  const list = (budgets.data ?? []).filter((b) => b.status !== 'cancelled');
  if (!list.length) return null;
  return (
    <section className="mt-6">
      <h2 className="font-display text-[19px] font-bold mb-3">Activity budgets</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">{list.map((b) => <BudgetCard key={b.id} b={b} />)}</div>
    </section>
  );
}

function ReleaseSheet({ open, onClose, entityId, cash, saved, max }: { open: boolean; onClose: () => void; entityId: number; cash: number; saved: number; max: number }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const budgets = useBudgets(entityId);
  const open_ = (budgets.data ?? []).filter(isOpen);
  const overdue = (budgets.data ?? []).some((b) => b.is_overdue);
  const [budgetId, setBudgetId] = useState('');
  const budget = open_.find((b) => String(b.id) === budgetId);
  const a = Number(amount);
  const limit = Math.max(0, budget ? Math.min(max, releaseLeft(budget)) : max);
  const over = a > limit;   // checked while typing: no negative preview, Release stays off
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(a > 0)) { setErr('Enter an amount above ₱0.00.'); return; }
    if (over) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('admin_release', { p_entity_id: entityId, p_amount: a, p_description: desc.trim(), ...(budget ? { p_budget_id: budget.id } : {}) });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    setAmount(''); setDesc(''); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Release funds">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Amount" hint={`Up to ${peso(limit)}`} error={over ? `That’s more than can be released. Up to ${peso(limit)}.` : null}>
          <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={over || undefined} className="money text-[22px] h-14 font-semibold" placeholder="0.00" />
        </Field>
        {overdue && <Alert>This org/club has an overdue liquidation. Releases are blocked until it is liquidated.</Alert>}
        {open_.length > 0 && (
          <Field label="Budget (optional)" hint={budget ? `Left in this budget: ${peso(releaseLeft(budget))}` : 'Link the release to an approved activity budget.'}>
            <Select value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
              <option value="">Not for a budget</option>
              {open_.map((b) => <option key={b.id} value={b.id}>{b.title} · {peso(b.total)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="What is it for?"><Input required minLength={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Intramurals budget" /></Field>
        {!over && <IfApproved kind="release" amount={a || 0} cash={cash} saved={saved} />}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" variant="gold" busy={busy} disabled={over || overdue} className="w-full h-[54px]">Release {a > 0 && !over ? peso(a) : ''}</Button>
      </form>
    </Sheet>
  );
}

/** SAS adjustment: add to or take from one pocket, with a reason (private.admin_adjust). Checked while typing. */
function AdjustSheet({ onClose, entityId, cash, saved }: { onClose: () => void; entityId: number; cash: number; saved: number }) {
  const qc = useQueryClient();
  const [pocket, setPocket] = useState<'cash' | 'saved'>('cash');
  const [dir, setDir] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const a = Number(amount);
  const have = pocket === 'cash' ? Number(cash) : Number(saved);
  const over = dir === 'subtract' && a > have;
  const after = { cash: Number(cash) + (pocket === 'cash' ? (dir === 'add' ? a : -a) : 0), saved: Number(saved) + (pocket === 'saved' ? (dir === 'add' ? a : -a) : 0) };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(a > 0)) { setErr('Enter an amount above ₱0.00.'); return; }
    if (over) return;
    if (reason.trim().length < 3) { setErr('Write the reason for this adjustment.'); return; }
    if (!(await confirmAsk({ title: `${dir === 'add' ? 'Add' : 'Take'} ${peso(a)} ${dir === 'add' ? 'to' : 'from'} ${pocket === 'cash' ? 'cash on hand' : 'saved with SAS'}?`,
      body: `Reason: “${reason.trim()}”. This is recorded in the ledger and the activity log.`, confirm: 'Record adjustment', tone: 'primary' }))) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('admin_adjust', { p_entity_id: entityId, p_pocket: pocket, p_direction: dir === 'add' ? 1 : -1, p_amount: a, p_reason: reason.trim() });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries(); onClose();
  }
  return (
    <Sheet open onClose={onClose} title="Add an adjustment">
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={pocket} onChange={setPocket} options={[['cash', 'Cash on hand'], ['saved', 'Saved with SAS']]} />
        <Segmented value={dir} onChange={setDir} options={[['add', 'Add'], ['subtract', 'Take away']]} />
        <Field label="Amount" hint={`${pocket === 'cash' ? 'Cash on hand' : 'Saved with SAS'} now: ${peso(have)}`}
          error={over ? `That's more than the ${peso(have)} in this pocket.` : null}>
          <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={over || undefined} className="money text-[22px] h-14 font-semibold" placeholder="0.00" />
        </Field>
        <Field label="Reason" hint="Required. Shown in the ledger and the activity log.">
          <Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Count correction after audit" />
        </Field>
        {!over && a > 0 && (
          <div className="rounded-[16px] bg-surface2 p-4 text-[14px] space-y-1">
            <p className="micro text-muted mb-1">After the adjustment</p>
            <p className="flex justify-between"><span>Cash on hand</span><span className="money"><span className="text-muted">{peso(cash)}</span> → <b>{peso(after.cash)}</b></span></p>
            <p className="flex justify-between"><span>Saved with SAS</span><span className="money"><span className="text-muted">{peso(saved)}</span> → <b>{peso(after.saved)}</b></span></p>
          </div>
        )}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={over} className="w-full h-[54px]">Record adjustment</Button>
      </form>
    </Sheet>
  );
}

/** End of term: SAS closes the school year for this org/club once everything is settled (private.close_school_year).
 *  The outgoing treasurer is disabled automatically; the saved money carries over as the next officers' previous funds. */
function TurnoverCard({ entityId, yearId, yearLabel, r }: { entityId: number; yearId: number; yearLabel: string; r: EntityReport }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pending = Number(r.pending_remittances) + Number(r.pending_releases) + Number(r.pending_expenses);
  const budgets = useBudgets(entityId);
  const openBudgets = (budgets.data ?? []).filter((b) => ['pending', 'approved', 'liquidation_submitted'].includes(b.status)).length;
  const checks: [string, boolean, string][] = [
    ['All cash remitted to SAS', Number(r.cash_on_hand) === 0, `${peso(r.cash_on_hand)} still on hand — the treasurer remits it first`],
    ['No pending requests', pending === 0, 'Approve or reject the pending requests first'],
    ['Every budget liquidated', openBudgets === 0, `${openBudgets} budget${openBudgets === 1 ? '' : 's'} still open — decide, liquidate or cancel ${openBudgets === 1 ? 'it' : 'them'} first`],
  ];
  const ready = checks.every(([, ok]) => ok);

  async function close() {
    if (!(await confirmAsk({ title: `Close ${yearLabel} for this org/club?`, confirm: 'Close school year', tone: 'bad',
      body: `${peso(r.saved_with_sas)} saved with SAS carries over to the next officers. The current treasurer's account is disabled (they get a note). This cannot be undone.` }))) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('close_school_year', { p_entity_id: entityId, p_school_year_id: yearId });
    setBusy(false);
    if (error) setErr(errorText(error)); else void qc.invalidateQueries();
  }

  if (r.is_closed) return (
    <Card>
      <h2 className="font-display text-[17px] font-bold">School year closed</h2>
      <p className="text-[14px] text-muted mt-1 flex items-center gap-2"><CheckCircle2 className="size-5 text-ok" aria-hidden />
        {yearLabel} is closed. <b className="money text-ink">{peso(r.total_fund)}</b> carries over to the next officers.</p>
    </Card>
  );
  return (
    <Card>
      <h2 className="font-display text-[17px] font-bold">Close school year</h2>
      <p className="text-[14px] text-muted mt-1 mb-3">At the end of the officers' term. The saved money becomes the next officers' previous funds.</p>
      <ul className="space-y-2 mb-4">
        {checks.map(([label, ok, why]) => (
          <li key={label} className="flex items-start gap-2 text-[14px]">
            {ok ? <CheckCircle2 className="size-5 text-ok shrink-0" aria-hidden /> : <XCircle className="size-5 text-bad shrink-0" aria-hidden />}
            <span><b className="font-semibold">{label}</b>{!ok && <span className="block text-[13px] text-muted">{why}</span>}</span>
          </li>
        ))}
      </ul>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      <Button variant="danger" className="w-full" disabled={!ready} busy={busy} onClick={close}>Close {yearLabel}</Button>
    </Card>
  );
}
