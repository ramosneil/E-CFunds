// "Where the money goes" — the same transparency view for students, treasurers and SAS (migration 27).
// Charts follow the dataviz rules: one axis, thin bars with 4px rounded ends on a baseline, 2px gaps, a legend for the
// 2-series chart, recessive grid, values in text colours, a hover/tap tooltip and a "Show as table" view.
// Colours: --chart-in (blue) = money in, --chart-out (orange) = money out (validated light + dark).
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Receipt as ReceiptIcon } from 'lucide-react';
import type { Finance } from '../../lib/database.types';
import { categoryLabel, date, monthLabel, peso } from '../../lib/format';
import { Card, SectionTitle, Spinner } from '../ui';

const n = (v: unknown) => Number(v) || 0;

/** Nice round top for the y-axis (₱0, ₱50, ₱100 … ). */
function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => v <= s * 4)!;
  return step * 4;
}

/** A bar whose top corners are rounded (4px) and whose bottom sits flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function TableView({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 group">
      <summary className="list-none cursor-pointer text-[13px] font-semibold text-primary inline-flex items-center gap-1 h-11">
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />Show as table
      </summary>
      <div className="overflow-x-auto">{children}</div>
    </details>
  );
}

/** Money in vs money out, month by month (grouped bars). */
export function MoneyInOut({ monthly }: { monthly: Finance['monthly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real on-screen width (not a scaled-down picture), so 11 px labels stay 11 px on phones.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  const rows = monthly.map((m) => ({ month: m.month, inn: n(m.money_in), out: n(m.money_out) }));
  const max = niceMax(Math.max(0, ...rows.map((r) => Math.max(r.inn, r.out))));
  const W = width, H = width < 480 ? 190 : 230, L = 52, R = 8, T = 10, B = 28;
  const pw = W - L - R, ph = H - T - B;
  const gw = pw / Math.max(rows.length, 1);
  const bw = Math.max(4, Math.min(22, (gw - 12) / 2));
  const y = (v: number) => T + ph - (v / max) * ph;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const h = hover !== null ? rows[hover] : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-[13px] text-muted mb-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-chart-in" />Money in</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-chart-out" />Money out</span>
      </div>
      <div className="relative" ref={setBox} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="w-full h-auto block" role="img"
          aria-label={`Money in and out by month: ${rows.map((r) => `${monthLabel(r.month)} in ${peso(r.inn)}, out ${peso(r.out)}`).join('; ')}`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="money">{peso(t).replace('.00', '')}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = L + gw * i + gw / 2;
            const active = hover === i;
            return (
              <g key={r.month} opacity={hover === null || active ? 1 : 0.45}>
                <path d={barPath(cx - bw - 1, y(r.inn), bw, T + ph - y(r.inn))} fill="var(--chart-in)" />
                <path d={barPath(cx + 1, y(r.out), bw, T + ph - y(r.out))} fill="var(--chart-out)" />
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={active ? 'var(--text)' : 'var(--muted)'}>{monthLabel(r.month)}</text>
                {/* Hit target: the whole month column (bigger than the bars), works with mouse and touch. */}
                <rect x={L + gw * i} y={T} width={gw} height={ph + B} fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)} onClick={() => setHover(active ? null : i)} />
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div role="status" className="absolute top-0 -translate-x-1/2 pointer-events-none rounded-[12px] border border-line bg-surface shadow-lg px-3 py-2 text-[13px] whitespace-nowrap"
            style={{ left: `${Math.min(85, Math.max(15, ((L + gw * hover + gw / 2) / W) * 100))}%` }}>
            <p className="font-semibold mb-1">{monthLabel(h.month, true)}</p>
            <p className="flex items-center gap-2"><i className="size-2 rounded-sm bg-chart-in" />In <b className="money ml-auto pl-3">{peso(h.inn)}</b></p>
            <p className="flex items-center gap-2"><i className="size-2 rounded-sm bg-chart-out" />Out <b className="money ml-auto pl-3">{peso(h.out)}</b></p>
          </div>
        )}
      </div>
      <TableView>
        <table className="w-full text-[13px] mt-1">
          <thead><tr className="text-muted text-left"><th className="py-1 font-semibold">Month</th><th className="py-1 font-semibold text-right">Money in</th><th className="py-1 font-semibold text-right">Money out</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.month} className="border-t border-line"><td className="py-1.5">{monthLabel(r.month, true)}</td><td className="py-1.5 text-right money">{peso(r.inn)}</td><td className="py-1.5 text-right money">{peso(r.out)}</td></tr>)}</tbody>
        </table>
      </TableView>
    </div>
  );
}

