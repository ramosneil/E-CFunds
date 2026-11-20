// Google sign-in inside the Android app. Google refuses sign-in inside app windows, so the app opens Google in the
// phone's browser; when it is done, Supabase sends the browser to ph.edu.omsc.ecfunds://auth/callback?code=…, Android
// hands that link back to the app, and the app swaps the one-time code for a session (PKCE: the secret half never
// left this phone). Errors are passed to the sign-in screen with a window event.
import { supabase } from './supabase';
import { APP_AUTH_CALLBACK } from './native';

export const NATIVE_AUTH_ERROR = 'ecfunds:native-auth-error';
/** App.tsx listens: open this in-app path (password reset from an email link). */
export const NATIVE_GO = 'ecfunds:native-go';
export const RECOVERY_FLAG = 'ecfunds:recovery';
const go = (path: string) => window.dispatchEvent(new CustomEvent(NATIVE_GO, { detail: path }));
const fail = (message: string) => window.dispatchEvent(new CustomEvent(NATIVE_AUTH_ERROR, { detail: message }));

/** Opens Google sign-in in the phone's browser. Returns an error message, or null when the browser opened. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: APP_AUTH_CALLBACK, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return error?.message ?? 'Could not start Google sign-in.';
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url });
  return null;
}

const used = new Set<string>();   // a code works once; the same link can arrive twice (launch URL + event)

async function finish(url: string) {
  if (!url.startsWith(APP_AUTH_CALLBACK)) return;
  // Password-reset email asked from the app: the link carries the sign-in in its #hash (implicit flow, see
  // resetEmailClient) → sign in here and open "Set a new password" inside the app.
  const hash = new URLSearchParams(new URL(url).hash.replace(/^#/, ''));
  if (hash.get('type') === 'recovery' || hash.get('error_code') || hash.get('access_token')) {
    const access = hash.get('access_token'), refresh = hash.get('refresh_token');
    if (access && used.has(access)) return;
    if (access) used.add(access);
    if (!access || !refresh) {
      go(`/reset#error_description=${encodeURIComponent(hash.get('error_description') ?? 'The reset link has expired')}`);
      return;
    }
    try { sessionStorage.setItem(RECOVERY_FLAG, '1'); } catch { /* fine */ }
    const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
    try { sessionStorage.removeItem(RECOVERY_FLAG); } catch { /* fine */ }   // used (or not needed) by now
    if (error) { go(`/reset#error_description=${encodeURIComponent(error.message)}`); return; }
    go('/reset');
    return;
  }
  const params = new URL(url).searchParams;
  const code = params.get('code');
  if (code && used.has(code)) return;
  if (code) used.add(code);
  const { Browser } = await import('@capacitor/browser');
  void Browser.close().catch(() => { /* already closed */ });
  if (!code) { fail(params.get('error_description') ?? 'Google sign-in was cancelled.'); return; }
  const { data } = await supabase.auth.getSession();
  if (data.session) return;                                  // already signed in with this link
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) fail(error.message);
}

/** Call once at start-up in the Android app: finishes Google sign-in when the browser hands the link back.
 *  Many phones (Oppo/Realme…) close the app while Google is open, so the link may arrive as the app's LAUNCH url
 *  (cold start) instead of an appUrlOpen event — handle both, or the person lands on the start screen. */
export async function listenForAuthLinks() {
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', ({ url }) => { void finish(url); });
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) await finish(launch.url);
}
