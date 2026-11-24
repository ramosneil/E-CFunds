import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BadgeCheck, Building2, CalendarRange, CheckCheck, Ellipsis, GraduationCap, History, Home, LogOut, MessagesSquare, Receipt, Users, BarChart3, UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCurrentYear, useEntities } from '../lib/data';
import { useMessagesRealtime, useUnread } from '../lib/messages';
import { Brand } from '../pages/auth/AuthLayout';
import { EntityLogo, Loading, Sheet, ThemeToggle } from './ui';
import { AskTopButton, ChatButton } from './ChatButton';
import { WebPushBanner } from './WebPushBanner';
import { PullToRefresh } from './PullToRefresh';
import { NotificationBell } from './NotificationBell';
import { useLiveNotifications } from '../lib/notifications';
import { useLiveScreens } from '../lib/live';
import { isNative } from '../lib/native';
import { askNotifyOnce, clearPhoneNotifications } from '../lib/phone';
import { registerPush } from '../lib/push';
import { askSignOut } from '../lib/confirm';

// phone: false = desktop sidebar only (on phones these live in the admin "More" menu).
type Item = { to: string; label: string; icon: ComponentType<{ className?: string }>; phone?: false; badge?: 'messages' };
const NAV: Record<string, Item[]> = {
  admin: [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/approvals', label: 'Approvals', icon: CheckCheck },
    { to: '/orgs', label: 'Orgs & clubs', icon: Building2 },
    { to: '/messages', label: 'Messages', icon: MessagesSquare, badge: 'messages' },
    { to: '/students', label: 'Students', icon: GraduationCap, phone: false },
    { to: '/accredited', label: 'Accredited', icon: BadgeCheck, phone: false },
    { to: '/calendar', label: 'School year', icon: CalendarRange, phone: false },
    { to: '/activity', label: 'Activity log', icon: History, phone: false },
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
  const uid = session?.user.id;
  useLiveNotifications(uid);
  useLiveScreens(profile?.status === 'approved' ? uid : undefined);
  useEffect(() => {
    if (!isNative) return;
    if (uid) { void registerPush().then(() => askNotifyOnce()); return () => { void clearPhoneNotifications(); }; }
  }, [uid]);
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
      {/* Desktop sidebar: navy gradient (navy-and-gold look, 2026-11-24). */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh lux-side text-white px-4 py-5 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 lux-grid pointer-events-none opacity-60" />
        <div className="relative px-2"><Brand light /></div>
        <p className="relative px-2 mt-2 text-[11.5px] text-hero-muted">OMSC Mamburao · SAS</p>
        <nav className="relative mt-7 space-y-1" aria-label="Main">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'}
              className={({ isActive }) => `relative flex items-center gap-3 h-11 px-3 rounded-[14px] font-semibold transition ${isActive ? 'bg-white/12 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)]' : 'text-hero-muted hover:bg-white/[0.07] hover:text-white'}`}>
              {({ isActive }) => (<>
                {isActive && <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full bg-pocket-cash" />}
                <it.icon className={`size-5 ${isActive ? 'text-pocket-cash' : ''}`} /><span className="flex-1">{it.label}</span><Badge n={count(it)} />
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="relative mt-auto">
          <NavLink to="/account" title="My account"
            className={({ isActive }) => `rounded-[16px] p-3 flex items-center gap-3 transition border ${isActive ? 'bg-white/14 border-white/20' : 'bg-white/[0.07] border-white/10 hover:bg-white/12'}`}>
            {org ? <EntityLogo path={org.logo_path} name={org.name} size={36} /> : <span className="size-9 rounded-full lux-gold-btn grid place-items-center font-bold">{(profile?.full_name || session?.user.email || '?')[0].toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="font-semibold text-[14px] truncate">{profile?.full_name || session?.user.email}</p>
              <p className="text-[12px] text-hero-muted truncate">{roleLabel} · My account</p>
            </div>
          </NavLink>
          <div className="flex items-center justify-between mt-2">
            <button onClick={() => void askSignOut(signOut)} className="flex items-center gap-2 h-11 px-3 rounded-[14px] text-hero-muted hover:text-white hover:bg-white/10 font-semibold cursor-pointer"><LogOut className="size-5" />Sign out</button>
            <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 lux-side text-white shadow-[0_8px_24px_-16px_rgb(10_23_71/.8)] px-5 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))] flex items-center justify-between lux-topbar">
          <Brand compact light />
          <div className="flex items-center">
            <AskTopButton />
            {uid && <NotificationBell uid={uid} />}
            <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
            <NavLink to="/account" aria-label="My account and sign out" className="size-11 grid place-items-center rounded-full text-hero-muted hover:bg-white/10"><UserRound className="size-5" /></NavLink>
          </div>
        </header>
        <div className="hidden lg:flex items-center justify-end gap-3 h-16 px-8 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 lux-card">
            <i className="size-1.5 rounded-full bg-pocket-cash" aria-hidden />
            {year.data ? <>School year <b className="text-ink">{year.data.label}</b></> : 'No school year open'}
          </span>
          {uid && <NotificationBell uid={uid} />}
        </div>
        {/* Bottom padding = bottom menu (76 px + the iPhone home-bar area) + breathing room. */}
        <main className={`flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 lg:pt-0 ${chat ? 'pb-[calc(92px+env(safe-area-inset-bottom))] lg:pb-12' : 'pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-28'}`}>
          {!chat && <WebPushBanner uid={profile?.status === 'approved' ? uid : undefined} />}
          <PullToRefresh />
          <Suspense fallback={<Loading />}><Outlet /></Suspense>
        </main>
      </div>

      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line shadow-[0_-10px_30px_-20px_rgb(10_23_71/.35)] h-[calc(76px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex justify-around items-center px-2">
        {phoneItems.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold">
            {({ isActive }) => (<>
              <span className={`relative h-8 w-14 rounded-full grid place-items-center transition ${isActive ? 'lux-primary' : 'text-muted'}`}>
                <it.icon className="size-5" /><Badge n={count(it)} className="absolute -top-1 right-1" />
              </span>
              <span className={isActive ? 'text-primary' : 'text-muted'}>{it.label}</span>
            </>)}
          </NavLink>
        ))}
        {moreItems.length > 0 && (
          <button onClick={() => setMore(true)} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold cursor-pointer" aria-haspopup="dialog">
            <span className={`h-8 w-14 rounded-full grid place-items-center transition ${moreActive ? 'lux-primary' : 'text-muted'}`}><Ellipsis className="size-5" /></span>
            <span className={moreActive ? 'text-primary' : 'text-muted'}>More</span>
          </button>
        )}
      </nav>
      <ChatButton />
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
