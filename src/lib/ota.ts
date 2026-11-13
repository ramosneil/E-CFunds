// Silent app-code updates for the Android app (self-hosted, @capgo/capacitor-updater in manual mode).
// 1. Tell the updater this code started fine (else it rolls back to the last good version by itself).
// 2. If the code changed since last time → "E-CFunds was updated" pop-up.
// 3. Online: read e-cfunds.vercel.app/ota/manifest.json. Newer code → download (sha256 checked) and switch to it
//    the next time the app is reopened (closed, or 5+ minutes in the background) — never in the middle of use.
//    If the installed app is too old for the new code (ota.json minNativeBuild) → "Update the app" banner.
import { LIVE_URL } from './native';
import { toast } from './toast';

const LAST = 'ecfunds:build';
type Manifest = { version: string; url: string; sha256: string; minNativeBuild: number };

let needsApk = false;
const subs = new Set<() => void>();
export const otaState = {
  needsApk: () => needsApk,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

export async function startOta() {
  const [{ CapacitorUpdater }, { App }] = await Promise.all([import('@capgo/capacitor-updater'), import('@capacitor/app')]);
  await CapacitorUpdater.notifyAppReady();

  let last: string | null = null;
  try { last = localStorage.getItem(LAST); localStorage.setItem(LAST, __BUILD_ID__); } catch { /* ignore */ }
  if (last && last !== __BUILD_ID__) {
    toast({ title: 'E-CFunds was updated', body: 'You have the newest version.', tone: 'ok' });
  }

  const check = async () => {
    if (!navigator.onLine) return;
    try {
      const r = await fetch(`${LIVE_URL}/ota/manifest.json`, { cache: 'no-store' });
      if (!r.ok) return;
      const m = (await r.json()) as Manifest;
      if (!m?.version || m.version === __BUILD_ID__) return;
      const build = Number((await App.getInfo()).build) || 0;
      if (m.minNativeBuild > build) { needsApk = true; subs.forEach((f) => f()); return; }
      const have = (await CapacitorUpdater.list()).bundles.find((b) => b.version === m.version && b.status === 'success');
      const bundle = have ?? await CapacitorUpdater.download({ url: m.url, version: m.version, checksum: m.sha256 });
      await CapacitorUpdater.next({ id: bundle.id });
      await CapacitorUpdater.setMultiDelay({ conditionMode: 'or', delayConditions: [{ kind: 'kill' }, { kind: 'background', value: '300000' }] });
    } catch (e) { console.warn('[ota]', e); }
  };
  await check();
  // Check again whenever the app comes back to the screen (at most every 30 minutes).
  let lastCheck = Date.now();
  await App.addListener('resume', () => { if (Date.now() - lastCheck > 30 * 60_000) { lastCheck = Date.now(); void check(); } });
}
