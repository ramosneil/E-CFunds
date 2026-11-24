// Budget vs actual (Insights, one org/club): each approved activity — resolution request or budget — as a track for
// the approved amount, filled with what was spent (orange = money out) and what came back to savings (blue = money
// in). State is a text chip with an icon (never colour alone). Table view below.
import { CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';
import type { FinanceActivity } from '../../lib/database.types';
import { date, peso } from '../../lib/format';
import { Key, TableView, n } from './chartKit';

const STATE: Record<FinanceActivity['state'], { label: string; icon: typeof Clock; cls: string }> = {
  liquidated: { label: 'Liquidated', icon: CheckCircle2, cls: 'bg-ok-soft text-ok' },
  liquidation_sent: { label: 'Liquidation sent', icon: Send, cls: 'bg-primary-soft text-primary' },
  waiting_liquidation: { label: 'Waiting for liquidation', icon: Clock, cls: 'bg-warn-soft text-warn' },
  open: { label: 'Open', icon: Clock, cls: 'bg-warn-soft text-warn' },
  overdue: { label: 'Liquidation overdue', icon: AlertTriangle, cls: 'bg-bad-soft text-bad' },
};

export function StateChip({ state }: { state: FinanceActivity['state'] }) {
  const s = STATE[state];
  return <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[12px] font-semibold whitespace-nowrap ${s.cls}`}><s.icon className="size-3.5" aria-hidden />{s.label}</span>;
}

export function activityTotals(acts: FinanceActivity[]) {
  return acts.reduce((t, a) => ({ approved: t.approved + n(a.approved), spent: t.spent + n(a.spent), returned: t.returned + n(a.returned) }), { approved: 0, spent: 0, returned: 0 });
}

export function BudgetVsActual({ activities, big }: { activities: FinanceActivity[]; big?: boolean }) {
  if (!activities.length) return <p className="text-[14px] text-muted">No approved activities yet this school year. Resolution requests and activity budgets show here once SAS approves them.</p>;
  const max = Math.max(...activities.map((a) => n(a.approved)), 1);
  const tot = activityTotals(activities);
  const shown = big ? activities.slice(0, 6) : activities;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted mb-3">
        <Key color="var(--chart-out)">Spent</Key><Key color="var(--chart-in)">Returned to savings</Key><Key color="var(--muted)" outline>Approved</Key>
      </div>
      <ul className={big ? 'space-y-5' : 'space-y-4'}>
        {shown.map((a, i) => {
          const ap = n(a.approved), sp = n(a.spent), rt = n(a.returned);
          const used = ap ? Math.round((sp / ap) * 100) : 0;
          return (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={`font-semibold min-w-0 flex-1 truncate ${big ? 'text-[20px]' : 'text-[14.5px]'}`} title={a.title}>{a.title}</p>
                <StateChip state={a.state} />
              </div>
              {/* Track = approved amount (scaled to the biggest activity); fills: spent, then returned. */}
              <div className={`mt-2 rounded-[6px] overflow-hidden flex ${big ? 'h-5' : 'h-3'}`}
                style={{ width: `${Math.max(8, (ap / max) * 100)}%`, boxShadow: 'inset 0 0 0 1.5px var(--muted)' }}
                role="img" aria-label={`${a.title}: approved ${peso(ap)}, spent ${a.spent == null ? 'not reported yet' : peso(sp)}${a.returned ? `, returned ${peso(rt)}` : ''}`}>
                {sp > 0 && <div className="h-full bg-chart-out" style={{ width: `${Math.min(100, (sp / (ap || 1)) * 100)}%` }} />}
                {rt > 0 && <div className="h-full bg-chart-in border-l-2 border-surface" style={{ width: `${Math.min(100, (rt / (ap || 1)) * 100)}%` }} />}
              </div>
              <p className={`text-muted mt-1 ${big ? 'text-[16px]' : 'text-[13px]'}`}>
                {a.spent == null
                  ? <>{peso(ap)} released{a.date ? ` · ${date(a.date)}` : ''} · spending not reported yet</>
                  : <>Spent <b className="text-ink money">{peso(sp)}</b> of {peso(ap)} ({used}%){rt > 0 && <> · {peso(rt)} returned</>}{a.date ? ` · ${date(a.date)}` : ''}</>}
              </p>
            </li>
          );
        })}
      </ul>
      {big && activities.length > shown.length && <p className="text-muted mt-3">…and {activities.length - shown.length} more</p>}
      {!big && (
        <TableView>
          <table className="w-full text-[13px] mt-1">
            <thead><tr className="text-muted text-left"><th className="py-1 font-semibold">Activity</th><th className="py-1 font-semibold text-right">Approved</th><th className="py-1 font-semibold text-right">Spent</th><th className="py-1 font-semibold text-right">Returned</th><th className="py-1 font-semibold pl-3">State</th></tr></thead>
            <tbody>{activities.map((a, i) => <tr key={i} className="border-t border-line"><td className="py-1.5 pr-2">{a.title}</td><td className="py-1.5 text-right money">{peso(a.approved)}</td><td className="py-1.5 text-right money">{a.spent == null ? '—' : peso(a.spent)}</td><td className="py-1.5 text-right money">{a.returned == null ? '—' : peso(a.returned)}</td><td className="py-1.5 pl-3 whitespace-nowrap">{STATE[a.state].label}</td></tr>)}
              <tr className="border-t border-line font-semibold"><td className="py-1.5">All activities</td><td className="py-1.5 text-right money">{peso(tot.approved)}</td><td className="py-1.5 text-right money">{peso(tot.spent)}</td><td className="py-1.5 text-right money">{peso(tot.returned)}</td><td /></tr>
            </tbody>
          </table>
        </TableView>
      )}
    </div>
  );
}
