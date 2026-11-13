// Notifications for the signed-in person: list (bell), live delivery (Realtime) → pop-up + chime.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { peso } from './format';
import { toast } from './toast';
import { phoneNotify } from './phone';
import type { Database } from './database.types';

export type Note = Database['public']['Tables']['notifications']['Row'];

/** Title/body as shown: merged dues payments read "JOES recorded 3 dues payments · ₱60.00 total". */
export function display(n: Note): { title: string; body: string | null } {
  if (n.kind === 'payment' && n.count > 1) {
    return { title: n.title.replace('a dues payment', `${n.count} dues payments`), body: `${peso(n.amount ?? 0)} total` };
  }
  if (n.kind === 'fees') return { title: 'New fees to pay this semester', body: `${n.body ?? ''} · ${peso(n.amount ?? 0)}` };
  if (n.kind === 'members') {
    return { title: n.count > 1 ? `${n.count} new members to collect` : 'New member to collect', body: `${peso(n.amount ?? 0)}${n.count > 1 ? ' total' : ''}` };
  }
  return { title: n.title, body: n.body };
}

export function useNotifications(uid: string | undefined) {
  return useQuery({
    queryKey: ['notifications', uid],
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*')
        .order('updated_at', { ascending: false }).limit(40);
      if (error) throw error;
      return data as Note[];
    },
  });
}

/** Live: new or merged notifications pop up with a chime while the app is open. Call once (Shell). */
export function useLiveNotifications(uid: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(`notes:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient=eq.${uid}` }, (p) => {
        void qc.invalidateQueries({ queryKey: ['notifications', uid] });
        const n = p.new as Note | undefined;
        if (!n || n.read_at || (p.eventType !== 'INSERT' && p.eventType !== 'UPDATE')) return;
        const old = p.old as Partial<Note> | undefined;
        if (p.eventType === 'UPDATE' && old?.count === n.count) return;   // only "marked read" changed
        const d = display(n);
        void phoneNotify({ id: n.id * 10 + (n.count % 10), title: d.title, body: d.body, link: n.link }).then((sent) => {
          if (!sent) toast({ title: d.title, body: d.body ?? undefined, href: n.link ?? undefined });
        });
        // Money-related events change numbers on screen: refresh them too.
        if (!['message', 'announcement', 'app_update', 'account'].includes(n.kind)) void qc.invalidateQueries();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [uid, qc]);
}

export async function markRead(id: number) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}
export async function markAllRead() {
  await supabase.rpc('mark_notifications_read');
}

/** "just now", "5 min", "3 h", "2 d", or a date. */
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(iso));
}
