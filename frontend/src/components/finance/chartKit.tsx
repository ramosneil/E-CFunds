// Shared pieces for every finance chart (FinancePanel + Insights). Rules (dataviz): one axis, thin marks with 4px
// rounded ends on a baseline, recessive grid, values in text colours, hover/tap tooltip, and always a table view.
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export const n = (v: unknown) => Number(v) || 0;

/** Nice round top for the y-axis (₱0, ₱50, ₱100 … ). */
export function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => v <= s * 4)!;
  return step * 4;
}

/** A bar whose top corners are rounded (4px) and whose bottom sits flat on the baseline. */
export function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Draw at the real on-screen width (not a scaled picture), so 11 px labels stay 11 px on phones. */
export function useWidth(fallback = 640) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!box) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  return [setBox, width] as const;
}

export function TableView({ children, label = 'Show as table' }: { children: ReactNode; label?: string }) {
  return (
    <details className="mt-3 group">
      <summary className="list-none cursor-pointer text-[13px] font-semibold text-primary inline-flex items-center gap-1 h-11">
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />{label}
      </summary>
      <div className="overflow-x-auto">{children}</div>
    </details>
  );
}

/** A small legend swatch + label (identity is never colour alone: the label is always there). */
export function Key({ color, children, outline }: { color: string; children: ReactNode; outline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="size-2.5 rounded-sm" style={outline ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { background: color }} aria-hidden />{children}
    </span>
  );
}
