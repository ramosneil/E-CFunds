import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { isNative } from '../lib/native';
import { useAuth } from '../lib/auth';
import { confirmAsk } from '../lib/confirm';

/** Android Back button (app only):
 *  1. a sheet, panel, chat or menu is open → close it;
 *  2. on an inner screen → go back (or to Home if there's nothing to go back to);
 *  3. on Home, signed in → ask "Log out of E-CFunds?" (Log out / Stay) — Neil, 2026-11-15, for security;
 *     signed out → leave the app to the phone's home screen. */
export function NativeBack() {
  const nav = useNavigate();
  const { session, signOut } = useAuth();
  // The listener is added ONCE and reads the latest state from refs. (Before: it was re-added on every sign-in
  // change, asynchronously, so a copy from before the session loaded — "signed out" — leaked and minimized the app
  // at the same moment the "Log out?" question opened; Neil saw the question only when he came back.)
  const live = useRef({ signedIn: !!session, signOut, nav });
  live.current = { signedIn: !!session, signOut, nav };
  useEffect(() => {
    if (!isNative) return;
    void import('../lib/push').then((m) => m.listenPush());   // pushes reach the phone's shade even while the app is open
    let gone = false;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      if (gone) return;
      const h = await App.addListener('backButton', () => {
        const { signedIn, signOut, nav } = live.current;
        if (document.querySelector('[role="dialog"]')) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        if (window.location.pathname !== '/') {
          const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
          if (idx > 0) nav(-1); else nav('/', { replace: true });
          return;
        }
        if (!signedIn) { void App.minimizeApp(); return; }
        void confirmAsk({ title: 'Log out of E-CFunds?', body: 'You will need to sign in again next time. Notifications still come to this phone.',
          confirm: 'Log out', cancel: 'Stay', tone: 'bad' }).then((yes) => { if (yes) void signOut(); });
      });
      if (gone) { void h.remove(); return; }
      remove = () => { void h.remove(); };
    });
    const open = (e: Event) => live.current.nav(String((e as CustomEvent).detail || '/'));
    window.addEventListener('ecfunds:open', open);
    return () => { gone = true; remove?.(); window.removeEventListener('ecfunds:open', open); };
  }, []);
  return null;
}
