import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isNative } from '../lib/native';

/** "You're offline" bar (all platforms) + "Update available" prompt (installed web app only). */
export function AppStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return (
    <>
      {!online && (
        <div role="status" className="fixed z-[60] left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+72px)] lg:top-[max(10px,env(safe-area-inset-top))] max-w-[calc(100vw-24px)] pointer-events-none
          bg-warn-soft text-warn border border-warn/30 shadow-lg rounded-full px-4 h-9 flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span className="truncate">You're offline<span className="hidden sm:inline"> — numbers need a connection</span></span>
        </div>
      )}
      {!isNative && <UpdatePrompt />}
    </>
  );
}

function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => { void reg.update(); }, 60 * 60 * 1000); }, // check hourly
  });
  if (!needRefresh) return null;
  return (
    <div role="alert" className="fixed z-[60] left-4 right-4 sm:left-auto sm:right-6 bottom-[92px] lg:bottom-6 sm:w-[360px] bg-surface border border-line rounded-[18px] shadow-2xl p-4 flex items-center gap-3">
      <span className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0"><RefreshCw className="size-5" aria-hidden /></span>
      <p className="flex-1 text-[14px]"><b>Update available.</b> Reload to get the newest E-CFunds.</p>
      <button onClick={() => setNeedRefresh(false)} className="text-[13px] text-muted font-semibold px-2 h-9 cursor-pointer">Later</button>
      <button onClick={() => void updateServiceWorker(true)} className="h-9 px-4 rounded-[12px] bg-primary text-on-primary font-semibold text-[14px] cursor-pointer">Reload</button>
    </div>
  );
}
