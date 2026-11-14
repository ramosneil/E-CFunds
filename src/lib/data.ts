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
      const { data, error } = await supabase.from('entities').select('*').order('category').order('id');
      if (error) throw error;
      return data;
    },
  });
}

/** Money is for the whole school year; members / paid_members are for the CURRENT semester (fees are per semester —
 *  without a semester the database adds every semester's list, which would double the counts in the 2nd semester).
 *  Organizations/clubs with yearly fees have no semester on their memberships, so they are always counted. */
export function useEntityReport(yearId: number | undefined) {
  const sems = useSemesters(yearId);
  const semId = sems.data?.find((s) => s.is_current)?.id;
  return useQuery({
    queryKey: ['report', yearId, semId ?? null],
    enabled: !!yearId && !sems.isLoading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_entity_report', { p_school_year_id: yearId!, ...(semId ? { p_semester_id: semId } : {}) });
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
export const moneyKeys = [['report'], ['summary'], ['requests'], ['ledger'], ['memberships'], ['finance']];

/** Approved treasurers by org/club id (admin only — RLS lets SAS read every profile). */
export function useTreasurers(enabled = true) {
  return useQuery({
    queryKey: ['profiles', 'treasurers'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('full_name, email, entity_id')
        .eq('role', 'treasurer').eq('status', 'approved');
      if (error) throw error;
      return new Map(data.filter((p) => p.entity_id).map((p) => [p.entity_id!, p.full_name || p.email || 'Treasurer']));
    },
  });
}

/** Where an org/club's money came from and went (approved users; students never get the receipt mark). */
export function useEntityFinance(entityId: number | undefined, yearId: number | undefined) {
  return useQuery({
    queryKey: ['finance', entityId, yearId],
    enabled: !!entityId && !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_entity_finance', { p_entity_id: entityId!, p_school_year_id: yearId! });
      if (error) throw error;
      return data;
    },
  });
}

/** The same, summed over every org and club (no expense lines). */
export function useSchoolFinance(yearId: number | undefined) {
  return useQuery({
    queryKey: ['finance', 'school', yearId],
    enabled: !!yearId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_school_finance', { p_school_year_id: yearId! });
      if (error) throw error;
      return data;
    },
  });
}
