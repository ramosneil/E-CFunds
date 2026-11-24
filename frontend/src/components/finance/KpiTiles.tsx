// Insights headline numbers (Neil, 2026-11-25): the four figures a board report leads with, each with what changed
// this month. Arrows always come with words (never colour alone); amounts stay in text colours.
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { EntityReport, Finance } from '../../lib/database.types';
import { monthLabel, peso } from '../../lib/format';
import { n } from './chartKit';

export type Kpis = { fund: number; cash: number; saved: number; collected: number; spent: number; paid: number; members: number };

/** Headline figures for one org (one report row) or the whole school (every row); flows from the finance report. */
export function kpisFor(rows: EntityReport[], f: Finance | null | undefined): Kpis {
  const sum = (k: keyof EntityReport) => rows.reduce((t, r) => t + n(r[k]), 0);
  return {
    fund: sum('cash_on_hand') + sum('saved_with_sas'), cash: sum('cash_on_hand'), saved: sum('saved_with_sas'),
    collected: n(f?.money_in), spent: n(f?.money_out), paid: sum('paid_members'), members: sum('members'),
  };
}

/** This month and last month from the monthly series (the last entry is the current month). */
export function lastTwo(monthly: Finance['monthly']) {
  const cur = monthly.at(-1), prev = monthly.at(-2);
  return {
    month: cur?.month ?? null, prevMonth: prev?.month ?? null,
    inNow: n(cur?.money_in), outNow: n(cur?.money_out), inPrev: n(prev?.money_in), outPrev: n(prev?.money_out),
  };
}

function Delta({ now, prev, prevMonth }: { now: number; prev: number; prevMonth: string | null }) {
  const d = now - prev;
  const Icon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {d === 0 ? 'same as' : d > 0 ? `${peso(d)} more than` : `${peso(-d)} less than`} {prevMonth ? monthLabel(prevMonth) : 'last month'}
    </span>
  );
}

function Tile({ label, value, foot, children, big }: { label: string; value: ReactNode; foot?: ReactNode; children?: ReactNode; big?: boolean }) {
  return (
    <div className="lux-card bg-surface border border-line rounded-[18px] p-4 min-w-0">
      <p className="micro text-muted">{label}</p>
      <p className={`money font-display font-extrabold leading-tight mt-1 ${big ? 'text-[30px] sm:text-[40px]' : 'text-[22px] sm:text-[26px]'}`}>{value}</p>
      {children}
      {foot && <p className="text-[12.5px] text-muted mt-1.5 leading-snug">{foot}</p>}
    </div>
  );
}

export function KpiTiles({ k, monthly, big }: { k: Kpis; monthly: Finance['monthly']; big?: boolean }) {
  const t = lastTwo(monthly);
  const net = t.inNow - t.outNow;
  const pct = k.members ? Math.round((k.paid / k.members) * 100) : 0;
  const m = t.month ? monthLabel(t.month) : 'This month';
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile big={big} label="Fund balance" value={peso(k.fund)}
        foot={<span className="inline-flex items-center gap-1">{net > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : net < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
          {net === 0 ? `No change in ${m}` : `${net > 0 ? 'Up' : 'Down'} ${peso(Math.abs(net))} in ${m}`}</span>} />
      <Tile big={big} label="Collected this year" value={peso(k.collected)}
        foot={<>{peso(t.inNow)} in {m} · <Delta now={t.inNow} prev={t.inPrev} prevMonth={t.prevMonth} /></>} />
      <Tile big={big} label="Spent this year" value={peso(k.spent)}
        foot={<>{peso(t.outNow)} in {m} · <Delta now={t.outNow} prev={t.outPrev} prevMonth={t.prevMonth} /></>} />
      <Tile big={big} label="Dues collected" value={k.members ? `${pct}%` : '—'}
        foot={k.members ? `${k.paid.toLocaleString('en-PH')} of ${k.members.toLocaleString('en-PH')} members paid this semester` : 'No members yet this semester'}>
        {k.members > 0 && (
          <div className="mt-2 h-2 rounded-full bg-surface2 overflow-hidden" role="img" aria-label={`${pct}% of dues collected`}>
            <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
          </div>
        )}
      </Tile>
    </div>
  );
}
