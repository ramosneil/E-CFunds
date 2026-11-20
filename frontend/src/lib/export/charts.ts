// Vector charts drawn straight into the PDF (no chart library). Colours were run through the dataviz validator on
// a white page: cash/saved = #E0A82E / #3355CC (all checks pass; gold < 3:1 → every gold mark carries a printed label),
// money in/out = #0E8A7A / #D9480F (CVD ΔE 13.5, all pass). Marks: thin bars, rounded ends, 2 px gaps, values printed.
import { peso } from '../format';
import { INK, LINE, MUTED, PAGE, text, type Doc } from './pdf';

export const C = { cash: '#E0A82E', saved: '#3355CC', in: '#0E8A7A', out: '#D9480F', track: '#EEF1F7' };
const GAP = 0.6; // ≈2 px surface gap between adjacent fills

function bar(doc: Doc, x: number, y: number, w: number, h: number, color: string, round = 1) {
  if (w <= 0.05 || h <= 0.05) return;
  doc.setFillColor(color);
  doc.roundedRect(x, y, w, h, Math.min(round, w / 2, h / 2), Math.min(round, w / 2, h / 2), 'F');
}

function legend(doc: Doc, x: number, y: number, items: [string, string][]) {
  let cx = x;
  for (const [label, color] of items) {
    bar(doc, cx, y - 2.4, 3, 3, color, 0.8);
    text(doc, label, cx + 4.5, y, { size: 8, color: MUTED });
    doc.setFontSize(8);
    cx += 4.5 + doc.getTextWidth(label) + 7;
  }
}

/** Two-pocket bar: gold = cash on hand, blue = saved with SAS, with both amounts printed. Returns next y. */
export function pocketBar(doc: Doc, y: number, cash: number, saved: number) {
  const x = PAGE.m, w = doc.internal.pageSize.getWidth() - PAGE.m * 2, h = 6;
  const c = Math.max(0, cash), s = Math.max(0, saved), t = c + s;
  bar(doc, x, y, w, h, C.track, 2);
  if (t > 0) {
    const cw = (c / t) * w;
    if (c > 0) bar(doc, x, y, s > 0 ? cw - GAP / 2 : w, h, C.cash, 2);
    if (s > 0) bar(doc, c > 0 ? x + cw + GAP / 2 : x, y, c > 0 ? w - cw - GAP / 2 : w, h, C.saved, 2);
  }
  legend(doc, x, y + h + 5.5, [[`Cash on hand ${peso(cash)}`, C.cash], [`Saved with SAS ${peso(saved)}`, C.saved]]);
  return y + h + 10;
}

/** Horizontal bars with category labels on the left and the value printed at the bar end. Returns next y. */
export function hBars(doc: Doc, y: number, rows: { label: string; value: number; color: string; note?: string }[], o: { labelW?: number; fmt?: (n: number) => string; max?: number } = {}) {
  const x = PAGE.m, full = doc.internal.pageSize.getWidth() - PAGE.m * 2, lw = o.labelW ?? 34, valW = 30;
  const bw = full - lw - valW, max = o.max ?? Math.max(1, ...rows.map((r) => Math.abs(r.value))), rowH = 7.5, h = 4.2;
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    text(doc, r.label, x, yy + h - 0.6, { size: 8.5 });
    bar(doc, x + lw, yy, bw, h, C.track, 1);
    bar(doc, x + lw, yy, (Math.abs(r.value) / max) * bw, h, r.color, 1);
    text(doc, (o.fmt ?? peso)(r.value) + (r.note ? `  ${r.note}` : ''), x + lw + bw + 2.5, yy + h - 0.6, { size: 8.5, bold: true });
  });
  return y + rows.length * rowH + 2;
}

