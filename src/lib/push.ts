// Push notifications (Firebase Cloud Messaging) — reach the phone even when E-CFunds is closed.
// After sign-in the phone's token is saved (save_push_token); on sign-out it is removed first (drop_push_token), so a
// signed-out phone receives nothing. The database asks Edge Function `push` to send every new notification.
// Only app builds made with Firebase (build ≥ PUSH_MIN_BUILD, v1.1.0+) register — older apps keep local notifications.
import { Capacitor } from '@capacitor/core';
import { isNative } from './native';
import { supabase } from './supabase';

export const PUSH_MIN_BUILD = 9;          // GitHub run number of the first APK built with google-services.json
const KEY = 'ecfunds:push-token';
let listening = false;
let active = false;

/** True once this phone has a working push token (then local notifications aren't needed). */
export const pushActive = () => active;

async function supported() {
  if (!isNative || !Capacitor.isPluginAvailable('PushNotifications')) return false;
  const { App } = await import('@capacitor/app');
  return (Number((await App.getInfo()).build) || 0) >= PUSH_MIN_BUILD;
}

/** Ask permission (once, by Android), register with Firebase and save the token for this signed-in person. */
export async function registerPush() {
  try {
    if (!(await supported())) return;
    const { PushNotifications } = await import('@capacitor/push-notifications');
    if (!listening) {
      listening = true;
      await PushNotifications.addListener('registration', async ({ value }) => {
        try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
        const { error } = await supabase.rpc('save_push_token', { p_token: value, p_platform: 'android' });
        active = !error;
        if (error) console.warn('[push] save', error.message);
      });
      await PushNotifications.addListener('registrationError', (e) => console.warn('[push] register', e.error));
      await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        const link = (a.notification.data as { link?: string } | undefined)?.link;
        if (link) window.dispatchEvent(new CustomEvent('ecfunds:open', { detail: link }));
      });
    }
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (e) { console.warn('[push]', e); }
}

/** Before signing out: forget this phone so the account's notifications stop arriving here. */
export async function unregisterPush() {
  try {
    if (!(await supported())) return;
    let token: string | null = null;
    try { token = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
    if (token) await supabase.rpc('drop_push_token', { p_token: token });
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister();
    active = false;
  } catch (e) { console.warn('[push] unregister', e); }
}
