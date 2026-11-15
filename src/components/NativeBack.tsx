import { useEffect } from 'react';
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
  const signedIn = !!session;
  useEffect(() => {
    if (!isNative) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const h = await App.addListener('backButton', () => {
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
      remove = () => { void h.remove(); };
    });
    const open = (e: Event) => nav(String((e as CustomEvent).detail || '/'));
    window.addEventListener('ecfunds:open', open);
    return () => { remove?.(); window.removeEventListener('ecfunds:open', open); };
  }, [nav, signedIn, signOut]);
  return null;
}
