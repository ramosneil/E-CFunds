import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2, Moon, Sun, X } from 'lucide-react';
import { peso, pct } from '../lib/format';
import { logoUrl } from '../lib/supabase';
import { getTheme, isDark, setTheme } from '../lib/theme';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'danger' | 'soft';
export function Button({ variant = 'primary', busy, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; busy?: boolean }) {
  const v = {
    primary: 'bg-primary text-on-primary hover:brightness-110',
    gold: 'bg-gold text-on-gold hover:brightness-105',
    ghost: 'bg-transparent text-ink border border-line hover:bg-surface2',
    soft: 'bg-primary-soft text-primary hover:brightness-95',
    danger: 'bg-bad-soft text-bad hover:brightness-95',
  }[variant];
  return (
    <button {...p} disabled={p.disabled || busy}
      className={cx('inline-flex items-center justify-center gap-2 h-12 px-5 whitespace-nowrap rounded-[14px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', v, className)}>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('bg-surface border border-line rounded-[20px] p-5', className)}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-display text-[17px] font-bold">{children}</h2>{action}
    </div>
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
export function PocketBar({ cash, saved, onHero }: { cash: number; saved: number; onHero?: boolean }) {
  const total = Math.max(0, cash) + Math.max(0, saved);
  const c = pct(Math.max(0, cash), total);
  return (
    <div>
      <div className={cx('h-2.5 rounded-full overflow-hidden flex', onHero ? 'bg-white/15' : 'bg-surface2')}
        role="img" aria-label={`Cash on hand ${peso(cash)}, saved with SAS ${peso(saved)}`}>
        {total > 0 && <div className="bg-pocket-cash h-full" style={{ width: `${c}%` }} />}
        {total > 0 && <div className={cx('h-full flex-1', onHero ? 'bg-pocket-saved' : 'bg-primary')} />}
      </div>
      <div className={cx('mt-2 flex justify-between text-[13px]', onHero ? 'text-hero-muted' : 'text-muted')}>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-pocket-cash" />Cash on hand <b className={cx('money', onHero ? 'text-white' : 'text-ink')}>{peso(cash)}</b></span>
        <span className="flex items-center gap-1.5"><i className={cx('size-2 rounded-full', onHero ? 'bg-pocket-saved' : 'bg-primary')} />Saved <b className={cx('money', onHero ? 'text-white' : 'text-ink')}>{peso(saved)}</b></span>
      </div>
    </div>
  );
}

export function HeroCard({ label, total, cash, saved, foot }: { label: string; total: number; cash: number; saved: number; foot?: ReactNode }) {
  return (
    <section className="rounded-[24px] p-5 sm:p-6 text-white bg-hero relative overflow-hidden">
      <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-white/5" />
      <p className="micro text-hero-muted">{label}</p>
      <p className="money font-display font-extrabold text-[34px] sm:text-[40px] leading-tight mt-1">{peso(total)}</p>
      <div className="mt-4"><PocketBar cash={cash} saved={saved} onHero /></div>
      {foot && <div className="mt-4 text-[13px] text-hero-muted">{foot}</div>}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  const t = tone ? { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn' }[tone] : 'text-ink';
  return (
    <div className="bg-surface border border-line rounded-[18px] p-4">
      <p className="micro text-muted">{label}</p>
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
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/45 cursor-default" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto bg-surface rounded-t-[24px] sm:rounded-[24px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[20px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="size-10 grid place-items-center rounded-full hover:bg-surface2 cursor-pointer"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold leading-tight">{title}</h1>
        {sub && <p className="text-muted mt-1">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
