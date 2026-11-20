import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)');

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

/** Password-reset emails only: the link must work in ANY browser (e.g. reset asked in the Android app, email opened in
 *  Chrome). The main client uses PKCE, whose secret half stays where the reset was asked, so that link failed with
 *  "Auth session missing!". This one-off client asks for a link that carries the sign-in itself (in the URL #hash);
 *  ResetPassword reads it. It stores nothing. */
export function resetEmailClient() {
  return createClient<Database>(url!, key!, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ecfunds-reset' },
  });
}

export function logoUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from('logos').getPublicUrl(path).data.publicUrl : null;
}

/** Turns a Postgres/PostgREST error into one plain sentence for the UI. */
export function errorText(e: unknown): string {
  if (!e) return 'Something went wrong.';
  const m = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return m.replace(/^ERROR:\s*/i, '').trim() || 'Something went wrong.';
}
