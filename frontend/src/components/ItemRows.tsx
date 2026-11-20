// Receipt item lines for an expense (migration 34): Particular · Unit · Qty · Unit price → line total.
// The Financial Report prints these under the expense's activity.
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { peso } from '../lib/format';
import { Button, Input } from './ui';

export type ItemLine = { particular: string; unit: string; qty: string; price: string };
export const blankItem = (): ItemLine => ({ particular: '', unit: 'pc', qty: '1', price: '' });
export const UNITS = ['pc', 'pcs', 'pack', 'ream', 'box', 'set', 'roll', 'bottle', 'kg', 'L', 'fare', 'meal', 'lot'];

export const lineTotal = (l: ItemLine) => (Number(l.qty) > 0 && Number(l.price) >= 0 && l.price !== '' ? Math.round(Number(l.qty) * Number(l.price) * 100) / 100 : 0);
export const itemsTotal = (lines: ItemLine[]) => Math.round(lines.reduce((t, l) => t + lineTotal(l), 0) * 100) / 100;
/** Lines the user actually filled in. */
export const usedItems = (lines: ItemLine[]) => lines.filter((l) => l.particular.trim() || l.price);
/** First problem with the lines, or null. */
export function itemsProblem(lines: ItemLine[]): string | null {
  const used = usedItems(lines);
  if (!used.length) return 'List the items on the receipt.';
  const bad = used.find((l) => !l.particular.trim() || !(Number(l.qty) > 0) || l.price === '' || !(Number(l.price) >= 0));
  return bad ? `Check “${bad.particular || 'unnamed item'}”: it needs a name, a quantity and a unit price.` : null;
}
export const itemsPayload = (lines: ItemLine[]) =>
  usedItems(lines).map((l) => ({ particular: l.particular.trim(), unit: l.unit.trim() || 'pc', qty: Number(l.qty), unit_price: Number(l.price) }));

export function ItemRows({ lines, onChange, disabled }: { lines: ItemLine[]; onChange: (l: ItemLine[]) => void; disabled?: boolean }) {
  const set = (i: number, k: keyof ItemLine, v: string) => onChange(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div>
      <datalist id="item-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
      <ul className="space-y-3">
        {lines.map((l, i) => (
          <li key={i} className="rounded-[14px] border border-line p-3">
            <div className="flex gap-2 items-start">
              <Input aria-label={`Item ${i + 1}`} value={l.particular} onChange={(e) => set(i, 'particular', e.target.value)}
                placeholder="Particular, e.g. Folder long" className="flex-1" maxLength={120} disabled={disabled} />
              <button type="button" disabled={disabled} onClick={() => onChange(lines.length > 1 ? lines.filter((_, j) => j !== i) : [blankItem()])}
                aria-label={`Remove item ${i + 1}`}
                className="size-12 shrink-0 grid place-items-center rounded-[12px] text-muted hover:bg-bad-soft hover:text-bad cursor-pointer disabled:opacity-50">
                <Trash2 className="size-5" aria-hidden />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-[1.1fr_0.8fr_1.3fr_auto] gap-x-2 text-[12px] text-muted" aria-hidden>
              <span>Unit</span><span>Qty</span><span>Unit price (₱)</span><span className="min-w-[72px] text-right">Total</span>
            </div>
            <div className="mt-1 grid grid-cols-[1.1fr_0.8fr_1.3fr_auto] gap-2 items-center">
              <Input aria-label={`Unit of item ${i + 1}`} list="item-units" value={l.unit} onChange={(e) => set(i, 'unit', e.target.value)} maxLength={20} disabled={disabled} className="px-2.5!" />
              <Input aria-label={`Quantity of item ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(e) => set(i, 'qty', e.target.value)} disabled={disabled} className="px-2.5!" />
              <Input aria-label={`Unit price of item ${i + 1}`} inputMode="decimal" value={l.price} onChange={(e) => set(i, 'price', e.target.value)} placeholder="0.00" className="money px-2.5!" disabled={disabled} />
              <span className="money font-semibold text-[14px] min-w-[72px] text-right">{peso(lineTotal(l))}</span>
            </div>
          </li>
        ))}
      </ul>
      {lines.length < 30 && (
        <Button type="button" variant="ghost" className="mt-3 h-11 px-4 text-[14px]" disabled={disabled} onClick={() => onChange([...lines, blankItem()])}>
          <Plus className="size-4" aria-hidden />Add item
        </Button>
      )}
    </div>
  );
}

/** Read-only list of an expense request's items (Approvals, request rows). */
export function useExpenseItems(requestId: number | null) {
  return useQuery({
    queryKey: ['expense-items', requestId],
    enabled: !!requestId,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_items').select('*').eq('request_id', requestId!).order('line_no');
      if (error) throw error;
      return data;
    },
  });
}

export function ExpenseItemList({ requestId }: { requestId: number }) {
  const items = useExpenseItems(requestId);
  if (!items.data?.length) return null;
  return (
    <div className="rounded-[14px] border border-line overflow-hidden">
      <ul className="text-[14px] divide-y divide-line">
        {items.data.map((it) => (
          <li key={it.id} className="px-3 py-2 flex gap-3">
            <span className="min-w-0 flex-1">{it.particular} <span className="text-muted">· {Number(it.qty)} {it.unit} × {peso(it.unit_price)}</span></span>
            <span className="money font-semibold">{peso(Number(it.qty) * Number(it.unit_price))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
