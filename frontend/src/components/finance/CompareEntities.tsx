// Compare orgs & clubs (Insights, whole school): one ranked bar per org/club for the chosen measure. "Fund" is cash on
// hand + saved with SAS stacked (validated --chart-cash / --chart-saved, 2px gap, legend); the others are one measure,
// one colour. Every row names its value; tapping a row opens that org's dashboard. Table view below.
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { EntityReport } from '../../lib/database.types';
import { peso } from '../../lib/format';
import { EntityLogo } from '../ui';
import { Segmented } from '../common';
import { Key, TableView, n } from './chartKit';

type Metric = 'fund' | 'collected' | 'spent' | 'dues';
const value = (r: EntityReport, m: Metric) =>
  m === 'fund' ? n(r.cash_on_hand) + n(r.saved_with_sas) : m === 'collected' ? n(r.collections) : m === 'spent' ? n(r.expenses)
    : r.members ? Math.round((r.paid_members / r.members) * 100) : 0;
const show = (r: EntityReport, m: Metric) => (m === 'dues' ? (r.members ? `${value(r, m)}%` : '—') : peso(value(r, m)));

export function CompareEntities({ rows, logos, onOpen, big, initial = 'fund' }: {
  rows: EntityReport[]; logos: Map<number, string | null>; onOpen?: (id: number) => void; big?: boolean; initial?: Metric;
}) {
  const [m, setM] = useState<Metric>(initial);
  const sorted = [...rows].sort((a, b) => value(b, m) - value(a, m) || a.short_name.localeCompare(b.short_name));
  const max = m === 'dues' ? 100 : Math.max(...sorted.map((r) => value(r, m)), 1);
  const color = m === 'collected' ? 'var(--chart-in)' : m === 'spent' ? 'var(--chart-out)' : 'var(--chart-saved)';
  return (
    <div>
      {!big && <div className="mb-3 sm:max-w-md"><Segmented value={m} onChange={setM} options={[['fund', 'Fund'], ['collected', 'Collected'], ['spent', 'Spent'], ['dues', 'Dues %']]} /></div>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted mb-2">
        {m === 'fund' ? <><Key color="var(--chart-cash)">Cash on hand</Key><Key color="var(--chart-saved)">Saved with SAS</Key></>
          : <Key color={color}>{m === 'collected' ? 'Collected this year' : m === 'spent' ? 'Spent this year' : 'Members who paid dues (this semester)'}</Key>}
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((r) => {
          const v = value(r, m), w = (v / max) * 100;
          const cashW = m === 'fund' && v ? (Math.max(0, n(r.cash_on_hand)) / max) * 100 : 0;
          const Row = onOpen ? 'button' : 'div';
          return (
            <li key={r.entity_id}>
              <Row {...(onOpen ? { type: 'button' as const, onClick: () => onOpen(r.entity_id) } : {})}
                className={`w-full text-left flex items-center gap-3 ${big ? 'py-3' : 'py-2.5'} ${onOpen ? 'cursor-pointer hover:bg-surface2/60 rounded-[12px] px-1 -mx-1' : ''}`}
                aria-label={onOpen ? `${r.short_name}: ${show(r, m)}. Open its dashboard` : undefined}>
                <EntityLogo path={logos.get(r.entity_id) ?? null} name={r.short_name} size={big ? 40 : 32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`font-semibold truncate ${big ? 'text-[20px]' : 'text-[14px]'}`}>{r.short_name}</span>
                    <b className={`money shrink-0 ${big ? 'text-[20px]' : 'text-[14px]'}`}>{show(r, m)}</b>
                  </span>
                  <span className={`mt-1.5 flex rounded-full bg-surface2 overflow-hidden ${big ? 'h-3.5' : 'h-2.5'}`} aria-hidden>
                    {m === 'fund' ? <>
                      {cashW > 0 && <span className="h-full bg-chart-cash" style={{ width: `${cashW}%` }} />}
                      {w - cashW > 0 && <span className={`h-full bg-chart-saved ${cashW > 0 ? 'border-l-2 border-surface' : ''}`} style={{ width: `${w - cashW}%` }} />}
                    </> : v > 0 && <span className="h-full rounded-full" style={{ width: `${Math.max(1.5, w)}%`, background: color }} />}
                  </span>
                </span>
                {onOpen && <ChevronRight className="size-4 text-muted shrink-0" aria-hidden />}
              </Row>
            </li>
          );
        })}
      </ul>
      {!big && (
        <TableView>
          <table className="w-full text-[13px] mt-1 min-w-[520px]">
            <thead><tr className="text-muted text-left"><th className="py-1 font-semibold">Org / club</th><th className="py-1 font-semibold text-right">Cash</th><th className="py-1 font-semibold text-right">Saved</th><th className="py-1 font-semibold text-right">Collected</th><th className="py-1 font-semibold text-right">Spent</th><th className="py-1 font-semibold text-right">Dues paid</th></tr></thead>
            <tbody>{sorted.map((r) => <tr key={r.entity_id} className="border-t border-line"><td className="py-1.5">{r.short_name}</td><td className="py-1.5 text-right money">{peso(r.cash_on_hand)}</td><td className="py-1.5 text-right money">{peso(r.saved_with_sas)}</td><td className="py-1.5 text-right money">{peso(r.collections)}</td><td className="py-1.5 text-right money">{peso(r.expenses)}</td><td className="py-1.5 text-right">{r.paid_members}/{r.members}</td></tr>)}</tbody>
          </table>
        </TableView>
      )}
    </div>
  );
}

/** Cash on hand vs saved with SAS as one stacked bar with both amounts named (the chart colours, not the brand ones). */
export function CashSaved({ cash, saved, big }: { cash: number; saved: number; big?: boolean }) {
  const c = Math.max(0, cash), s = Math.max(0, saved), t = c + s;
  const cp = t ? Math.round((c / t) * 100) : 0;
  return (
    <div>
      <div className={`flex rounded-full bg-surface2 overflow-hidden ${big ? 'h-6' : 'h-3.5'}`} role="img" aria-label={`Cash on hand ${peso(cash)}, saved with SAS ${peso(saved)}`}>
        {c > 0 && <div className="h-full bg-chart-cash" style={{ width: `${(c / t) * 100}%` }} />}
        {s > 0 && <div className={`h-full flex-1 bg-chart-saved ${c > 0 ? 'border-l-2 border-surface' : ''}`} />}
      </div>
      <div className={`mt-3 grid grid-cols-2 gap-3 ${big ? 'text-[18px]' : 'text-[13.5px]'}`}>
        <div><Key color="var(--chart-cash)"><span className="text-muted">Cash on hand (treasurer)</span></Key><p className={`money font-display font-bold leading-tight mt-1 ${big ? 'text-[34px]' : 'text-[20px]'}`}>{peso(cash)}</p><p className="text-muted">{t ? `${cp}%` : '—'}</p></div>
        <div><Key color="var(--chart-saved)"><span className="text-muted">Saved with SAS</span></Key><p className={`money font-display font-bold leading-tight mt-1 ${big ? 'text-[34px]' : 'text-[20px]'}`}>{peso(saved)}</p><p className="text-muted">{t ? `${100 - cp}%` : '—'}</p></div>
      </div>
    </div>
  );
}
