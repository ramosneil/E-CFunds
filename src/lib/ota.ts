// Silent app-code updates for the Android app (self-hosted, @capgo/capacitor-updater in manual mode).
// 1. Tell the updater this code started fine (else it rolls back to the last good version by itself).
// 2. If the code changed since last time → "E-CFunds was updated" pop-up.
// 3. A newer version already downloaded? → switch to it right now, at app start (one quick reload, before anyone
//    can start typing). Also when the app returns after 5+ minutes in the background.
// 4. Online: read e-cfunds.vercel.app/ota/manifest.json; newer code → download in the background (sha256 checked)
//    and remember it for the next start. Too-old app for the new code (ota.json minNativeBuild) → "Update the app".
import { LIVE_URL } from './native';
import { toast } from './toast';

const LAST = 'ecfunds:build';
const READY = 'ecfunds:ota-ready';
const ANNOUNCED = 'ecfunds:ota-announced';

/** Keep "E-CFunds was updated" in the bell too (signed-in people only; once per version). */
export async function noteInBell() {
  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.rpc('note_app_updated', { p_build: __BUILD_ID__ });
  } catch { /* not important */ }
}
type Manifest = { version: string; url: string; sha256: string; minNativeBuild: number };

let needsApk = false;
const subs = new Set<() => void>();
export const otaState = {
  needsApk: () => needsApk,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

export async function startOta() {
  const [{ CapacitorUpdater }, { App }] = await Promise.all([import('@capgo/capacitor-updater'), import('@capacitor/app')]);
  await CapacitorUpdater.notifyAppReady();

  const last = get(LAST);
  put(LAST, __BUILD_ID__);
  if (last && last !== __BUILD_ID__) {
    toast({ title: 'E-CFunds was updated', body: 'You have the newest version.', tone: 'ok' });
    void noteInBell();
  }

  // Apply a version downloaded earlier (stored as {id, version}).
  const applyReady = async () => {
    const raw = get(READY);
    if (!raw) return false;
    put(READY, null);
    try {
      const { id, version } = JSON.parse(raw) as { id: string; version: string };
      if (version === __BUILD_ID__) return false;
      const ok = (await CapacitorUpdater.list()).bundles.some((b) => b.id === id && b.status === 'success');
      if (!ok) return false;
      await CapacitorUpdater.set({ id });        // reloads the app into the new code
      return true;
    } catch (e) { console.warn('[ota] apply', e); return false; }
  };
  if (await applyReady()) return;

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
      put(READY, JSON.stringify({ id: bundle.id, version: m.version }));
      if (get(ANNOUNCED) !== m.version) {
        put(ANNOUNCED, m.version);
        toast({ title: 'An update is ready', body: 'It applies the next time you open E-CFunds.', tone: 'info' });
      }
    } catch (e) { console.warn('[ota] check', e); }
  };
  void check();

  // Back after 5+ minutes away: apply a ready update, otherwise look for one (at most every 30 minutes).
  let pausedAt = 0, lastCheck = Date.now();
  await App.addListener('pause', () => { pausedAt = Date.now(); });
  await App.addListener('resume', () => {
    const away = pausedAt ? Date.now() - pausedAt : 0;
    if (away > 5 * 60_000) void applyReady().then((applied) => { if (!applied) void check(); });
    else if (Date.now() - lastCheck > 30 * 60_000) { lastCheck = Date.now(); void check(); }
  });
}
