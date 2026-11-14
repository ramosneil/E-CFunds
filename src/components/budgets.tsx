// Activity budgets + liquidation (migration 32). Treasurer: file a budget, ask releases against it, tag expenses,
// submit the liquidation. SAS: approve/reject the budget, approve/return the liquidation.
import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { supabase, errorText } from '../lib/supabase';
import { date, peso } from '../lib/format';
import type { Database } from '../lib/database.types';
import { Alert, Button, Card, Chip, EntityLogo, Field, Input } from './ui';
import { Sheet } from './ui';
import { confirmAsk, promptAsk } from '../lib/confirm';
import { toast } from '../lib/toast';

export type Budget = Database['public']['Views']['budget_status']['Row'];

export function useBudgets(entityId?: number) {
  return useQuery({
    queryKey: ['budgets', entityId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('budget_status').select('*').order('filed_at', { ascending: false }).limit(300);
      if (entityId) q = q.eq('entity_id', entityId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Budget[];
    },
  });
}

/** An approved budget that can still take releases / expenses. */
export const isOpen = (b: Budget) => b.status === 'approved';
export const releaseLeft = (b: Budget) => Math.max(0, Number(b.total) - Number(b.released) - Number(b.pending_release));

export function budgetChip(b: Budget) {
  if (b.is_overdue) return <Chip tone="bad">Overdue</Chip>;
  const m: Record<string, [string, 'ok' | 'warn' | 'bad' | 'muted' | 'primary']> = {
    pending: ['Waiting for SAS', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'bad'], cancelled: ['Cancelled', 'muted'],
    liquidation_submitted: ['Liquidation sent', 'primary'], liquidated: ['Liquidated', 'muted'],
  };
  const [label, tone] = m[b.status] ?? [b.status, 'muted'];
  return <Chip tone={tone}>{label}</Chip>;
}

function dueLine(b: Budget) {
  if (b.status === 'approved') return b.is_overdue
    ? <span className="text-bad font-semibold">Liquidation was due {date(b.liquidation_due)} — no new releases until it’s done</span>
    : <>Liquidation due {date(b.liquidation_due)}</>;
  if (b.status === 'liquidation_submitted') return <>Liquidation sent {date(b.liquidation_submitted_at)}</>;
  if (b.status === 'liquidated') return <>Liquidated {date(b.liquidated_at)}</>;
  return null;
}

function Items({ budgetId }: { budgetId: number }) {
  const items = useQuery({
    queryKey: ['budget-items', budgetId],
    queryFn: async () => {
      const { data, error } = await supabase.from('budget_items').select('*').eq('budget_id', budgetId).order('id');
      if (error) throw error;
      return data;
    },
  });
  if (items.isLoading) return <p className="text-[13px] text-muted py-2">Loading items…</p>;
  return (
    <ul className="text-[14px] divide-y divide-line">
      {items.data?.map((it) => (
        <li key={it.id} className="py-2 flex gap-3">
          <span className="min-w-0 flex-1">{it.item} <span className="text-muted">· {Number(it.qty)} × {peso(it.unit_cost)}</span></span>
          <span className="money font-semibold">{peso(Number(it.qty) * Number(it.unit_cost))}</span>
        </li>
      ))}
    </ul>
  );
}

/** Expenses tagged to the budget (reversed ones left out). */
function useTaggedExpenses(budgetId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['budget-expenses', budgetId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('ledger_entries').select('id, description, amount, occurred_on, kind')
        .eq('budget_id', budgetId).order('occurred_on');
      if (error) throw error;
      const ids = data.map((x) => x.id);
      const rev = ids.length ? await supabase.from('ledger_entries').select('reverses_id').in('reverses_id', ids) : { data: [] as { reverses_id: number | null }[] };
      const gone = new Set((rev.data ?? []).map((x) => x.reverses_id));
      return data.filter((x) => !gone.has(x.id));
    },
  });
}

