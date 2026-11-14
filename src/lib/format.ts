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

/** Same cleaning as the database (migration 10): spaces removed, letters upper-cased. */
export function normStudentNo(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** Calendar date (YYYY-MM-DD) in Manila time — the school's day, whatever the device's timezone. */
const manila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
export function manilaDate(d: Date | string = new Date()): string {
  return manila.format(typeof d === 'string' ? new Date(d) : d);
}

/** Expense categories (migration 27) — the treasurer picks one; SAS may change it when approving. */
export const categoryLabel: Record<string, string> = {
  events: 'Events & activities', supplies: 'Supplies & materials', food: 'Food & refreshments',
  transport: 'Transportation', printing: 'Printing & tarpaulins', outreach: 'Outreach & donations', other: 'Other',
};
export const CATEGORIES = ['events', 'supplies', 'food', 'transport', 'printing', 'outreach', 'other'] as const;

/** '2026-11' → 'Nov' (with the year when asked). */
export const monthLabel = (ym: string, withYear = false) =>
  new Intl.DateTimeFormat('en-PH', { month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(`${ym}-01T00:00:00Z`));
