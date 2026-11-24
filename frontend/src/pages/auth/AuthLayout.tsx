import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Lock, ReceiptText, UserCheck } from 'lucide-react';
import { PocketBar, ThemeToggle } from '../../components/ui';
import { ReceiptChip } from './landing';

/** Sign-in / sign-up / reset screens (v2 2026-11-24, navy and gold). `tab` shows the one-tap Sign in ⇄ Create
 *  account switch. Computers: a gradient panel on the left. Phones and the app: a gradient band with the title on top,
 *  the form on a sheet below it. */
export function AuthLayout({ title, sub, children, tab }: { title: string; sub?: ReactNode; children: ReactNode; tab?: 'login' | 'register' }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden lg:block relative lux-ground text-white overflow-hidden">
        <div aria-hidden className="absolute inset-0 lux-grid" />
        <div className="relative h-full flex flex-col justify-between gap-10 p-12">
          <Link to="/welcome" aria-label="E-CFunds — about this system" className="self-start rounded-xl focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"><Brand light /></Link>
          <div className="max-w-[500px]">
            <p className="font-display font-extrabold text-[40px] leading-[1.08]">Every peso of every club, <span className="lux-gold-text">out in the open.</span></p>
            <p className="text-hero-muted mt-4 text-[16px] leading-relaxed">Dues, remittances and resolution requests for OMSC student organizations and clubs.</p>
            <div className="relative mt-9">
              <SampleFundCard />
              <ReceiptChip className="absolute -right-6 -bottom-16" />
            </div>
            <ul className="mt-24 space-y-2.5 text-[14px] text-hero-muted">
              <li className="flex items-center gap-2.5"><Lock className="size-4 text-pocket-cash" aria-hidden />A ledger nobody can quietly edit</li>
              <li className="flex items-center gap-2.5"><ReceiptText className="size-4 text-pocket-cash" aria-hidden />A numbered receipt for every payment</li>
              <li className="flex items-center gap-2.5"><UserCheck className="size-4 text-pocket-cash" aria-hidden />Every account approved by SAS</li>
            </ul>
          </div>
          <p className="text-hero-muted text-[13px]">Office of Student Affairs and Services · OMSC Mamburao</p>
        </div>
      </aside>
      <div className="flex flex-col min-w-0">
        {/* Phones and the app: gradient band with the brand and the title. */}
        <header className="lg:hidden relative lux-ground text-white overflow-hidden px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
          <div aria-hidden className="absolute inset-0 lux-grid" />
          <div className="relative flex items-center justify-between">
            <Link to="/welcome" aria-label="E-CFunds — about this system" className="rounded-xl"><Brand light /></Link>
            <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
          </div>
          <div className="relative mt-7 max-w-[400px] sm:mx-auto">
            <h1 className="font-display text-[28px] font-extrabold leading-tight">{title}</h1>
            {sub && <p className="text-hero-muted mt-1.5">{sub}</p>}
          </div>
        </header>
        <main className="relative flex-1 flex flex-col bg-bg px-5 pb-6 sm:px-10 -mt-6 lg:mt-0 rounded-t-[28px] lg:rounded-none pt-6">
          <div className="hidden lg:flex justify-end"><ThemeToggle /></div>
          <div className="flex-1 flex lg:items-center justify-center lg:py-8">
            <div className="w-full max-w-[400px]">
              {tab && (
                <nav aria-label="Sign in or create an account" className="grid grid-cols-2 bg-surface2 rounded-[14px] p-1 mb-7">
                  {([['login', 'Sign in'], ['register', 'Create account']] as const).map(([k, label]) => (
                    <Link key={k} to={`/${k}`} replace aria-current={tab === k ? 'page' : undefined}
                      className={`h-11 rounded-[11px] grid place-items-center font-semibold text-[14.5px] transition ${tab === k ? 'lux-primary' : 'text-muted hover:text-ink'}`}>
                      {label}
                    </Link>
                  ))}
                </nav>
              )}
              <div className="hidden lg:block mb-7">
                <h1 className="font-display text-[30px] font-extrabold leading-tight">{title}</h1>
                {sub && <p className="text-muted mt-1.5">{sub}</p>}
              </div>
              {children}
            </div>
          </div>
          <div className="mt-8"><LegalFooter /></div>
        </main>
      </div>
    </div>
  );
}

