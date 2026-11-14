import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isNative } from '../lib/native';
import { chime } from '../lib/chime';
import { toast } from '../lib/toast';
import { noteInBell, otaState } from '../lib/ota';
import { APK_URL } from './AndroidAppLink';

/** "You're offline" pill (all platforms) + update notices: website "Update available → Reload" and
 *  "E-CFunds was updated" after it reloads; Android app: "Update the app" when a new APK is required. */
export function AppStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { if (!isNative) webUpdatedNotice(); }, []);
  return (
    <>
      {!online && (
        <div role="status" className="fixed z-[60] left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+72px)] lg:top-[max(10px,env(safe-area-inset-top))] max-w-[calc(100vw-24px)] pointer-events-none
          bg-warn-soft text-warn border border-warn/30 shadow-lg rounded-full px-4 h-9 flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span className="truncate">You're offline<span className="hidden sm:inline"> — numbers need a connection</span></span>
        </div>
      )}
      {isNative ? <NeedsApk /> : <UpdatePrompt />}
    </>
  );
}

/** Website / installed web app: tell the person once that they are now on a newer version. */
function webUpdatedNotice() {
  try {
    const last = localStorage.getItem('ecfunds:build');
    localStorage.setItem('ecfunds:build', __BUILD_ID__);
    if (last && last !== __BUILD_ID__ && __BUILD_ID__ !== 'dev') {
      toast({ title: 'E-CFunds was updated', body: 'You have the newest version.', tone: 'ok' });
      void noteInBell();
    }
  } catch { /* private mode */ }
}

function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => { void reg.update(); }, 60 * 60 * 1000); }, // check hourly
  });
  useEffect(() => { if (needRefresh) chime(); }, [needRefresh]);
  if (!needRefresh) return null;
  return (
    <Card icon={<RefreshCw className="size-5" aria-hidden />} text={<><b>Update available.</b> Reload to get the newest E-CFunds.</>}>
      <button onClick={() => setNeedRefresh(false)} className="text-[13px] text-muted font-semibold px-2 h-9 cursor-pointer">Later</button>
      <button onClick={() => void updateServiceWorker(true)} className="h-9 px-4 rounded-[12px] bg-primary text-on-primary font-semibold text-[14px] cursor-pointer">Reload</button>
    </Card>
  );
}

/** Android app too old for the newest code (a new APK is needed — rare). */
function NeedsApk() {
  const needs = useSyncExternalStore(otaState.subscribe, otaState.needsApk);
  const [later, setLater] = useState(false);
  useEffect(() => { if (needs) chime(); }, [needs]);
  if (!needs || later) return null;
  return (
    <Card icon={<Download className="size-5" aria-hidden />} text={<><b>A new version of the app is ready.</b> Install it to keep getting updates.</>}>
      <button onClick={() => setLater(true)} className="text-[13px] text-muted font-semibold px-2 h-9 cursor-pointer">Later</button>
      <a href={APK_URL} className="h-9 px-4 rounded-[12px] bg-primary text-on-primary font-semibold text-[14px] inline-flex items-center">Update</a>
    </Card>
  );
}

function Card({ icon, text, children }: { icon: React.ReactNode; text: React.ReactNode; children: React.ReactNode }) {
  return (
    // .app-status-card: on Messages (body.chat-open, see index.css) it moves to the top so it never covers Send.
    <div role="alert" className="app-status-card fixed z-[60] left-4 right-4 sm:left-auto sm:right-6 bottom-[92px] lg:bottom-6 sm:w-[380px] bg-surface border border-line rounded-[18px] shadow-2xl p-4 flex items-center gap-3">
      <span className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">{icon}</span>
      <p className="flex-1 text-[14px]">{text}</p>
      {children}
    </div>
  );
}
