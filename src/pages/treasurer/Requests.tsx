import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Paperclip, Plus, Receipt, RotateCcw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntityReport, useRequests } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { CATEGORIES, categoryLabel, peso } from '../../lib/format';
import type { Enum } from '../../lib/database.types';
import { Alert, Button, Card, Empty, Field, Input, PageHeader, SectionTitle, Select, Sheet, Spinner } from '../../components/ui';
import { IfApproved, NoYear, RequestRow, Segmented } from '../../components/common';
import { confirmAsk } from '../../lib/confirm';
import { BudgetCard, LiquidateSheet, NewBudgetSheet, isOpen, releaseLeft, useBudgets, type Budget } from '../../components/budgets';

type Kind = Enum<'request_kind'>;
type Category = Enum<'expense_category'>;
const KINDS: [Kind, string][] = [['remittance', 'Remit'], ['release', 'Release'], ['expense', 'Expense']];

type Draft = { kind: Kind; amount: string; desc: string; category?: Category };

export function Requests() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? 0;
  const [params, setParams] = useSearchParams();
  const year = useCurrentYear();
  const requests = useRequests({ entityId });
  const qc = useQueryClient();
  const newKind = params.get('new') as Kind | null;
  const tab = params.get('tab') === 'budgets' ? 'budgets' : 'requests';
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);   // "File again" fills the form from a rejected request

  function fileAgain(r: { kind: Kind; amount: number; description: string; category: Category | null }) {
    setDraft({ kind: r.kind, amount: String(r.amount), desc: r.description, category: r.category ?? undefined });
    setParams({ new: r.kind });
  }

  async function cancel(id: number) {
    if (!(await confirmAsk({ title: 'Cancel this request?', body: 'SAS will no longer see it. You can file a new one any time.', confirm: 'Cancel request', tone: 'bad' }))) return;
    const { error } = await supabase.rpc('cancel_request', { p_request_id: id });
    if (error) setErr(errorText(error));
    void qc.invalidateQueries();
  }

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Requests" /><NoYear /></>;
  const all = requests.data ?? [];
  const waiting = all.filter((r) => r.status === 'pending');
  const done = all.filter((r) => r.status !== 'pending');
  return (
    <>
      <PageHeader title="Requests" sub="Remittances, releases, expenses and activity budgets go to SAS for approval."
        action={tab === 'requests'
          ? <Button onClick={() => { setDraft(null); setParams({ new: 'remittance' }); }}><Plus className="size-5" />New</Button>
          : <Button onClick={() => setParams({ tab: 'budgets', budget: 'new' })}><Plus className="size-5" />New budget</Button>} />
      <div className="max-w-xs mb-5"><Segmented value={tab} onChange={(v) => setParams(v === 'budgets' ? { tab: 'budgets' } : {})}
        options={[['requests', 'Requests'], ['budgets', 'Budgets']]} /></div>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {tab === 'budgets' ? <Budgets entityId={entityId} newOpen={params.get('budget') === 'new'} onCloseNew={() => setParams({ tab: 'budgets' })} />
      : requests.isLoading ? <Spinner /> : all.length ? (
        <div className="space-y-4">
          {waiting.length > 0 && (
            <Card>
              <SectionTitle>Waiting for SAS · {waiting.length}</SectionTitle>
              <div className="divide-y divide-line">
                {waiting.map((r) => (
                  <div key={r.id}>
                    <RequestRow r={r} />
                    <div className="pl-14 pb-3">
                      <button type="button" onClick={() => cancel(r.id)}
                        className="inline-flex items-center h-11 px-4 rounded-[14px] border border-line text-bad font-semibold text-[14px] hover:bg-bad-soft transition cursor-pointer">Cancel request</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {done.length > 0 && (
            <Card>
              <SectionTitle>Done</SectionTitle>
              <div className="divide-y divide-line">
                {done.map((r) => (
                  <div key={r.id}>
                    <RequestRow r={r} />
                    {r.remarks && <p className="text-[13px] text-muted -mt-1 mb-3 pl-14">SAS: {r.remarks}</p>}
                    {r.status === 'rejected' && (
                      <div className="pl-14 pb-3">
                        <Button variant="soft" className="h-11 px-4 text-[14px]" onClick={() => fileAgain(r)}><RotateCcw className="size-4" aria-hidden />File again</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : <Card><Empty icon={<Receipt className="size-6" />} title="No requests yet">Remit cash to SAS, ask for a release, or file an expense with its receipt.</Empty></Card>}
      {tab === 'requests' && newKind && <NewRequest key={newKind + (draft ? ':again' : '')} initial={KINDS.some(([k]) => k === newKind) ? newKind : 'remittance'}
        draft={draft?.kind === newKind ? draft : null} entityId={entityId} yearId={year.data.id} onClose={() => { setDraft(null); setParams({}); }} />}
    </>
  );
}

function NewRequest({ initial, draft, entityId, yearId, onClose }: { initial: Kind; draft: Draft | null; entityId: number; yearId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const report = useEntityReport(yearId);
  const r = report.data?.find((x) => x.entity_id === entityId);
  const [kind, setKind] = useState<Kind>(initial);
  const [amount, setAmount] = useState(draft?.amount ?? '');
  const [desc, setDesc] = useState(draft?.desc ?? '');
  const [category, setCategory] = useState<Category | ''>(draft?.category ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const budgets = useBudgets(entityId);
  const open = (budgets.data ?? []).filter(isOpen);
  const overdue = (budgets.data ?? []).some((b) => b.is_overdue);
  const [budgetId, setBudgetId] = useState('');
  const budget = open.find((b) => String(b.id) === budgetId);
  const a = Number(amount);
  const base = !r ? 0 : kind === 'remittance' ? r.available_to_remit : kind === 'release' ? r.available_to_release : r.cash_on_hand - r.pending_expenses - r.pending_remittances;
  // A release is also capped by what is left of its budget.
  const limit = kind === 'release' && budget ? Math.min(base, releaseLeft(budget)) : base;
  const limitLabel = kind === 'remittance' ? 'Cash you can remit' : kind === 'release' ? 'Saved with SAS you can ask for' : 'Cash available for expenses';
  const max = Math.max(0, limit);
  // Checked while typing, so the preview never shows a negative pocket and Send stays off until it's possible.
  const blocked = kind === 'release' && (overdue || (budgets.isSuccess && !open.length));
  const nothing = !blocked && !!r && max <= 0;
  const over = !!r && a > max;
  const nothingText = kind === 'release' ? 'Nothing is saved with SAS yet. Remit cash first, then you can ask for a release.'
    : kind === 'remittance' ? 'There is no cash on hand to remit right now (pending requests already count).'
    : 'There is no cash on hand for expenses right now (pending requests already count). Ask SAS for a release first.';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(a > 0)) { setErr('Enter an amount above ₱0.00.'); return; }
    if (over || nothing || blocked) return;
    if (kind === 'release' && !budget) { setErr('Pick the budget this release is for.'); return; }
    if (desc.trim().length < 3) { setErr('Describe what this is for.'); return; }
    if (kind === 'expense' && !category) { setErr('Choose a category for this expense.'); return; }
    if (kind === 'expense' && !file) { setErr('Attach the receipt for this expense.'); return; }
    if (file && file.size > 10 * 1024 * 1024) { setErr('Attachment must be 10 MB or smaller.'); return; }
    setBusy(true); setErr('');
    try {
      let path: string | undefined;
      if (file) {
        const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-60);
        path = `${entityId}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.rpc('file_request', { p_entity_id: entityId, p_kind: kind, p_amount: a, p_description: desc.trim(), p_attachment_path: path,
        ...(kind === 'expense' && category ? { p_category: category } : {}),
        ...(kind !== 'remittance' && budget ? { p_budget_id: budget.id } : {}) });
      if (error) throw error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="New request">
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={kind} onChange={setKind} options={KINDS} />
        <p className="text-[14px] text-muted -mt-1">
          {kind === 'remittance' ? 'Hand cash on hand to SAS to keep it safe.' : kind === 'release' ? 'Get cash back from what is saved with SAS, for a budget.' : 'Record money spent from cash on hand. A receipt is required.'}
        </p>
        {kind === 'release' && overdue && <Alert>A budget’s liquidation is overdue. Submit it under Budgets first — no new releases until then.</Alert>}
        {kind === 'release' && !overdue && budgets.isSuccess && !open.length && <Alert tone="warn">Releases need an approved activity budget. File one under Budgets; once SAS approves it, come back here.</Alert>}
        {nothing && <Alert tone="warn">{nothingText}</Alert>}
        {kind !== 'remittance' && !blocked && open.length > 0 && (
          <Field label={kind === 'release' ? 'For which budget?' : 'Budget (optional)'}
            hint={kind === 'release' ? (budget ? <>Left in this budget: <b className="money text-ink">{peso(releaseLeft(budget))}</b></> : 'Only approved budgets are listed.') : 'Tag the expense to an activity so it counts in that budget’s liquidation.'}>
            <Select value={budgetId} onChange={(e) => setBudgetId(e.target.value)} required={kind === 'release'}>
              <option value="">{kind === 'release' ? 'Choose…' : 'Not for a budget'}</option>
              {open.map((b) => <option key={b.id} value={b.id}>{b.title} · {peso(b.total)}</option>)}
            </Select>
          </Field>
        )}
        {draft && !nothing && <Alert tone="ok">Filled in from your rejected request. Fix what SAS asked for, then send it again.</Alert>}
        <Field label="Amount" hint={r ? <>{limitLabel}: <b className="money text-ink">{peso(max)}</b></> : undefined}
          error={over && !nothing ? `That’s more than you have. ${limitLabel}: ${peso(max)}.` : null}>
          <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={over || undefined}
            className="money text-[24px] h-14 font-semibold" placeholder="0.00" disabled={nothing || blocked} />
        </Field>
        <Field label="What is it for?"><Input required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'expense' ? 'e.g. Tarpaulin for org fair' : kind === 'release' ? 'e.g. Budget for seminar' : 'e.g. Dues collected this week'} /></Field>
        {kind === 'expense' && (
          <Field label="Category" hint="Once SAS approves, students see this expense's purpose, category and amount (never the receipt).">
            <Select required value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              <option value="" disabled>Choose…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-3 rounded-[14px] border border-dashed border-line p-4 cursor-pointer hover:bg-surface2">
          <span className="size-10 rounded-[12px] bg-primary-soft text-primary grid place-items-center"><Paperclip className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{file ? file.name : kind === 'expense' ? 'Attach receipt (required)' : 'Attach proof (optional)'}</b>
            <span className="text-[13px] text-muted">Photo or PDF, up to 10 MB</span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {r && !over && !nothing && !blocked && <IfApproved kind={kind} amount={a || 0} cash={r.cash_on_hand} saved={r.saved_with_sas} />}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={over || nothing || blocked} className="w-full h-[54px]">Send to SAS</Button>
      </form>
    </Sheet>
  );
}

/** Treasurer: this org's activity budgets. */
function Budgets({ entityId, newOpen, onCloseNew }: { entityId: number; newOpen: boolean; onCloseNew: () => void }) {
  const qc = useQueryClient();
  const budgets = useBudgets(entityId);
  const [liq, setLiq] = useState<Budget | null>(null);
  const [err, setErr] = useState('');

  async function cancel(b: Budget) {
    if (!(await confirmAsk({ title: `Cancel “${b.title}”?`, body: 'SAS no longer sees it. You can file a new budget any time.', confirm: 'Cancel budget', tone: 'bad' }))) return;
    const { error } = await supabase.rpc('cancel_budget', { p_budget_id: b.id });
    if (error) setErr(errorText(error)); else void qc.invalidateQueries();
  }

  const all = budgets.data ?? [];
  const isActive = (b: Budget) => ['pending', 'approved', 'liquidation_submitted'].includes(b.status);
  const sorted = [...all.filter(isActive), ...all.filter((b) => !isActive(b))];
  const canCancel = (b: Budget) => b.status === 'pending' || (b.status === 'approved' && Number(b.released) === 0 && Number(b.spent) === 0 && Number(b.pending_release) === 0);
  return (
    <>
      <p className="text-[14px] text-muted mb-4 max-w-2xl">Every release needs an approved budget. After the activity, send the liquidation within 15 days; while one is overdue, no new releases.</p>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {budgets.isLoading ? <Spinner /> : !all.length ? (
        <Card><Empty icon={<ClipboardList className="size-6" />} title="No budgets yet">Plan an activity: list the items and costs, send it to SAS, then ask for a release against it.</Empty></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
          {sorted.map((b) => (
            <BudgetCard key={b.id} b={b} actions={(b.status === 'approved' || canCancel(b)) && (
              <div className="flex flex-wrap gap-2">
                {b.status === 'approved' && <Button className="h-11 px-4 text-[14px]" onClick={() => setLiq(b)}>Liquidate</Button>}
                {canCancel(b) && <button type="button" onClick={() => cancel(b)}
                  className="inline-flex items-center h-11 px-4 rounded-[14px] border border-line text-bad font-semibold text-[14px] hover:bg-bad-soft transition cursor-pointer">Cancel budget</button>}
              </div>
            )} />
          ))}
        </div>
      )}
      {newOpen && <NewBudgetSheet entityId={entityId} onClose={onCloseNew} />}
      {liq && <LiquidateSheet b={liq} onClose={() => setLiq(null)} />}
    </>
  );
}
