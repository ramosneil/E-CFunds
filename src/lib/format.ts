// Money: ₱ + 2 decimals, tabular figures in CSS, true minus sign (design-system §3).
const nf = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function peso(n: number | string | null | undefined, opts: { sign?: boolean } = {}): string {
  const v = Number(n ?? 0);
  const body = '₱' + nf.format(Math.abs(v));
  if (v < 0) return '−' + body;
  return opts.sign && v > 0 ? '+' + body : body;
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;
}

const df = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
export function date(d: string | null | undefined): string {
  if (!d) return '—';
  const x = d.length === 10 ? new Date(d + 'T00:00:00') : new Date(d);
  return df.format(x);
}

export const kindLabel: Record<string, string> = {
  remittance: 'Remittance', release: 'Release', expense: 'Expense', collection: 'Collection',
  opening: 'Opening balance', adjustment: 'Adjustment', reversal: 'Reversal',
};
