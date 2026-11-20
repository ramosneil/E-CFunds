// Screens update themselves: the database writes a tiny "tick" (topic only, no data) after every change batch
// (migration 21, public.live_changes). Every signed-in, approved person listens; on a tick, open screens re-fetch
// within ~0.5 s — still only what each person is allowed to read. Bursts are merged into one refresh.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useLiveScreens(uid: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Messages and notifications have their own live channels; refresh everything else.
        void qc.invalidateQueries({ predicate: (q) => !['messages', 'notifications'].includes(String(q.queryKey[0])) });
      }, 500);
    };
    const ch = supabase.channel(`live:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_changes' }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });   // also after reconnecting
    const online = () => refresh();
    window.addEventListener('online', online);
    return () => { clearTimeout(timer); window.removeEventListener('online', online); void supabase.removeChannel(ch); };
  }, [uid, qc]);
}
