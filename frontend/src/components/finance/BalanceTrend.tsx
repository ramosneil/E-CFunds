// Fund balance over time (Insights). One series, one axis, in the primary colour. The balance at the end of each
// month is walked back from today's real fund (end of month m = fund − the net of every later month), so the last
// point always equals the fund card. Hover/tap shows the month; the end value is labelled; table view below.
import { useState } from 'react';
import type { Finance } from '../../lib/database.types';
import { monthLabel, peso } from '../../lib/format';
import { TableView, n, niceMax, useWidth } from './chartKit';

export function balanceSeries(monthly: Finance['monthly'], fund: number) {
  const out = monthly.map((m) => ({ month: m.month, net: n(m.money_in) - n(m.money_out), balance: 0 }));
  let bal = fund;
  for (let i = out.length - 1; i >= 0; i--) { out[i].balance = bal; bal -= out[i].net; }
  return { points: out, start: bal };   // start = balance before the first month (previous funds carried in)
}

export function balanceSentence(monthly: Finance['monthly'], fund: number) {
  const { points, start } = balanceSeries(monthly, fund);
  if (!points.length) return '';
  const first = monthLabel(points[0].month);
  const d = fund - start;
  return d === 0 ? `The fund is ${peso(fund)}, the same as at the start of ${first}.`
    : `The fund ${d > 0 ? 'grew' : 'went down'} from ${peso(start)} to ${peso(fund)} since the start of ${first}.`;
}

export function BalanceTrend({ monthly, fund, tall }: { monthly: Finance['monthly']; fund: number; tall?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [setBox, width] = useWidth();
  const { points, start } = balanceSeries(monthly, fund);
  const vals = [start, ...points.map((p) => p.balance)];
  const lo = Math.min(0, ...vals);
  const hi = niceMax(Math.max(...vals) - lo) + lo;
  const W = width, H = tall ? Math.round(Math.min(420, width * 0.45)) : width < 480 ? 190 : 230, L = 56, R = 16, T = 14, B = 28;
  const pw = W - L - R, ph = H - T - B;
  // x: the start of the year at the left edge, then the end of each month.
  const x = (i: number) => L + (pw * i) / Math.max(points.length, 1);
  const y = (v: number) => T + ph - ((v - lo) / (hi - lo || 1)) * ph;
  const xy = [{ x: x(0), y: y(start) }, ...points.map((p, i) => ({ x: x(i + 1), y: y(p.balance) }))];
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const area = `${line}L${xy.at(-1)!.x.toFixed(1)},${y(Math.max(lo, 0))}L${xy[0].x.toFixed(1)},${y(Math.max(lo, 0))}Z`;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const h = hover !== null ? points[hover] : null;
  const fs = tall ? 14 : 11;
  return (
    <div>
      <div className="relative" ref={setBox} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="w-full h-auto block" role="img"
          aria-label={`Fund balance by month: ${points.map((p) => `${monthLabel(p.month)} ${peso(p.balance)}`).join('; ')}`}>
          <defs>
            <linearGradient id="bal-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={fs} fill="var(--muted)" className="money">{peso(Math.round(t)).replace('.00', '')}</text>
            </g>
          ))}
          <path d={area} fill="url(#bal-fill)" />
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth={tall ? 3 : 2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <text key={p.month} x={x(i + 1)} y={H - 8} textAnchor={i === points.length - 1 ? 'end' : 'middle'} fontSize={fs}
              fill={hover === i ? 'var(--text)' : 'var(--muted)'}>{monthLabel(p.month)}</text>
          ))}
          {hover !== null && <line x1={x(hover + 1)} x2={x(hover + 1)} y1={T} y2={T + ph} stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 3" />}
          {/* End marker (+ value) — always; hover marker when pointing at a month. Markers ≥ 8 px with a surface ring. */}
          <circle cx={xy.at(-1)!.x} cy={xy.at(-1)!.y} r={tall ? 6 : 4.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
          {hover !== null && hover !== points.length - 1 && <circle cx={x(hover + 1)} cy={y(points[hover].balance)} r={4.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />}
          <text x={xy.at(-1)!.x - 8} y={Math.max(T + 12, xy.at(-1)!.y - 10)} textAnchor="end" fontSize={fs} fontWeight={700} fill="var(--text)" className="money">{peso(fund)}</text>
          {points.map((p, i) => (
            <rect key={p.month} x={x(i + 1) - pw / Math.max(points.length, 1) / 2} y={T} width={pw / Math.max(points.length, 1)} height={ph + B}
              fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onClick={() => setHover(hover === i ? null : i)} />
          ))}
        </svg>
        {h && hover !== null && (
          <div role="status" className="absolute top-0 -translate-x-1/2 pointer-events-none rounded-[12px] border border-line bg-surface shadow-lg px-3 py-2 text-[13px] whitespace-nowrap"
            style={{ left: `${Math.min(85, Math.max(15, (x(hover + 1) / W) * 100))}%` }}>
            <p className="font-semibold">End of {monthLabel(h.month, true)}</p>
            <p className="money font-bold text-[15px]">{peso(h.balance)}</p>
            <p className="text-muted">{h.net === 0 ? 'No change that month' : `${h.net > 0 ? '+' : '−'}${peso(Math.abs(h.net))} that month`}</p>
          </div>
        )}
      </div>
      <TableView>
        <table className="w-full text-[13px] mt-1">
          <thead><tr className="text-muted text-left"><th className="py-1 font-semibold">Month</th><th className="py-1 font-semibold text-right">Change</th><th className="py-1 font-semibold text-right">Fund at month end</th></tr></thead>
          <tbody>
            <tr className="border-t border-line"><td className="py-1.5 text-muted">Start of the year</td><td /><td className="py-1.5 text-right money">{peso(start)}</td></tr>
            {points.map((p) => <tr key={p.month} className="border-t border-line"><td className="py-1.5">{monthLabel(p.month, true)}</td><td className="py-1.5 text-right money">{peso(p.net, { sign: true })}</td><td className="py-1.5 text-right money">{peso(p.balance)}</td></tr>)}
          </tbody>
        </table>
      </TableView>
    </div>
  );
}
