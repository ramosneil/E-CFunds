import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Row } from './database.types';

type Profile = Row<'profiles'>;
type AuthState = {
  session: Session | null;
  ready: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setReady(true);
      if (!s) qc.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  // A device that has signed in before opens on "Sign in"; a brand-new one opens on "Create account" (App.tsx).
  useEffect(() => { if (session) rememberSignedIn(); }, [session]);

  const uid = session?.user.id;
  const profileQ = useQuery({
    queryKey: ['profile', uid],
    enabled: !!uid,
    queryFn: async () => {
      // Profile is created by a trigger at sign-up; RLS lets each user read their own row.
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const value: AuthState = {
    session,
    ready,
    profile: profileQ.data ?? null,
    profileLoading: !!uid && profileQ.isLoading,
    refreshProfile: () => { void profileQ.refetch(); },
    signOut: async () => {
      // Stop this device's push notifications for this account first (needs the session): Android app + browser.
      await import('./push').then((m) => m.unregisterPush()).catch(() => {});
      await import('./webpush').then((m) => m.webPushOff()).catch(() => {});
      await supabase.auth.signOut(); qc.clear();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const SEEN_KEY = 'ecfunds:signed-in-before';
function rememberSignedIn() { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: fine */ } }
export function hasSignedInBefore() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } }

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
