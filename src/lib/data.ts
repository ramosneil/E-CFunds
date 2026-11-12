// Shared data hooks. Every read goes through RLS; money totals come from the SQL report functions,
// never summed in the browser (business-rules §2).
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useCurrentYear() {
  return useQuery({
    queryKey: ['year', 'current'],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_years').select('*').eq('is_current', true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSchoolYears() {
  return useQuery({
    queryKey: ['years'],
    queryFn: async () => {
      const { data, error } = await supabase.from('school_years').select('*').order('starts_on', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSemesters(yearId: number | undefined) {
  return useQuery({
    queryKey: ['semesters', yearId],
    enabled: !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.from('semesters').select('*').eq('school_year_id', yearId!).order('term');
      if (error) throw error;
      return data;
    },
  });
}

export function useEntities() {
  return useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('entities').select('*').order('category', { ascending: false }).order('id');
      if (error) throw error;
      return data;
    },
  });
}

export function useEntityReport(yearId: number | undefined) {
  return useQuery({
    queryKey: ['report', yearId],
    enabled: !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_entity_report', { p_school_year_id: yearId! });
      if (error) throw error;
      return data;
    },
  });
}

export function useSchoolSummary(yearId: number | undefined) {
  return useQuery({
    queryKey: ['summary', yearId],
    enabled: !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_school_summary', { p_school_year_id: yearId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useRequests(filter: { entityId?: number; status?: 'pending' } = {}) {
  return useQuery({
    queryKey: ['requests', filter],
    queryFn: async () => {
      let q = supabase.from('fund_requests').select('*').order('filed_at', { ascending: false }).limit(200);
      if (filter.entityId) q = q.eq('entity_id', filter.entityId);
      if (filter.status) q = q.eq('status', filter.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

/** Query keys to refresh after any money action. */
export const moneyKeys = [['report'], ['summary'], ['requests'], ['ledger'], ['memberships']];
