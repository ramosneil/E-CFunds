import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '../../components/ui';

export function AuthLayout({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-hero text-white p-12 relative overflow-hidden">
        <div aria-hidden className="absolute -right-24 -bottom-24 size-[28rem] rounded-full bg-white/5" />
        <div aria-hidden className="absolute right-24 top-20 size-40 rounded-full bg-pocket-cash/15" />
        <Brand light />
        <div className="relative max-w-md">
          <p className="font-display font-extrabold text-[40px] leading-[1.1]">Every peso of every club, out in the open.</p>
          <p className="text-hero-muted mt-4 text-[16px]">Dues, remittances, releases and expenses for OMSC student organizations, with one ledger nobody can quietly edit.</p>
          <div className="mt-8 flex gap-3 text-[13px]">
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-pocket-cash" />Cash on hand</span>
            <span className="flex items-center gap-2"><i className="size-2.5 rounded-full bg-pocket-saved" />Saved with SAS</span>
          </div>
        </div>
        <p className="text-hero-muted text-[13px]">Office of Student Affairs and Services</p>
      </aside>
      <main className="flex flex-col px-5 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden"><Brand /></span>
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-[400px]">
            <h1 className="font-display text-[28px] font-extrabold leading-tight">{title}</h1>
            {sub && <p className="text-muted mt-1.5">{sub}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
        <p className="text-center text-[12.5px] text-muted"><Link to="/privacy" className="hover:text-ink underline-offset-2 hover:underline">Privacy notice</Link></p>
      </main>
    </div>
  );
}

export function Brand({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 relative">
      <span className={`size-9 rounded-xl grid place-items-center font-display font-extrabold ${light ? 'bg-white text-hero' : 'bg-primary text-on-primary'}`}>₱</span>
      <span className="font-display font-extrabold text-[18px] tracking-tight">E-CFunds</span>
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
