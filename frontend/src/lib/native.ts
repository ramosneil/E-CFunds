// Small helpers for "where is the app running?": a browser (PWA) or the Android app (Capacitor).
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

/** The live website. Email links (confirm, password reset) must open here, never inside the app's local address. */
export const LIVE_URL = 'https://e-cfunds.vercel.app';

/** Where email links should send people: this site in a browser, the live site from the Android app. */
export const webOrigin = () => (isNative ? LIVE_URL : window.location.origin);

/** Android only: the address Google sign-in returns to (AndroidManifest intent-filter + Supabase redirect list). */
export const APP_AUTH_CALLBACK = 'ph.edu.omsc.ecfunds://auth/callback';
