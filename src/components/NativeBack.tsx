import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { isNative } from '../lib/native';

/** Android Back button (app only):
 *  1. a sheet, panel, chat or menu is open → close it;
 *  2. on an inner screen → go back (or to Home if there's nothing to go back to);
 *  3. on Home → leave the app to the phone's home screen (the app stays signed in, ready to reopen). */
export function NativeBack() {
  const nav = useNavigate();
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
        void App.minimizeApp();
      });
      remove = () => { void h.remove(); };
    });
    return () => remove?.();
  }, [nav]);
  return null;
}
