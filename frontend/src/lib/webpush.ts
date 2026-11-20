// Web Push — notifications on computers and on the iPhone Home Screen app, even when E-CFunds is closed.
// The browser's push subscription (JSON) is saved like a phone token (save_push_token, platform 'web'); the push
// Edge Function sends to it with our VAPID key. Signing out removes it (webPushOff), so a signed-out browser gets
// nothing. The Android app uses Firebase instead (src/lib/push.ts) — this file does nothing there.
import { isNative } from './native';
import { supabase } from './supabase';

/** Public half of the VAPID key pair (the private half lives only in the database, private.push_config). */
const VAPID_PUBLIC = 'BOdzFKSBkOVaSEdTmwcygMhXShYf82A0mWbtbL2uJWx31GrKV8dM6iQxZeOvNredvccX4bTED3RIETPetCUG6dM';

export type WebPushState = 'on' | 'off' | 'blocked' | 'install-first' | 'unsupported';

export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports as a Mac
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const key = () => Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function registration() {
  if (isNative || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/** Where this browser stands. iPhone/iPad Safari can only receive pushes from the Home Screen app. */
export async function webPushState(): Promise<WebPushState> {
  if (isNative) return 'unsupported';
  if (isIos() && !isStandalone()) return 'install-first';
  if (!('PushManager' in window) || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const { error } = await supabase.rpc('save_push_token', { p_token: JSON.stringify(sub.toJSON()), p_platform: 'web' });
  if (error) throw error;
}

/** Ask permission (must run from a tap) and subscribe this browser for the signed-in person. */
export async function webPushOn(): Promise<WebPushState> {
  const reg = await registration();
  if (!reg) return webPushState();
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
  await save(sub);
  return 'on';
}

/** Turn off on this browser (and on sign-out): forget it in the database, then unsubscribe. */
export async function webPushOff() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc('drop_push_token', { p_token: JSON.stringify(sub.toJSON()) });
  await sub.unsubscribe();
}

/** After sign-in: if this browser is already subscribed, (re)link it to whoever is signed in now. */
export async function webPushResave() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch (e) { console.warn('[webpush] resave', e); }
}
