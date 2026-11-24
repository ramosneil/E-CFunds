// Present mode (Neil, 2026-11-25): the Insights dashboard as full-screen slides for meetings and reports to SAS.
// Always dark (.force-dark), big type, the same chart components as the page (same numbers). ← → / swipe / buttons,
// Esc or × closes. Uses the browser's full screen when it's allowed (not on every phone — then it fills the window).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { BrandMark } from '../BrandMark';

export type Slide = { kicker?: string; title: string; note?: ReactNode; body: ReactNode };

export function Present({ slides, label, onClose }: { slides: Slide[]; label: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setI((v) => Math.min(slides.length - 1, Math.max(0, v + d))), [slides.length]);
  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  useEffect(() => {
    try { void root.current?.requestFullscreen?.().catch(() => {}); } catch { /* not allowed here: the overlay still fills the window */ }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(slides.length - 1);
      else if (e.key === 'Escape') close();
    };
    // Leaving the browser's full screen (Esc there) also ends the presentation.
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs); document.body.style.overflow = prev; };
  }, [go, close, onClose, slides.length]);

  // Swipe left/right on phones and tablets.
  const touch = useRef<number | null>(null);
  const s = slides[i];
  return createPortal(
    <div ref={root} className="force-dark fixed inset-0 z-[90] bg-bg text-ink flex flex-col lux-night" role="dialog" aria-modal="true" aria-label={`${label} — presentation`}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <header className="flex items-center gap-3 px-5 sm:px-10 pt-4 sm:pt-6">
        <BrandMark size={28} />
        <p className="text-[13px] sm:text-[15px] text-muted truncate flex-1">{label}</p>
        <p className="text-[13px] sm:text-[15px] text-muted tabular-nums" aria-live="polite">{i + 1} / {slides.length}</p>
        <button type="button" onClick={close} aria-label="End presentation" className="size-11 grid place-items-center rounded-full hover:bg-surface2 cursor-pointer"><X className="size-5" aria-hidden /></button>
      </header>
      <main key={i} className="lux-enter [&_details]:hidden flex-1 overflow-y-auto px-5 sm:px-10 lg:px-16 py-5 sm:py-8 flex flex-col">
        {s.kicker && <p className="micro text-gold-text">{s.kicker}</p>}
        <h2 className="lux-title text-[30px] sm:text-[48px] lg:text-[60px] leading-[1.02] mt-1">{s.title}</h2>
        {s.note && <p className="text-[16px] sm:text-[20px] text-muted mt-3 max-w-[60ch]">{s.note}</p>}
        <div className="mt-6 sm:mt-10 flex-1 min-h-0">{s.body}</div>
      </main>
      <footer className="flex items-center justify-between gap-3 px-5 sm:px-10 pb-5 sm:pb-7">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="h-12 px-4 inline-flex items-center gap-1.5 rounded-[14px] border border-line font-semibold disabled:opacity-40 cursor-pointer hover:bg-surface2"><ChevronLeft className="size-5" aria-hidden />Back</button>
        <div className="flex gap-1.5" aria-hidden>{slides.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-gold' : 'w-1.5 bg-line'}`} />)}</div>
        <button type="button" onClick={() => (i === slides.length - 1 ? close() : go(1))} className="h-12 px-4 inline-flex items-center gap-1.5 rounded-[14px] lux-primary font-semibold cursor-pointer">{i === slides.length - 1 ? 'Finish' : 'Next'}<ChevronRight className="size-5" aria-hidden /></button>
      </footer>
    </div>,
    document.body,
  );
}
