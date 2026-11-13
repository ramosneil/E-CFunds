// Google sign-in inside the Android app. Google refuses sign-in inside app windows, so the app opens Google in the
// phone's browser; when it is done, Supabase sends the browser to ph.edu.omsc.ecfunds://auth/callback?code=…, Android
// hands that link back to the app, and the app swaps the one-time code for a session (PKCE: the secret half never
// left this phone). Errors are passed to the sign-in screen with a window event.
import { supabase } from './supabase';
import { APP_AUTH_CALLBACK } from './native';

export const NATIVE_AUTH_ERROR = 'ecfunds:native-auth-error';
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

/** Call once at start-up in the Android app: finishes Google sign-in when the browser hands the link back. */
export async function listenForAuthLinks() {
  const { App } = await import('@capacitor/app');
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(APP_AUTH_CALLBACK)) return;
    const { Browser } = await import('@capacitor/browser');
    void Browser.close().catch(() => { /* already closed */ });
    const params = new URL(url).searchParams;
    const code = params.get('code');
    if (!code) { fail(params.get('error_description') ?? 'Google sign-in was cancelled.'); return; }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) fail(error.message);
  });
}
