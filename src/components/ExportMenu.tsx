import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { errorText } from '../lib/supabase';

export type ExportOption = { label: string; kind: 'pdf' | 'csv' | 'xlsx'; run: () => Promise<void> };

/** "Export" button with a small menu. The export code (and jsPDF) loads only when an option is picked. */
export function ExportMenu({ options, label = 'Export' }: { options: ExportOption[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function pick(o: ExportOption) {
    setBusy(o.label); setErr(''); setOpen(false);
    try { await o.run(); } catch (x) { setErr(errorText(x)); } finally { setBusy(null); }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={!!busy} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex items-center gap-2 h-11 px-4 rounded-[14px] border border-line bg-surface font-semibold hover:bg-surface2 disabled:opacity-60 cursor-pointer whitespace-nowrap">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
        {busy ? 'Preparing…' : label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-72 rounded-[16px] border border-line bg-surface shadow-xl p-1.5">
          {options.map((o) => (
            <button key={o.label} role="menuitem" type="button" onClick={() => pick(o)}
              className="w-full flex items-center gap-3 px-3 h-11 rounded-[12px] text-left text-[14px] font-semibold hover:bg-surface2 cursor-pointer">
              {o.kind === 'pdf' ? <FileText className="size-4 text-bad" aria-hidden /> : <FileSpreadsheet className="size-4 text-ok" aria-hidden />}
              <span className="flex-1">{o.label}</span>
              <span className="text-[11px] font-bold text-muted uppercase">{o.kind}</span>
            </button>
          ))}
        </div>
      )}
      {err && <p role="alert" className="absolute right-0 mt-2 w-64 text-[13px] text-bad bg-bad-soft rounded-[12px] px-3 py-2 z-40">{err}</p>}
    </div>
  );
}

/** Lazily loads the export module (keeps jsPDF and the report code out of the main bundle). */
export const exportsLib = () => import('../lib/export/reports');