/** Spending by category: one measure, so one colour; every bar carries its name, ₱ and share. */
export function SpendingByCategory({ categories }: { categories: Finance['categories'] }) {
  const rows = categories.map((c) => ({ key: c.category, amount: n(c.amount) })).sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = total ? Math.round((r.amount / total) * 100) : 0;
          return (
            <li key={r.key} title={`${categoryLabel[r.key]}: ${peso(r.amount)} (${pct}%)`}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="font-semibold truncate">{categoryLabel[r.key] ?? r.key}</span>
                <span className="shrink-0"><b className="money">{peso(r.amount)}</b> <span className="text-muted text-[13px]">· {pct}%</span></span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-surface2 overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-chart-out" style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <TableView>
        <table className="w-full text-[13px] mt-1">
          <thead><tr className="text-muted text-left"><th className="py-1 font-semibold">Category</th><th className="py-1 font-semibold text-right">Spent</th><th className="py-1 font-semibold text-right">Share</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key} className="border-t border-line"><td className="py-1.5">{categoryLabel[r.key]}</td><td className="py-1.5 text-right money">{peso(r.amount)}</td><td className="py-1.5 text-right">{total ? Math.round((r.amount / total) * 100) : 0}%</td></tr>)}</tbody>
        </table>
      </TableView>
    </div>
  );
}

/** Approved expenses. The receipt mark appears only when the server sent it (SAS + the org's own treasurer). */
export function ExpenseList({ expenses }: { expenses: NonNullable<Finance['expenses']> }) {
  const [all, setAll] = useState(false);
  const list = all ? expenses : expenses.slice(0, 8);
  return (
    <>
      <ul className="divide-y divide-line">
        {list.map((e, i) => (
          <li key={i} className="py-3 flex items-start gap-3">
            <span className="size-10 rounded-[12px] bg-bad-soft text-bad grid place-items-center shrink-0"><ReceiptIcon className="size-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words">{e.description}</p>
              <p className="text-[13px] text-muted mt-0.5">{categoryLabel[e.category] ?? 'Other'} · {date(e.date)}</p>
              {e.receipt_checked !== undefined && (
                <p className={`text-[12.5px] mt-1 inline-flex items-center gap-1 ${e.receipt_checked ? 'text-ok' : 'text-muted'}`}>
                  {e.receipt_checked ? <><CheckCircle2 className="size-3.5" aria-hidden />Receipt checked by SAS</> : 'No receipt on file'}
                </p>
              )}
            </div>
            <p className="money font-semibold shrink-0">{peso(e.amount)}</p>
          </li>
        ))}
      </ul>
      {expenses.length > 8 && (
        <button onClick={() => setAll((v) => !v)} className="mt-2 h-11 text-[14px] font-semibold text-primary cursor-pointer">
          {all ? 'Show fewer' : `Show all ${expenses.length} expenses`}
        </button>
      )}
    </>
  );
}

/** The whole "where the money goes" view for one org/club — or the whole school (no expense list). */
export function FinancePanel({ finance, loading, title = 'Where the money goes', note }: {
  finance?: Finance | null; loading?: boolean; title?: string; note?: React.ReactNode;
}) {
  if (loading) return <Card><Spinner /></Card>;
  if (!finance) return null;
  const inn = n(finance.money_in), out = n(finance.money_out), left = inn - out;
  const top = [...finance.categories].sort((a, b) => n(b.amount) - n(a.amount))[0];
  const per100 = inn > 0 ? Math.round((out / inn) * 100) : 0;
  return (
    <section className="space-y-4" aria-label={title}>
      <Card>
        <SectionTitle>{title}</SectionTitle>
        {note && <p className="text-[13px] text-muted -mt-2 mb-3">{note}</p>}
        {/* Phones: three full-width rows (amounts never get cut off). Wider screens: three tiles. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([['Collected', inn, 'bg-chart-in'], ['Spent', out, 'bg-chart-out'], ['Still in the fund', left, '']] as const).map(([k, v, dot]) => (
            <div key={k} className="rounded-[14px] bg-surface2 px-3 py-2.5 sm:p-3 flex sm:block items-center justify-between gap-3 min-w-0">
              <p className="text-[13px] sm:text-[12px] text-muted leading-tight flex items-center gap-1.5">{dot && <i className={`size-2 rounded-sm ${dot}`} aria-hidden />}{k}</p>
              <p className="money font-display font-bold text-[18px] sm:text-[20px]">{peso(v)}</p>
            </div>
          ))}
        </div>
        <p className="text-[14px] mt-3">
          {out <= 0
            ? <>Nothing spent yet — all <b className="money">{peso(inn)}</b> is still in the fund.</>
            : <>Of every <b>₱100</b> that came in, <b className="money">₱{per100}</b> was spent{top ? <> — most on <b>{categoryLabel[top.category]?.toLowerCase()}</b></> : null}.</>}
        </p>
      </Card>
      <Card>
        <SectionTitle>Money in and out by month</SectionTitle>
        <MoneyInOut monthly={finance.monthly} />
      </Card>
      {finance.categories.length > 0 && (
        <Card>
          <SectionTitle>What it was spent on</SectionTitle>
          <SpendingByCategory categories={finance.categories} />
        </Card>
      )}
      {finance.expenses && (
        <Card>
          <SectionTitle>Approved expenses</SectionTitle>
          {finance.expenses.length
            ? <ExpenseList expenses={finance.expenses} />
            : <p className="text-[14px] text-muted">No approved expenses yet this school year.</p>}
        </Card>
      )}
    </section>
  );
}
