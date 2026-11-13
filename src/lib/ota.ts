// Silent app-code updates for the Android app (self-hosted, @capgo/capacitor-updater in manual mode).
// 1. Tell the updater this code started fine (else it rolls back to the last good version by itself).
// 2. If the code changed since last time → "E-CFunds was updated" pop-up (+ a note in the bell).
// 3. A newer version already downloaded? → switch to it right now, at app start (one quick reload, before anyone
//    can start typing). Also when the app returns after 5+ minutes in the background.
// 4. Online: read e-cfunds.vercel.app/ota/manifest.json; newer code → download in the background (sha256 checked)
//    and remember it for the next start. Too-old app for the new code (ota.json minNativeBuild) → "Update the app".
// Every step's result is kept (otaStatus) and shown in My account, with "Check for updates" / "Restart to update".
import { LIVE_URL } from './native';
import { toast } from './toast';

const LAST = 'ecfunds:build';
const READY = 'ecfunds:ota-ready';
const ANNOUNCED = 'ecfunds:ota-announced';
const STATUS = 'ecfunds:ota-status';
type Manifest = { version: string; url: string; sha256: string; minNativeBuild: number };
export type OtaStatus = { at: string; text: string; ok: boolean; ready?: string };

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)).slice(0, 160);

let needsApk = false;
let statusCache: OtaStatus | null | undefined;
const subs = new Set<() => void>();
const emit = () => { statusCache = undefined; subs.forEach((f) => f()); };
export const otaState = {
  needsApk: () => needsApk,
  status: (): OtaStatus | null => {
    if (statusCache === undefined) { try { statusCache = JSON.parse(get(STATUS) ?? 'null'); } catch { statusCache = null; } }
    return statusCache ?? null;
  },
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};
const setStatus = (text: string, ok: boolean) => {
  let ready: string | undefined;
  try { ready = get(READY) ? (JSON.parse(get(READY)!) as { version: string }).version : undefined; } catch { /* ignore */ }
  put(STATUS, JSON.stringify({ at: new Date().toISOString(), text, ok, ready } satisfies OtaStatus));
  emit();
};

const plugins = () => Promise.all([import('@capgo/capacitor-updater'), import('@capacitor/app')])
  .then(([u, a]) => ({ Updater: u.CapacitorUpdater, App: a.App }));

/** Keep "E-CFunds was updated" in the bell too (signed-in people only; once per version). */
export async function noteInBell() {
  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.rpc('note_app_updated', { p_build: __BUILD_ID__ });
  } catch { /* not important */ }
}

/** Switch to a version downloaded earlier (one quick reload). Returns false if there's nothing to apply. */
export async function applyReady(): Promise<boolean> {
  const raw = get(READY);
  if (!raw) return false;
  try {
    const { id, version } = JSON.parse(raw) as { id: string; version: string };
    put(READY, null);
    if (version === __BUILD_ID__) return false;
    const { Updater } = await plugins();
    const ok = (await Updater.list()).bundles.some((b) => b.id === id && b.status === 'success');
    if (!ok) { setStatus('The downloaded update was not usable — it will download again.', false); return false; }
    await Updater.set({ id });        // reloads the app into the new code
    return true;
  } catch (e) { setStatus(`Could not switch to the update: ${msg(e)}`, false); return false; }
}

/** Look for a newer version and download it. Safe to call any time (also from My account). */
export async function checkForUpdate(): Promise<OtaStatus | null> {
  if (!navigator.onLine) { setStatus('Offline — will check when you are online.', false); return otaState.status(); }
  try {
    const { Updater, App } = await plugins();
    const r = await fetch(`${LIVE_URL}/ota/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`update list answered ${r.status}`);
    const m = (await r.json()) as Manifest;
    if (!m?.version) throw new Error('update list is empty');
    if (m.version === __BUILD_ID__) { put(READY, null); setStatus('You have the newest version.', true); return otaState.status(); }
    const build = Number((await App.getInfo()).build) || 0;
    if (m.minNativeBuild > build) { needsApk = true; setStatus('A new app (APK) is needed for this update.', false); return otaState.status(); }
    setStatus('Downloading the newest version…', true);
    const have = (await Updater.list()).bundles.find((b) => b.version === m.version && b.status === 'success');
    const bundle = have ?? await Updater.download({ url: m.url, version: m.version, checksum: m.sha256 });
    put(READY, JSON.stringify({ id: bundle.id, version: m.version }));
    setStatus('Update downloaded — it applies the next time you open E-CFunds.', true);
    if (get(ANNOUNCED) !== m.version) {
      put(ANNOUNCED, m.version);
      toast({ title: 'An update is ready', body: 'It applies the next time you open E-CFunds.', tone: 'info' });
    }
  } catch (e) {
    setStatus(`Update check failed: ${msg(e)}`, false);
    console.warn('[ota]', e);
  }
  return otaState.status();
}

export async function startOta() {
  const { Updater, App } = await plugins();
  await Updater.notifyAppReady();

  const last = get(LAST);
  put(LAST, __BUILD_ID__);
  if (last && last !== __BUILD_ID__) {
    toast({ title: 'E-CFunds was updated', body: 'You have the newest version.', tone: 'ok' });
    void noteInBell();
  }

  if (await applyReady()) return;
  void checkForUpdate();

  // Back after 5+ minutes away: apply a ready update, otherwise look for one (at most every 30 minutes).
  let pausedAt = 0, lastCheck = Date.now();
  await App.addListener('pause', () => { pausedAt = Date.now(); });
  await App.addListener('resume', () => {
    const away = pausedAt ? Date.now() - pausedAt : 0;
    if (away > 5 * 60_000) void applyReady().then((applied) => { if (!applied) void checkForUpdate(); });
    else if (Date.now() - lastCheck > 30 * 60_000) { lastCheck = Date.now(); void checkForUpdate(); }
  });
}
