import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { isNative } from '../lib/native';
import { toast } from '../lib/toast';

// Security (Neil, 2026-11-15): when nobody has used E-CFunds for 5 minutes (Home button, another app, tab in the
// background, phone closed the app), the person is signed out when they come back. Notifications keep arriving.
//
// How: every VISIBLE E-CFunds screen writes "last active" (localStorage, shared by all tabs) every 20 s and when it is
// hidden. When a screen becomes visible (or the app starts), it compares now with that time. A background tab never
// writes, so it can't sign out someone who is using another tab (bug found live: a per-tab "away since" did that).
export const AWAY_LIMIT_MS = 5 * 60_000;
const KEY = 'ecfunds:last-active';
const OLD_KEY = 'ecfunds:away-since';
const get = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
const clear = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch { /* private mode */ } };

export function AutoLogout() {
  const { session, signOut } = useAuth();
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) { clear(); return; }
    const visible = () => document.visibilityState === 'visible';
    const check = () => {
      const last = get();
      if (last && Date.now() - last >= AWAY_LIMIT_MS) {
        clear();
        void signOut().then(() => toast({ title: 'Signed out for your security', body: 'E-CFunds wasn’t used for 5 minutes. Sign in again to continue.', tone: 'info', silent: true }));
        return false;
      }
      return true;
    };
    if (check() && visible()) mark();          // app start / sign-in
    const beat = setInterval(() => { if (visible()) mark(); }, 20_000);
    const onVis = () => { if (visible()) { if (check()) mark(); } else mark(); };
    document.addEventListener('visibilitychange', onVis);
    let remove: (() => void) | undefined;
    if (isNative) {
      void import('@capacitor/app').then(async ({ App }) => {
        const p = await App.addListener('pause', mark);
        const r = await App.addListener('resume', () => { if (check()) mark(); });
        remove = () => { void p.remove(); void r.remove(); };
      });
    }
    return () => { clearInterval(beat); document.removeEventListener('visibilitychange', onVis); remove?.(); };
  }, [signedIn, signOut]);
  return null;
}
