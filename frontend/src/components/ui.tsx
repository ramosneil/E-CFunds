import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown, Loader2, Moon, Sun, X } from 'lucide-react';
import { peso, pct } from '../lib/format';
import { logoUrl } from '../lib/supabase';
import { getTheme, isDark, setTheme } from '../lib/theme';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'danger' | 'soft';
export function Button({ variant = 'primary', busy, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  const v = {
    primary: 'lux-primary',
    gold: 'lux-gold-btn',
    ghost: 'bg-transparent text-ink border border-line hover:bg-surface2',
    soft: 'bg-primary-soft text-primary hover:brightness-95',
    danger: 'bg-bad-soft text-bad hover:brightness-95',
  }[variant];
  return (
    <button {...p} disabled={p.disabled || busy}
      className={cx('lux-press inline-flex items-center justify-center gap-2 h-12 px-5 whitespace-nowrap rounded-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', v, className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('lux-card bg-surface border border-line rounded-[20px] p-5', className)}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-display text-[17px] font-bold">{children}</h2>{action}
    </div>
  );
}

/** A card that folds down to its title (Neil, 2026-11-25: "Hide" on Home lists and the Activity log). The choice is
 *  remembered on this device. `flush` = the body has no padding (full-width lists); `actions` show only when open. */
export function FoldCard({ id, title, actions, flush, className, children }:
  { id: string; title: ReactNode; actions?: ReactNode; flush?: boolean; className?: string; children: ReactNode }) {
  const key = `fold:${id}`;
  const [folded, setFolded] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const toggle = () => {
    const v = !folded;
    setFolded(v);
    try { if (v) localStorage.setItem(key, '1'); else localStorage.removeItem(key); } catch { /* private mode: this visit only */ }
  };
  // Title + Hide always share the first line; on phones the actions (Clear all, All …) get their own line below.
  const pad = flush ? 'px-4 sm:px-5' : '';
  return (
    <section className={cx('lux-card bg-surface border border-line rounded-[20px]', flush ? 'py-2' : 'p-5 pt-3', className)}>
      <div className={cx('flex items-center gap-x-2', pad, folded && !flush && '-mb-2')}>
        <h2 className="font-display text-[17px] font-bold mr-auto min-w-0 truncate">{title}</h2>
        {!folded && actions && <div className="hidden sm:flex items-center gap-x-1">{actions}</div>}
        <button type="button" onClick={toggle} aria-expanded={!folded}
          className="h-11 -mr-2 px-2.5 shrink-0 inline-flex items-center gap-1 rounded-[12px] text-[13.5px] font-semibold text-muted hover:text-ink hover:bg-surface2 cursor-pointer">
          {folded ? 'Show' : 'Hide'}
          <ChevronDown className={cx('size-4 transition', folded ? '' : 'rotate-180')} aria-hidden />
        </button>
      </div>
      {!folded && actions && <div className={cx('sm:hidden flex flex-wrap items-center gap-x-1 -ml-2.5 -mt-1', flush && 'px-4')}>{actions}</div>}
      {!folded && <div className={cx(flush ? 'mt-1' : 'mt-1')}>{children}</div>}
    </section>
  );
}

/** The small "×" that clears one item from the viewer's own list (the record itself stays). */
export function ClearButton({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }} disabled={busy}
      aria-label={`Clear ${label} from my list`} title="Clear from my list"
      className="size-11 -mr-2 shrink-0 grid place-items-center rounded-full text-muted hover:text-bad hover:bg-bad-soft cursor-pointer disabled:opacity-50">
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-[18px]" aria-hidden />}
    </button>
  );
}

/** "Clear all" for a FoldCard's actions slot. */
export function ClearAllButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="h-11 px-2.5 inline-flex items-center gap-1.5 rounded-[12px] text-[13.5px] font-semibold text-muted hover:text-bad hover:bg-bad-soft cursor-pointer disabled:opacity-50">
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}Clear all
    </button>
  );
}

type Tone = 'ok' | 'warn' | 'bad' | 'gold' | 'primary' | 'muted';
export function Chip({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  const t = {
    ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad',
    gold: 'bg-gold-soft text-gold-text', primary: 'bg-primary-soft text-primary', muted: 'bg-surface2 text-muted',
  }[tone];
  return <span className={cx('inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap', t)}>{children}</span>;
}

export const statusTone: Record<string, Tone> = {
  pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'muted', disabled: 'muted',
  accredited: 'ok', expired: 'bad', revoked: 'bad',
};
export function StatusChip({ status }: { status: string }) {
  return <Chip tone={statusTone[status] ?? 'muted'}>{status[0].toUpperCase() + status.slice(1)}</Chip>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-muted mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-[13px] text-muted mt-1">{hint}</span>}
      {error && <span className="block text-[13px] text-bad mt-1" role="alert">{error}</span>}
    </label>
  );
}

