// "Clear from my list" (Neil, 2026-11-25): each person can hide items from their own Home lists and Activity log,
// one by one or all at once. Only a mark in cleared_items (migration 46) — the request, ledger entry or audit row is
// never changed, so reports, totals and the official log stay complete. "Show cleared items" removes the marks.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { ClearedList } from './database.types';

export function useCleared(list: ClearedList) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['cleared', list],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('cleared_items').select('item_id, cleared_at').eq('list', list);
      if (error) throw error;
      return data;
    },
  });
  const ids = new Set((q.data ?? []).filter((x) => x.item_id !== '*').map((x) => x.item_id));
  const allMark = q.data?.find((x) => x.item_id === '*')?.cleared_at;
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['cleared', list] });
    if (list === 'activity_log') await qc.invalidateQueries({ queryKey: ['audit'] });
  };
  return {
    ready: q.isSuccess,
    /** Any marks at all (to offer "Show cleared items"). */
    any: (q.data?.length ?? 0) > 0,
    /** Hidden for me: cleared one by one, or older than my last "Clear all". */
    isCleared: (id: string | number, time: string | null | undefined) =>
      ids.has(String(id)) || (!!allMark && !!time && new Date(time).getTime() <= new Date(allMark).getTime()),
    clearOne: async (id: string | number) => {
      const { error } = await supabase.from('cleared_items').upsert({ list, item_id: String(id) }, { onConflict: 'user_id,list,item_id' });
      if (error) throw error;
      await refresh();
    },
    clearAll: async () => {
      // One mark for everything up to now (the server's clock, not the phone's); the older marks are no longer needed.
      const del = await supabase.from('cleared_items').delete().eq('list', list);
      if (del.error) throw del.error;
      const { error } = await supabase.from('cleared_items').insert({ list, item_id: '*' });
      if (error) throw error;
      await refresh();
    },
    restore: async () => {
      const { error } = await supabase.from('cleared_items').delete().eq('list', list);
      if (error) throw error;
      await refresh();
    },
  };
}
