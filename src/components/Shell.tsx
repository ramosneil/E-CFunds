import type { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router';
import { BadgeCheck, Building2, CalendarRange, CheckCheck, Home, LogOut, Receipt, Users, BarChart3 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCurrentYear, useEntities } from '../lib/data';
import { Brand } from '../pages/auth/AuthLayout';
import { EntityLogo, ThemeToggle } from './ui';

type Item = { to: string; label: string; icon: ComponentType<{ className?: string }> };
const NAV: Record<string, Item[]> = {
  admin: [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/approvals', label: 'Approvals', icon: CheckCheck },
    { to: '/orgs', label: 'Orgs & clubs', icon: Building2 },
    { to: '/accredited', label: 'Accredited', icon: BadgeCheck },
    { to: '/calendar', label: 'School year', icon: CalendarRange },
  ],
  treasurer: [
    { to: '/', label: 'Home', icon: Home },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/requests', label: 'Requests', icon: Receipt },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ],
  student: [
    { to: '/', label: 'Home', icon: Home },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ],
};

export function Shell() {
  const { profile, signOut, session } = useAuth();
  const year = useCurrentYear();
  const entities = useEntities();
  const role = profile?.role ?? 'student';
  const items = NAV[role];
  const org = role === 'treasurer' ? entities.data?.find((e) => e.id === profile?.entity_id) : undefined;
  const roleLabel = role === 'admin' ? 'SAS Admin' : role === 'treasurer' ? `Treasurer · ${org?.short_name ?? ''}` : 'Student';

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh border-r border-line bg-surface px-4 py-5">
        <div className="px-2"><Brand /></div>
        <nav className="mt-8 space-y-1" aria-label="Main">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/'}
              className={({ isActive }) => `flex items-center gap-3 h-11 px-3 rounded-[14px] font-semibold transition ${isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2 hover:text-ink'}`}>
              <it.icon className="size-5" />{it.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="rounded-[16px] bg-surface2 p-3 flex items-center gap-3">
            {org ? <EntityLogo path={org.logo_path} name={org.name} size={36} /> : <span className="size-9 rounded-full bg-primary text-on-primary grid place-items-center font-bold">{(profile?.full_name || session?.user.email || '?')[0].toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="font-semibold text-[14px] truncate">{profile?.full_name || session?.user.email}</p>
              <p className="text-[12px] text-muted truncate">{roleLabel}</p>
            </div>
          </div>
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
            <button onClick={signOut} aria-label="Sign out" className="size-11 grid place-items-center rounded-full text-muted hover:bg-surface2 cursor-pointer"><LogOut className="size-5" /></button>
          </div>
        </header>
        <div className="hidden lg:flex items-center justify-end h-14 px-8 text-[13px] text-muted">
          {year.data ? <>School year <b className="text-ink ml-1">{year.data.label}</b></> : 'No school year open'}
        </div>
        <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 lg:pt-0 pb-28 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line h-[76px] pb-[env(safe-area-inset-bottom)] flex justify-around items-center px-2">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold">
            {({ isActive }) => (<>
              <span className={`h-8 w-14 rounded-full grid place-items-center transition ${isActive ? 'bg-primary-soft text-primary' : 'text-muted'}`}><it.icon className="size-5" /></span>
              <span className={isActive ? 'text-primary' : 'text-muted'}>{it.label}</span>
            </>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
