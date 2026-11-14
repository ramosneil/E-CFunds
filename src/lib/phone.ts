// Android app only: full screen (status bar hidden) + notifications in the phone's own notification shade.
// Notifications come from the same live rows as the bell (src/lib/notifications.ts). While E-CFunds is on screen the
// in-app pop-up shows instead, so nothing doubles. (When the app is closed, push notifications — Part D — take over.)
import { Capacitor, SystemBars, SystemBarType } from '@capacitor/core';
import { isNative } from './native';

const CHANNEL = 'ecfunds';
const ASKED = 'ecfunds:notify-asked';
let ready: Promise<typeof import('@capacitor/local-notifications')['LocalNotifications'] | null> | null = null;

/** Hide the phone's status bar (time, Wi-Fi, battery). Swiping down from the top shows it for a moment. */
export async function fullScreen() {
  if (!isNative) return;
  try { await SystemBars.hide({ bar: SystemBarType.StatusBar }); } catch (e) { console.warn('[phone] hide bar', e); }
}

/** Set up the notification channel + tap handling once. Returns the plugin, or null on the web. */
function plugin() {
  if (!isNative || !Capacitor.isPluginAvailable('LocalNotifications')) return Promise.resolve(null);
  ready ??= import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL, name: 'E-CFunds', description: 'Payments, requests, messages and announcements',
        importance: 4, visibility: 1, vibration: true, lights: true, lightColor: '#2447C4',
      });
    } catch { /* channel exists */ }
    await LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
      const link = (a.notification.extra as { link?: string } | undefined)?.link;
      if (link) window.dispatchEvent(new CustomEvent('ecfunds:open', { detail: link }));
    });
    return LocalNotifications;
  });
  return ready;
}

export type PhonePermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

const map = (s: string | undefined): PhonePermission => (s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt');
/** Give up on a plugin call that never answers (seen on Neil's phone, 2026-11-14: the card silently disappeared). */
const within = <T,>(p: Promise<T>, ms = 3000) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);

/** Android's "show notifications" permission: local-notifications plugin first, else the push plugin (same
 *  Android permission), so the My account card always has an answer. */
export async function notifyPermission(): Promise<PhonePermission> {
  if (!isNative) return 'unavailable';
  try {
    const p = await within(plugin());
    if (p) return map((await within(p.checkPermissions())).display);
  } catch (e) { console.warn('[phone] local permission check', e); }
  try {
    if (!Capacitor.isPluginAvailable('PushNotifications')) return 'unavailable';
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return map((await within(PushNotifications.checkPermissions())).receive);
  } catch (e) { console.warn('[phone] push permission check', e); return 'unavailable'; }
}

/** Ask once after sign-in (Android 13+ shows "Allow E-CFunds to send notifications?"). */
export async function askNotifyOnce() {
  try { if (localStorage.getItem(ASKED)) return; localStorage.setItem(ASKED, '1'); } catch { /* ignore */ }
  await requestNotify();
}
export async function requestNotify(): Promise<PhonePermission> {
  if (!isNative) return 'unavailable';
  try {
    const p = await within(plugin());
    if (p) return map((await p.requestPermissions()).display);   // no timeout: the person is answering Android's question
  } catch (e) { console.warn('[phone] local permission request', e); }
  try {
    if (!Capacitor.isPluginAvailable('PushNotifications')) return 'unavailable';
    const { PushNotifications } = await import('@capacitor/push-notifications');
    return map((await PushNotifications.requestPermissions()).receive);
  } catch (e) { console.warn('[phone] push permission request', e); return 'unavailable'; }
}

/** Post a phone notification (only when E-CFunds isn't on screen). */
export async function phoneNotify(n: { id: number; title: string; body?: string | null; link?: string | null }) {
  if (document.visibilityState === 'visible') return false;
  if ((await import('./push')).pushActive()) return false;   // push already delivers it
  const p = await plugin();
  if (!p) return false;
  try {
    if ((await p.checkPermissions()).display !== 'granted') return false;
    await p.schedule({ notifications: [{
      id: n.id % 2_000_000_000, title: n.title, body: n.body ?? '', channelId: CHANNEL,
      smallIcon: 'ic_stat_notify', iconColor: '#2447C4', extra: { link: n.link ?? '/' }, autoCancel: true,
    }] });
    return true;
  } catch (e) { console.warn('[phone] notify', e); return false; }
}

/** Sign-out: clear what's in the shade. */
export async function clearPhoneNotifications() {
  const p = await plugin();
  if (!p) return;
  try { await p.removeAllDeliveredNotifications(); } catch { /* ignore */ }
}
