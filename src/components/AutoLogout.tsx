import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { isNative } from '../lib/native';
import { toast } from '../lib/toast';

// Security (Neil, 2026-11-15): leaving E-CFunds (Home button, another app, another browser tab) for 5 minutes signs the
// person out; they sign in again when they come back. Phone notifications keep arriving (sign-out keeps the device).
export const AWAY_LIMIT_MS = 5 * 60_000;
const KEY = 'ecfunds:away-since';
const get = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
const set = (v: number | null) => { try { if (v) localStorage.setItem(KEY, String(v)); else localStorage.removeItem(KEY); } catch { /* private mode */ } };

export function AutoLogout() {
  const { session, signOut } = useAuth();
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) { set(null); return; }
    const leave = () => { if (!get()) set(Date.now()); };
    const back = () => {
      const since = get();
      set(null);
      if (since && Date.now() - since >= AWAY_LIMIT_MS) {
        void signOut().then(() => toast({ title: 'Signed out for your security', body: 'You were away for 5 minutes or more. Sign in again to continue.', tone: 'info', silent: true }));
      }
    };
    back();   // cold start (e.g. the phone closed the app while away): check the time left behind
    const onVis = () => (document.visibilityState === 'hidden' ? leave() : back());
    document.addEventListener('visibilitychange', onVis);
    let remove: (() => void) | undefined;
    if (isNative) {
      void import('@capacitor/app').then(async ({ App }) => {
        const p = await App.addListener('pause', leave);
        const r = await App.addListener('resume', back);
        remove = () => { void p.remove(); void r.remove(); };
      });
    }
    return () => { document.removeEventListener('visibilitychange', onVis); remove?.(); };
  }, [signedIn, signOut]);
  return null;
}
