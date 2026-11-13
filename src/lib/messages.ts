// Messaging data (business-rules §4.8). RLS decides what each role sees:
// admin = everything; treasurer = own org conversation + broadcasts (entity_id null); students = nothing.
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Row } from './database.types';

export type Message = Row<'messages'>;

export function useMessages(enabled = true) {
  return useQuery({
    queryKey: ['messages'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('messages').select('*').order('created_at').limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

export function useBroadcastReads(enabled = true) {
  return useQuery({
    queryKey: ['broadcast-reads'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('broadcast_reads').select('*');
      if (error) throw error;
      return data;
    },
  });
}

/** Names of people in conversations (admin can read all profiles; treasurers only see "SAS"). */
export function useSenderNames(enabled: boolean) {
  return useQuery({
    queryKey: ['sender-names'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email, role, status');
      if (error) throw error;
      return {
        names: new Map(data.map((p) => [p.id, p.full_name || p.email || 'Someone'])),
        treasurers: data.filter((p) => p.role === 'treasurer' && p.status === 'approved').length,
      };
    },
  });
}

/** Unread counts for the badge: admin → per org; treasurer → own conversation + broadcasts. */
export function useUnread() {
  const { profile } = useAuth();
  const staff = profile?.role === 'admin' || profile?.role === 'treasurer';
  const me = profile?.id;
  const msgs = useMessages(staff);
  const reads = useBroadcastReads(profile?.role === 'treasurer');
  return useMemo(() => {
    const byEntity = new Map<number, number>();
    let broadcasts = 0;
    for (const m of msgs.data ?? []) {
      if (m.sender_id === me) continue;
      if (m.entity_id === null) {
        if (profile?.role === 'treasurer' && !(reads.data ?? []).some((r) => r.message_id === m.id)) broadcasts++;
      } else if (!m.read_at) {
        byEntity.set(m.entity_id, (byEntity.get(m.entity_id) ?? 0) + 1);
      }
    }
    const total = [...byEntity.values()].reduce((a, b) => a + b, 0) + broadcasts;
    return { byEntity, broadcasts, total };
  }, [msgs.data, reads.data, me, profile?.role]);
}

/** One Realtime subscription for the whole app: refresh message data whenever a message is added, read or deleted. */
export function useMessagesRealtime() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const staff = profile?.role === 'admin' || profile?.role === 'treasurer';
  useEffect(() => {
    if (!staff) return;
    const ch = supabase.channel('messages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: ['messages'] });
        void qc.invalidateQueries({ queryKey: ['broadcast-reads'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [staff, qc]);
}