function Money({ b }: { b: Budget }) {
  const total = Number(b.total), released = Number(b.released), spent = Number(b.spent);
  const pct = (n: number) => `${Math.min(100, total > 0 ? (n / total) * 100 : 0)}%`;
  return (
    <div className="mt-3">
      <div className="h-2.5 rounded-full bg-surface2 overflow-hidden relative" aria-hidden>
        <div className="absolute inset-y-0 left-0 bg-primary/35 rounded-full" style={{ width: pct(released) }} />
        <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: pct(spent) }} />
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
        <div><dt className="text-muted">Budget</dt><dd className="money font-semibold">{peso(total)}</dd></div>
        <div><dt className="text-muted">Released</dt><dd className="money font-semibold">{peso(released)}</dd></div>
        <div><dt className="text-muted">Spent</dt><dd className="money font-semibold">{peso(spent)}</dd></div>
      </dl>
    </div>
  );
}

/** One budget: title, status, money bar, due date, items (tap to show) and any actions passed in. */
export function BudgetCard({ b, entity, actions }: { b: Budget; entity?: { name: string; short_name: string; logo_path: string | null }; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-start gap-3">
        {entity && <EntityLogo path={entity.logo_path} name={entity.name} size={40} />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{entity ? `${entity.short_name} · ` : ''}{b.title}</p>
          <p className="text-[13px] text-muted">Activity {date(b.activity_date)}{b.purpose ? ` · ${b.purpose}` : ''}</p>
        </div>
        {budgetChip(b)}
      </div>
      {['approved', 'liquidation_submitted', 'liquidated'].includes(b.status) ? <Money b={b} />
        : <p className="money font-display font-bold text-[20px] mt-2">{peso(b.total)}</p>}
      {dueLine(b) && <p className="text-[13px] text-muted mt-2">{dueLine(b)}</p>}
      {b.remarks && <p className="text-[13px] mt-2"><span className="text-muted">SAS:</span> {b.remarks}</p>}
      {b.liquidation_note && <p className="text-[13px] mt-1"><span className="text-muted">Liquidation report:</span> {b.liquidation_note}</p>}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 min-h-11 text-[14px] font-semibold text-primary cursor-pointer">
        {open ? 'Hide items' : 'Show items'}<ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <Items budgetId={b.id} />}
      {actions && <div className="mt-3">{actions}</div>}
    </Card>
  );
}

type Line = { item: string; qty: string; cost: string };
const blank = (): Line => ({ item: '', qty: '1', cost: '' });