const inputCls = 'w-full h-12 px-4 rounded-[12px] bg-surface border border-line outline-none focus:border-primary placeholder:text-muted/70';
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, 'pr-8', p.className)}>{children}</select>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

/** Shows nothing for quick loads; a spinner only if a screen takes longer than ~300 ms. */
export function Loading() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);
  return show ? <Spinner /> : null;
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      {icon && <div className="mx-auto mb-3 size-12 rounded-2xl bg-primary-soft text-primary grid place-items-center">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="text-muted text-[14px] mt-1">{children}</div>}
    </div>
  );
}

export function Alert({ tone = 'bad', children }: { tone?: 'bad' | 'ok' | 'warn'; children: ReactNode }) {
  const t = { bad: 'bg-bad-soft text-bad', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn' }[tone];
  return <div className={cx('rounded-[12px] px-4 py-3 text-[14px] font-medium', t)} role={tone === 'bad' ? 'alert' : 'status'}>{children}</div>;
}

/** Gold = cash on hand (treasurer), blue = saved with SAS. Shown on every money card. */
/** `bare`: just the bar (the fund card shows the two numbers above it). */
export function PocketBar({ cash, saved, onHero, bare }: { cash: number; saved: number; onHero?: boolean; bare?: boolean }) {
  const total = Math.max(0, cash) + Math.max(0, saved);
  const c = pct(Math.max(0, cash), total);
  return (
    <div>
      <div className={cx('h-2.5 rounded-full overflow-hidden flex', onHero ? 'bg-white/15' : 'bg-surface2')}
        role="img" aria-label={`Cash on hand ${peso(cash)}, saved with SAS ${peso(saved)}`}>
        {total > 0 && <div className="bg-pocket-cash h-full" style={{ width: `${c}%` }} />}
        {total > 0 && <div className={cx('h-full flex-1', onHero ? 'bg-pocket-saved' : 'bg-primary')} />}
      </div>
      {!bare && <div className={cx('mt-2 flex justify-between text-[13px]', onHero ? 'text-hero-muted' : 'text-muted')}>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-pocket-cash" />Cash on hand <b className={cx('money', onHero ? 'text-white' : 'text-ink')}>{peso(cash)}</b></span>
        <span className="flex items-center gap-1.5"><i className={cx('size-2 rounded-full', onHero ? 'bg-pocket-saved' : 'bg-primary')} />Saved <b className={cx('money', onHero ? 'text-white' : 'text-ink')}>{peso(saved)}</b></span>
      </div>}
    </div>
  );
}

/** Counts from the old number to the new one (~0.7 s) when it changes; `changed` is on for a moment after. */
function useCountTo(value: number) {
  const [shown, setShown] = useState(value);
  const [changed, setChanged] = useState(false);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    from.current = value;
    setChanged(true);
    const off = setTimeout(() => setChanged(false), 1600);
    if (document.hidden || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return () => clearTimeout(off); }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700), e = 1 - (1 - k) ** 3;
      setShown(start + (value - start) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); clearTimeout(off); };
  }, [value]);
  return { shown: Math.round(shown * 100) / 100, changed };
}

/** The big fund card: **Cash on hand** and **Saved with SAS** as the two main numbers (Neil, 2026-11-17: no "Total
 *  fund"). They refresh by themselves whenever the treasurer or SAS records anything (src/lib/live.ts) — each
 *  number counts to its new value with a glow, and `latest` / `pending` show what moved them. */