/** Privacy · Terms · who runs E-CFunds — the same small footer on every signed-out screen. */
export function LegalFooter() {
  return (
    <p className="text-center text-[12.5px] text-muted">
      <Link to="/privacy" className="inline-block py-2 hover:text-ink underline-offset-2 hover:underline">Privacy</Link><span aria-hidden> · </span>
      <Link to="/terms" className="inline-block py-2 hover:text-ink underline-offset-2 hover:underline">Terms</Link><span aria-hidden> · </span>
      <span>Office of Student Affairs and Services · OMSC Mamburao</span>
    </p>
  );
}

/** A fund card with example numbers (clearly labelled), so visitors see what E-CFunds shows before signing in.
 *  `compact`: the two numbers and the pocket bar only (phone welcome). */
export function SampleFundCard({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return (
    <figure className={`rounded-[22px] bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/15 backdrop-blur-sm ${compact ? 'p-4' : 'p-5'} text-white shadow-[0_30px_60px_-30px_rgb(5_10_40/.7)] ${className}`}>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="micro text-hero-muted">Funds · Sports Club</span>
        <span className="rounded-full bg-pocket-cash/20 px-2.5 py-0.5 text-[11.5px] font-semibold text-pocket-cash">Example</span>
      </figcaption>
      <dl className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <dt className="flex items-center gap-1.5 text-[13px] text-hero-muted"><i className="size-2 rounded-full bg-pocket-cash" aria-hidden />Cash on hand</dt>
          <dd className={`money font-display font-extrabold leading-tight ${compact ? 'text-[22px]' : 'text-[26px]'}`}>₱1,250.00</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[13px] text-hero-muted"><i className="size-2 rounded-full bg-pocket-saved" aria-hidden />Saved with SAS</dt>
          <dd className={`money font-display font-extrabold leading-tight ${compact ? 'text-[22px]' : 'text-[26px]'}`}>₱8,470.00</dd>
        </div>
      </dl>
      <div className="mt-3"><PocketBar cash={1250} saved={8470} onHero bare /></div>
      {!compact && (
        <ul className="mt-4 space-y-2 text-[13.5px]">
          <li className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.08] px-3 py-2.5">
            <span>Resolution request · Intramurals</span><span className="text-[12px] font-semibold text-[#86EFAC]">Approved</span>
          </li>
          <li className="flex items-center justify-between gap-3 rounded-[12px] bg-white/[0.08] px-3 py-2.5">
            <span>Dues · 28 of 30 paid</span><span className="money font-semibold">₱560.00</span>
          </li>
        </ul>
      )}
    </figure>
  );
}

export function Brand({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 relative" aria-label="E-CFunds">
      <span className={`size-9 rounded-xl grid place-items-center font-display font-extrabold ${light ? 'bg-white text-hero' : 'bg-primary text-on-primary'}`}>₱</span>
      {/* compact: the phone top bar hides the word on very small screens (under 360 px) to fit its 4 buttons */}
      <span className={`font-display font-extrabold text-[18px] tracking-tight ${compact ? 'max-[359px]:hidden' : ''}`}>E-CFunds</span>
    </span>
  );
}

export function GoogleButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="w-full h-12 rounded-[14px] border border-line bg-surface hover:bg-surface2 font-semibold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50">
      <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continue with Google
    </button>
  );
}

export function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-5 text-muted text-[13px]">
      <span className="h-px flex-1 bg-line" />{label}<span className="h-px flex-1 bg-line" />
    </div>
  );
}