export function NewBudgetSheet({ entityId, onClose }: { entityId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [day, setDay] = useState('');
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const amount = (l: Line) => (Number(l.qty) > 0 && Number(l.cost) >= 0 ? Math.round(Number(l.qty) * Number(l.cost) * 100) / 100 : 0);
  const total = lines.reduce((t, l) => t + amount(l), 0);
  const set = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  // Calendar math in UTC so the phone's time zone can't shift the day (database: activity_date + 15).
  const due = day ? new Date(Date.parse(day + 'T00:00:00Z') + 15 * 86400000).toISOString().slice(0, 10) : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = lines.filter((l) => l.item.trim() || l.cost);
    if (title.trim().length < 3) { setErr('Name the activity.'); return; }
    if (!day) { setErr('Pick the activity date.'); return; }
    if (!items.length) { setErr('Add at least one item.'); return; }
    const bad = items.find((l) => !l.item.trim() || !(Number(l.qty) > 0) || !(Number(l.cost) >= 0) || l.cost === '');
    if (bad) { setErr(`Check the item “${bad.item || 'unnamed'}”: it needs a name, a quantity and a cost.`); return; }
    if (!(total > 0)) { setErr('The total must be more than ₱0.'); return; }
    if (!(await confirmAsk({ title: `Send the ${peso(total)} budget to SAS?`, body: `“${title.trim()}” on ${date(day)}. Once approved you can ask for releases up to this amount. Liquidation is due ${date(due)}.`, confirm: 'Send to SAS', tone: 'primary' }))) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('file_budget', { p_entity_id: entityId, p_title: title.trim(), p_purpose: purpose.trim(), p_activity_date: day,
      p_items: items.map((l) => ({ item: l.item.trim(), qty: Number(l.qty), unit_cost: Number(l.cost) })) });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    toast({ title: 'Budget sent to SAS', body: `${title.trim()} · ${peso(total)}`, tone: 'ok', silent: true });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="New activity budget">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Activity"><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leadership seminar" maxLength={120} /></Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Activity date" hint={due ? `Liquidation due ${date(due)} (15 days after)` : '15 days after it, the liquidation is due'}>
            <Input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Purpose (optional)"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. For all officers" /></Field>
        </div>
        <div>
          <p className="text-[14px] font-semibold mb-2">Items</p>
          <ul className="space-y-3">
            {lines.map((l, i) => (
              <li key={i} className="rounded-[14px] border border-line p-3">
                <div className="flex gap-2 items-start">
                  <Input aria-label={`Item ${i + 1}`} value={l.item} onChange={(e) => set(i, 'item', e.target.value)} placeholder="Item, e.g. Snacks" className="flex-1" maxLength={120} />
                  <button type="button" onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : [blank()])} aria-label={`Remove item ${i + 1}`}
                    className="size-12 shrink-0 grid place-items-center rounded-[12px] text-muted hover:bg-bad-soft hover:text-bad cursor-pointer"><Trash2 className="size-5" aria-hidden /></button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1.4fr_auto] gap-x-2 text-[12px] text-muted" aria-hidden>
                  <span>Qty</span><span>Unit cost (₱)</span><span className="min-w-[84px] text-right">Amount</span>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center">
                  <Input aria-label={`Quantity of item ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} placeholder="Qty" />
                  <Input aria-label={`Unit cost of item ${i + 1}`} inputMode="decimal" value={l.cost} onChange={(e) => set(i, 'cost', e.target.value)} placeholder="Unit cost ₱" className="money" />
                  <span className="money font-semibold text-[14px] min-w-[84px] text-right">{peso(amount(l))}</span>
                </div>
              </li>
            ))}
          </ul>
          {lines.length < 50 && <Button type="button" variant="ghost" className="mt-3 h-11 px-4 text-[14px]" onClick={() => setLines([...lines, blank()])}><Plus className="size-4" aria-hidden />Add item</Button>}
        </div>
        <div className="rounded-[16px] bg-primary-soft text-primary p-4 flex items-center justify-between">
          <span className="micro">Budget total</span><span className="money font-display font-extrabold text-[24px]">{peso(total)}</span>
        </div>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Send to SAS</Button>
      </form>
    </Sheet>
  );
}

export function LiquidateSheet({ b, onClose }: { b: Budget; onClose: () => void }) {
  const qc = useQueryClient();
  const tagged = useTaggedExpenses(b.id, true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const expenses = (tagged.data ?? []).filter((x) => x.kind === 'expense');
  const unspent = Math.max(0, Number(b.released) - Number(b.spent));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (note.trim().length < 3) { setErr('Write a short report of the activity.'); return; }
    if (!(await confirmAsk({ title: 'Send the liquidation to SAS?', body: `Spent ${peso(b.spent)} of ${peso(b.released)} released. SAS checks it against the expense receipts.`, confirm: 'Send', tone: 'primary' }))) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('submit_liquidation', { p_budget_id: b.id, p_note: note.trim() });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
    toast({ title: 'Liquidation sent to SAS', body: b.title, tone: 'ok', silent: true });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Liquidate budget">
      <form onSubmit={submit} className="space-y-4">
        <p className="font-semibold">{b.title} <span className="text-muted font-normal">· {date(b.activity_date)}</span></p>
        <dl className="grid grid-cols-3 gap-2 rounded-[16px] bg-surface2 p-4 text-[13px]">
          <div><dt className="text-muted">Released</dt><dd className="money font-semibold text-[16px]">{peso(b.released)}</dd></div>
          <div><dt className="text-muted">Spent</dt><dd className="money font-semibold text-[16px]">{peso(b.spent)}</dd></div>
          <div><dt className="text-muted">Unspent</dt><dd className="money font-semibold text-[16px]">{peso(unspent)}</dd></div>
        </dl>
        <div>
          <p className="text-[14px] font-semibold mb-1">Approved expenses for this budget</p>
          {tagged.isLoading ? <p className="text-[13px] text-muted">Loading…</p> : expenses.length ? (
            <ul className="text-[14px] divide-y divide-line">
              {expenses.map((x) => <li key={x.id} className="py-2 flex gap-3"><span className="flex-1 min-w-0">{x.description} <span className="text-muted">· {date(x.occurred_on)}</span></span><span className="money font-semibold">{peso(x.amount)}</span></li>)}
            </ul>
          ) : <p className="text-[13px] text-muted">None yet. File each expense under Requests → Expense and pick this budget, so it counts here.</p>}
        </div>
        {unspent > 0 && <Alert tone="warn">{peso(unspent)} released but not spent stays in your cash on hand. Remit it to SAS if the activity is over.</Alert>}
        <Field label="Activity report" hint="What happened, what was bought, what was left. SAS reads this with the receipts.">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={1000}
            className="w-full rounded-[14px] bg-surface border border-line focus:border-primary outline-none p-3 text-[15px]" />
        </Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Send liquidation</Button>
      </form>
    </Sheet>
  );
}

/** SAS: decide a pending budget, or a submitted liquidation. */
export function BudgetDecisionCard({ b, entity }: { b: Budget; entity?: { name: string; short_name: string; logo_path: string | null } }) {
  const qc = useQueryClient();
  const liq = b.status === 'liquidation_submitted';
  const tagged = useTaggedExpenses(b.id, liq);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [err, setErr] = useState('');
  const who = `${entity?.short_name ?? 'this org'}’s “${b.title}”`;

  async function decide(approve: boolean) {
    let remarks: string | undefined;
    if (approve) {
      if (!(await confirmAsk(liq
        ? { title: `Approve the liquidation of ${who}?`, body: `Spent ${peso(b.spent)} of ${peso(b.released)} released. The budget is closed.`, confirm: 'Approve', tone: 'primary' }
        : { title: `Approve ${who} (${peso(b.total)})?`, body: 'The treasurer can then ask for releases up to this amount.', confirm: 'Approve', tone: 'primary' }))) return;
    } else {
      const r = await promptAsk({ title: liq ? `Return the liquidation of ${who}?` : `Reject ${who}?`, tone: 'bad', confirm: liq ? 'Return' : 'Reject',
        body: liq ? 'The treasurer fixes it and sends it again. It stays due on the same date.' : 'The treasurer sees this reason and can file a new budget.',
        input: { label: liq ? 'What to fix' : 'Reason', placeholder: liq ? 'e.g. Attach the tarpaulin receipt' : 'e.g. Snacks cost is too high', minLength: 3 } });
      if (!r) return;
      remarks = r.trim();
    }
    setBusy(approve ? 'yes' : 'no'); setErr('');
    const { error } = await supabase.rpc(liq ? 'review_liquidation' : 'review_budget', { p_budget_id: b.id, p_approve: approve, p_remarks: remarks });
    setBusy(null);
    if (error) setErr(errorText(error)); else void qc.invalidateQueries();
  }

  const expenses = (tagged.data ?? []).filter((x) => x.kind === 'expense');
  return (
    <BudgetCard b={b} entity={entity} actions={<>
      {liq && (
        <div className="mb-3">
          <p className="text-[14px] font-semibold mb-1">Expenses tagged to this budget</p>
          {expenses.length ? <ul className="text-[14px] divide-y divide-line">{expenses.map((x) => <li key={x.id} className="py-2 flex gap-3"><span className="flex-1 min-w-0">{x.description} <span className="text-muted">· {date(x.occurred_on)}</span></span><span className="money font-semibold">{peso(x.amount)}</span></li>)}</ul>
            : <p className="text-[13px] text-muted">{tagged.isLoading ? 'Loading…' : 'No expenses were tagged to it.'}</p>}
        </div>
      )}
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="danger" busy={busy === 'no'} disabled={!!busy} onClick={() => decide(false)}>{liq ? 'Return' : 'Reject'}</Button>
        <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => decide(true)}>Approve</Button>
      </div>
    </>} />
  );
}