/** Stacked horizontal bars (cash + saved) per org, total printed at the end. Returns next y. */
export function stackedPockets(doc: Doc, y: number, rows: { label: string; cash: number; saved: number }[]) {
  const x = PAGE.m, full = doc.internal.pageSize.getWidth() - PAGE.m * 2, lw = 30, valW = 28;
  const bw = full - lw - valW, max = Math.max(1, ...rows.map((r) => Math.max(0, r.cash) + Math.max(0, r.saved))), rowH = 7, h = 4;
  legend(doc, x + lw, y, [['Cash on hand', C.cash], ['Saved with SAS', C.saved]]);
  y += 4;
  rows.forEach((r, i) => {
    const yy = y + i * rowH, c = Math.max(0, r.cash), s = Math.max(0, r.saved);
    text(doc, r.label, x, yy + h - 0.5, { size: 8.5 });
    bar(doc, x + lw, yy, bw, h, C.track, 1);
    const cw = (c / max) * bw, sw = (s / max) * bw;
    if (c > 0) bar(doc, x + lw, yy, Math.max(0.4, cw - (s > 0 ? GAP / 2 : 0)), h, C.cash, 1);
    if (s > 0) bar(doc, x + lw + cw + (c > 0 ? GAP / 2 : 0), yy, Math.max(0.4, sw - (c > 0 ? GAP / 2 : 0)), h, C.saved, 1);
    text(doc, peso(r.cash + r.saved), x + lw + bw + 2.5, yy + h - 0.5, { size: 8.5, bold: true });
  });
  return y + rows.length * rowH + 2;
}

/** Monthly money in vs money out, grouped vertical bars on one axis, values printed above non-zero bars. */
export function monthly(doc: Doc, y: number, months: { label: string; in: number; out: number }[]) {
  const x = PAGE.m, w = doc.internal.pageSize.getWidth() - PAGE.m * 2, h = 46, axisW = 16;
  const max = Math.max(1, ...months.flatMap((m) => [m.in, m.out]));
  const nice = niceMax(max), plotW = w - axisW, slot = plotW / months.length, bw = Math.min(6, slot * 0.32);
  legend(doc, x + axisW, y, [['Money in', C.in], ['Money out', C.out]]);
  const top = y + 5, base = top + h;
  doc.setLineWidth(0.15);
  for (let i = 0; i <= 4; i++) {                       // recessive grid
    const gy = base - (h * i) / 4;
    doc.setDrawColor(i === 0 ? '#B8C0D4' : LINE); doc.line(x + axisW, gy, x + w, gy);
    text(doc, peso((nice * i) / 4).replace('.00', ''), x + axisW - 2, gy + 1, { size: 6.5, color: MUTED, align: 'right' });
  }
  months.forEach((m, i) => {
    const cx = x + axisW + slot * i + slot / 2;
    const hi = (m.in / nice) * h, ho = (m.out / nice) * h;
    if (hi > 0) { bar(doc, cx - bw - GAP / 2, base - hi, bw, hi, C.in, 0.8); text(doc, short(m.in), cx - bw / 2 - GAP / 2, base - hi - 1.2, { size: 6, color: INK, align: 'center' }); }
    if (ho > 0) { bar(doc, cx + GAP / 2, base - ho, bw, ho, C.out, 0.8); text(doc, short(m.out), cx + bw / 2 + GAP / 2, base - ho - 1.2, { size: 6, color: INK, align: 'center' }); }
    text(doc, m.label, cx, base + 4, { size: 7, color: MUTED, align: 'center' });
  });
  return base + 9;
}

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function short(n: number) {
  return n >= 1000 ? `₱${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₱${Math.round(n)}`;
}

/** Summary tiles in one row. Returns next y. */
export function tiles(doc: Doc, y: number, items: { label: string; value: string }[]) {
  const x = PAGE.m, w = doc.internal.pageSize.getWidth() - PAGE.m * 2, gap = 3, tw = (w - gap * (items.length - 1)) / items.length, h = 16;
  items.forEach((it, i) => {
    const tx = x + i * (tw + gap);
    doc.setDrawColor(LINE); doc.setFillColor('#FFFFFF'); doc.setLineWidth(0.2);
    doc.roundedRect(tx, y, tw, h, 2.5, 2.5, 'FD');
    text(doc, it.label.toUpperCase(), tx + 3, y + 5.5, { size: 6.5, color: MUTED, bold: true });
    text(doc, it.value, tx + 3, y + 12, { size: 11, bold: true });
  });
  return y + h + 6;
}
