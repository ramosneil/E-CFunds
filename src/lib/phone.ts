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

export async function notifyPermission(): Promise<PhonePermission> {
  const p = await plugin();
  if (!p) return 'unavailable';
  const s = (await p.checkPermissions()).display;
  return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
}

/** Ask once after sign-in (Android 13+ shows "Allow E-CFunds to send notifications?"). */
export async function askNotifyOnce() {
  try { if (localStorage.getItem(ASKED)) return; localStorage.setItem(ASKED, '1'); } catch { /* ignore */ }
  await requestNotify();
}
export async function requestNotify(): Promise<PhonePermission> {
  const p = await plugin();
  if (!p) return 'unavailable';
  const s = (await p.requestPermissions()).display;
  return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
}

/** Post a phone notification (only when E-CFunds isn't on screen). */
export async function phoneNotify(n: { id: number; title: string; body?: string | null; link?: string | null }) {
  if (document.visibilityState === 'visible') return false;
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
