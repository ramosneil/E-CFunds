import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { installUpdate, requestUpdateCheck, useUpdateReady } from '../lib/autoUpdate';

const TRIGGER = 64;   // px of (damped) pull needed to refresh

/** Phones (Android app + phone browsers): pull down at the top of a page to reload every number on screen and
 *  look for an app update. Not inside sheets/dialogs or text boxes. The browser's own pull-to-reload is turned off
 *  (index.css, overscroll-behavior) so the page doesn't reload twice. */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const updateWaiting = useUpdateReady();

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    let startY: number | null = null, cur = 0;
    const start = (e: TouchEvent) => {
      const t = e.target as Element | null;
      if (busyRef.current || window.scrollY > 0 || e.touches.length > 1
        || t?.closest('[role="dialog"], textarea, input, select, [data-no-pull]')) { startY = null; return; }
      startY = e.touches[0].clientY; cur = 0;
    };
    const move = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) { if (cur) { cur = 0; setPull(0); } return; }
      cur = Math.min(110, dy * 0.5);
      setPull(cur);
    };
    const end = async () => {
      if (startY === null) return;
      startY = null;
      if (cur >= TRIGGER) {
        busyRef.current = true; setBusy(true); setPull(TRIGGER);
        // A new version was waiting: switch to it now (the page reloads). If it somehow doesn't, clear the spinner.
        if (installUpdate()) { setTimeout(() => { busyRef.current = false; setBusy(false); setPull(0); }, 6000); return; }
        requestUpdateCheck();
        try { await qc.invalidateQueries(); } finally {
          await new Promise((r) => setTimeout(r, 350));   // let the spinner be seen
          busyRef.current = false; setBusy(false);
        }
      }
      cur = 0; setPull(0);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, [qc]);

  if (!pull && !busy) return null;
  const ready = pull >= TRIGGER || busy;
  return (
    <div role="status" aria-live="polite" className="fixed left-1/2 z-[70] pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top) + ${Math.max(8, pull - 8)}px)`, transform: 'translateX(-50%)', transition: pull ? 'none' : 'top 200ms' }}>
      <span className={`size-10 rounded-full grid place-items-center shadow-lg border border-line ${ready ? 'bg-primary text-on-primary' : 'bg-surface text-primary'}`}>
        <RefreshCw className={`size-5 ${busy ? 'animate-spin' : ''}`} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} aria-hidden />
      </span>
      <span className="sr-only">{busy ? (updateWaiting ? 'Updating' : 'Refreshing') : ready ? `Release to ${updateWaiting ? 'update' : 'refresh'}` : `Pull to ${updateWaiting ? 'update' : 'refresh'}`}</span>
    </div>
  );
}
