import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BellRing, X } from 'lucide-react';
import { isNative } from '../lib/native';
import { webPushOn, webPushResave, webPushState, type WebPushState } from '../lib/webpush';
import { Button } from './ui';

const ASKED = 'ecfunds:webpush-asked';

/** Website only: re-link an existing browser subscription after sign-in, and once (per browser) offer to turn on
 *  notifications. Browsers only allow the permission prompt after a tap, so this is a gentle card, not a pop-up. */
export function WebPushBanner({ uid }: { uid?: string }) {
  const [state, setState] = useState<WebPushState | null>(null);
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(ASKED); } catch { return true; } });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNative || !uid) return;
    void webPushResave();
    void webPushState().then(setState);
  }, [uid]);

  const dismiss = () => { try { localStorage.setItem(ASKED, '1'); } catch { /* ignore */ } setHidden(true); };
  if (isNative || !uid || hidden || (state !== 'off' && state !== 'install-first')) return null;

  return (
    <div className="mb-4 rounded-[16px] bg-primary-soft text-primary p-4 flex items-start gap-3" role="region" aria-label="Notifications">
      <BellRing className="size-5 shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0 text-[14px]">
        {state === 'install-first' ? (
          <p>Get notified on your iPhone: add E-CFunds to your Home Screen. <Link to="/account" onClick={dismiss} className="font-semibold underline">How</Link></p>
        ) : (
          <>
            <p className="font-semibold">Get notified even when E-CFunds is closed?</p>
            <p className="opacity-90">Payments, requests, messages and announcements.</p>
            <div className="flex gap-2 mt-3">
              <Button className="h-11 px-4 text-[14px]" busy={busy} onClick={async () => {
                setBusy(true);
                try { setState(await webPushOn()); } catch { /* My account shows details */ }
                setBusy(false); dismiss();
              }}>Turn on</Button>
              <Button variant="ghost" className="h-11 px-4 text-[14px]" onClick={dismiss}>Not now</Button>
            </div>
          </>
        )}
      </div>
      <button onClick={dismiss} aria-label="Close" className="size-11 -m-2 grid place-items-center rounded-full hover:bg-primary/10 cursor-pointer"><X className="size-5" /></button>
    </div>
  );
}
