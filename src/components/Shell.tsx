import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BadgeCheck, Building2, CalendarRange, CheckCheck, Ellipsis, Home, LogOut, MessagesSquare, Receipt, Users, BarChart3, UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCurrentYear, useEntities } from '../lib/data';
import { useMessagesRealtime, useUnread } from '../lib/messages';
import { Brand } from '../pages/auth/AuthLayout';
import { EntityLogo, Sheet, ThemeToggle } from './ui';

// phone: false = desktop sidebar only (on phones these live in the admin "More" menu).
type Item = { to: string; label: string; icon: ComponentType<{ className?: string }>; phone?: false; badge?: 'messages' };
const NAV: Record<string, Item[]> = {
  admin: [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/approvals', label: 'Approvals', icon: CheckCheck },
    { to: '/orgs', label: 'Orgs & clubs', icon: Building2 },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
    { to: '/accredited', label: 'Accredited', icon: BadgeCheck, phone: false },
    { to: '/calendar', label: 'School year', icon: CalendarRange, phone: false },
  ],
  treasurer: [
    { to: '/', label: 'Home', icon: Home },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/requests', label: 'Requests', icon: Receipt },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ],
  student: [
    { to: '/', label: 'Home', icon: Home },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ],
};

function Badge({ n, className = '' }: { n: number; className?: string }) {
  if (!n) return null;
  return <span className={`min-w-5 h-5 px-1.5 rounded-full bg-bad text-white text-[11px] font-bold grid place-items-center ${className}`} aria-label={`${n} unread`}>{n > 99 ? '99+' : n}</span>;
}

export function Shell() {
  const { profile, signOut, session } = useAuth();
  const year = useCurrentYear();
  const entities = useEntities();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  useMessagesRealtime();
  const unread = useUnread();
  const role = profile?.role ?? 'student';
  const items = NAV[role];
  const phoneItems = items.filter((i) => i.phone !== false);
  const moreItems = items.filter((i) => i.phone === false);
  const moreActive = moreItems.some((i) => loc.pathname.startsWith(i.to)) || loc.pathname === '/account';
  const chat = loc.pathname.startsWith('/messages');
  const org = role === 'treasurer' ? entities.data?.find((e) => e.id === profile?.entity_id) : undefined;
  const roleLabel = role === 'admin' ? 'SAS Admin' : role === 'treasurer' ? `Treasurer · ${org?.short_name ?? ''}` : 'Student';
  const count = (it: Item) => (it.badge === 'messages' ? unread.total : 0);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh border-r border-line bg-surface px-4 py-5">
        <div className="px-2"><Brand /></div>
        <nav className="mt-8 space-y-1" aria-label="Main">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'}
              className={({ isActive }) => `flex items-center gap-3 h-11 px-3 rounded-[14px] font-semibold transition ${isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2 hover:text-ink'}`}>
              <it.icon className="size-5" /><span className="flex-1">{it.label}</span><Badge n={count(it)} />
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <NavLink to="/account" title="My account"
            className={({ isActive }) => `rounded-[16px] p-3 flex items-center gap-3 transition ${isActive ? 'bg-primary-soft' : 'bg-surface2 hover:brightness-95'}`}>
            {org ? <EntityLogo path={org.logo_path} name={org.name} size={36} /> : <span className="size-9 rounded-full bg-primary text-on-primary grid place-items-center font-bold">{(profile?.full_name || session?.user.email || '?')[0].toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="font-semibold text-[14px] truncate">{profile?.full_name || session?.user.email}</p>
              <p className="text-[12px] text-muted truncate">{roleLabel} · My account</p>
            </div>
          </NavLink>
          <div className="flex items-center justify-between mt-2">
            <button onClick={signOut} className="flex items-center gap-2 h-11 px-3 rounded-[14px] text-muted hover:text-ink hover:bg-surface2 font-semibold cursor-pointer"><LogOut className="size-5" />Sign out</button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur border-b border-line px-5 h-16 flex items-center justify-between">
          <Brand />
          <div className="flex items-center">
            <ThemeToggle />
            <NavLink to="/account" aria-label="My account" className="size-11 grid place-items-center rounded-full text-muted hover:bg-surface2"><UserRound className="size-5" /></NavLink>
            <button onClick={signOut} aria-label="Sign out" className="size-11 grid place-items-center rounded-full text-muted hover:bg-surface2 cursor-pointer"><LogOut className="size-5" /></button>
          </div>
        </header>
        <div className="hidden lg:flex items-center justify-end h-14 px-8 text-[13px] text-muted">
          {year.data ? <>School year <b className="text-ink ml-1">{year.data.label}</b></> : 'No school year open'}
        </div>
        <main className={`flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 lg:pt-0 lg:pb-12 ${chat ? 'pb-[92px]' : 'pb-28'}`}>
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line h-[76px] pb-[env(safe-area-inset-bottom)] flex justify-around items-center px-2">
        {phoneItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold">
            {({ isActive }) => (<>
              <span className={`relative h-8 w-14 rounded-full grid place-items-center transition ${isActive ? 'bg-primary-soft text-primary' : 'text-muted'}`}>
                <it.icon className="size-5" /><Badge n={count(it)} className="absolute -top-1 right-1" />
              </span>
              <span className={isActive ? 'text-primary' : 'text-muted'}>{it.label}</span>
            </>)}
          </NavLink>
        ))}
        {moreItems.length > 0 && (
          <button onClick={() => setMore(true)} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold cursor-pointer" aria-haspopup="dialog">
            <span className={`h-8 w-14 rounded-full grid place-items-center transition ${moreActive ? 'bg-primary-soft text-primary' : 'text-muted'}`}><Ellipsis className="size-5" /></span>
            <span className={moreActive ? 'text-primary' : 'text-muted'}>More</span>
          </button>
        )}
      </nav>
      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <nav className="space-y-1" aria-label="More">
          {[...moreItems, { to: '/account', label: 'My account', icon: UserRound } as Item].map((it) => (
            <NavLink key={it.to} to={it.to} onClick={() => setMore(false)}
              className={({ isActive }) => `flex items-center gap-3 h-14 px-4 rounded-[16px] font-semibold ${isActive ? 'bg-primary-soft text-primary' : 'hover:bg-surface2'}`}>
              <it.icon className="size-5" />{it.label}
            </NavLink>
          ))}
        </nav>
      </Sheet>
    </div>
  );
}