export function HeroCard({ label, cash, saved, foot, latest, pending }: {
  label: string; total?: number; cash: number; saved: number; foot?: ReactNode; latest?: ReactNode; pending?: ReactNode;
}) {
  const c = useCountTo(Number(cash) || 0), s = useCountTo(Number(saved) || 0);
  const changed = c.changed || s.changed;
  // Each number fills its half of the card and shrinks for big amounts (₱1,234,567.89 still fits on a phone):
  // size = column width ÷ characters (container units), between 16 and 34 px. Both use the longer one, so they match.
  const chars = Math.max(peso(c.shown).length, peso(s.shown).length);
  const big = 'money font-display font-extrabold leading-tight whitespace-nowrap block';
  const size = { fontSize: `clamp(16px, calc(100cqw / ${(chars * 0.64).toFixed(2)}), 34px)` };
  return (
    <section className={cx('rounded-[24px] p-5 sm:p-6 text-white lux-ground relative overflow-hidden transition-shadow duration-700 shadow-[0_24px_48px_-28px_rgb(14_22_64/.8)]',
      changed && 'ring-2 ring-pocket-cash/70')}>
      <div aria-hidden className="absolute inset-0 lux-grid pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <p className="micro text-hero-muted min-w-0 flex-1">{label}</p>
      </div>
      <dl className="relative grid grid-cols-2 gap-4 mt-2" aria-live="polite">
        <div className="min-w-0 [container-type:inline-size]">
          <dt className="flex items-center gap-1.5 text-[13px] text-hero-muted"><i className="size-2 rounded-full bg-pocket-cash" aria-hidden />Cash on hand</dt>
          <dd className={big} style={size}>{peso(c.shown)}</dd>
        </div>
        <div className="min-w-0 [container-type:inline-size]">
          <dt className="flex items-center gap-1.5 text-[13px] text-hero-muted"><i className="size-2 rounded-full bg-pocket-saved" aria-hidden />Saved with SAS</dt>
          <dd className={big} style={size}>{peso(s.shown)}</dd>
        </div>
      </dl>
      <div className="relative mt-3"><PocketBar cash={c.shown} saved={s.shown} onHero bare /></div>
      {latest && <div className="relative text-[13px] text-hero-muted mt-3">{latest}</div>}
      {pending && <div className="relative mt-3 rounded-[14px] bg-white/10 border border-white/10 px-3 py-2 text-[13px] text-white">{pending}</div>}
      {foot && <div className="relative mt-3 text-[13px] text-hero-muted">{foot}</div>}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  const t = tone ? { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn' }[tone] : 'text-ink';
  const dot = tone ? { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn' }[tone] : 'bg-line';
  return (
    <div className="lux-card bg-surface border border-line rounded-[18px] p-4">
      <p className="micro text-muted flex items-center gap-1.5"><i className={cx('size-1.5 rounded-full shrink-0', dot)} aria-hidden />{label}</p>
      <p className={cx('money font-display font-bold text-[20px] mt-1', t)}>{value}</p>
    </div>
  );
}

export function DuesBar({ paid, members }: { paid: number; members: number }) {
  return (
    <div>
      <div className="h-2 rounded-full bg-surface2 overflow-hidden"><div className="h-full bg-ok" style={{ width: `${pct(paid, members)}%` }} /></div>
      <p className="text-[13px] text-muted mt-1.5"><b className="text-ink money">{paid}</b> of <span className="money">{members}</span> paid</p>
    </div>
  );
}

export function EntityLogo({ path, name, size = 40 }: { path: string | null; name: string; size?: number }) {
  const src = logoUrl(path);
  const [broken, setBroken] = useState(false);
  const initials = name.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return src && !broken
    ? <img src={src} alt="" width={size} height={size} onError={() => setBroken(true)} className="rounded-full bg-white object-contain shrink-0 border border-line" style={{ width: size, height: size }} />
    : <span className="rounded-full bg-primary-soft text-primary font-bold grid place-items-center shrink-0 text-[13px]" style={{ width: size, height: size }}>{initials}</span>;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(isDark());
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => { if (getTheme() === 'system') setDark(mq.matches); };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const flip = () => { const next = dark ? 'light' : 'dark'; setTheme(next); setDark(!dark); };
  return (
    <button type="button" onClick={flip} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cx('size-11 grid place-items-center rounded-full hover:bg-surface2 text-muted cursor-pointer', className)}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children, top }: { open: boolean; onClose: () => void; title: string; children: ReactNode; top?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`fixed inset-0 ${top ? 'z-[75]' : 'z-50'} flex items-end sm:items-center justify-center`} role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/45 cursor-default" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-surface rounded-t-[26px] sm:rounded-[24px] p-5 pt-3 sm:pt-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgb(5_10_40/.35)] sm:shadow-[0_30px_80px_-30px_rgb(5_10_40/.6)]">
        <div aria-hidden className="sm:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[20px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="size-10 grid place-items-center rounded-full hover:bg-surface2 cursor-pointer"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Good morning, Neil · Tuesday, 24 November" (Manila time) — above the title on the home screens. */
export function Greeting({ name }: { name?: string | null }) {
  const now = new Date();
  const h = Number(new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(now));
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  const nice = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
  const day = new Intl.DateTimeFormat('en-PH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Manila' }).format(now);
  return (
    <p className="text-[14px] font-semibold text-muted mb-1 flex items-center gap-2">
      <i className="size-1.5 rounded-full bg-pocket-cash" aria-hidden />{part}{nice ? `, ${nice}` : ''}<span aria-hidden>·</span><span className="font-normal">{day}</span>
    </p>
  );
}

export function PageHeader({ title, sub, action, eyebrow }: { title: string; sub?: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
      <div>
        {eyebrow && <p className="micro text-gold-text mb-1.5">{eyebrow}</p>}
        <h1 className="lux-title text-[30px] sm:text-[40px]">{title}</h1>
        {sub && <p className="text-muted mt-1.5">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
