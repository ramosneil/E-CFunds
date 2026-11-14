import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, UserCheck } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityReport, useRequests, useSchoolFinance, useSchoolSummary } from '../../lib/data';
import { FinancePanel } from '../../components/finance/FinancePanel';
import { supabase } from '../../lib/supabase';
import { peso } from '../../lib/format';
import { Card, DuesBar, EntityLogo, HeroCard, PageHeader, SectionTitle, Spinner, Stat, Chip } from '../../components/ui';
import { NoYear, RequestRow } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';

/** People who signed up and are waiting for SAS to approve their account. */
function usePendingAccounts() {
  return useQuery({
    queryKey: ['profiles', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function AdminDashboard() {
  const year = useCurrentYear();
  const y = year.data?.id;
  const summary = useSchoolSummary(y);
  const report = useEntityReport(y);
  const entities = useEntities();
  const pending = useRequests({ status: 'pending' });
  const accounts = usePendingAccounts();
  const school = useSchoolFinance(y);

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Dashboard" /><NoYear admin /></>;

  const s = summary.data;
  const byId = new Map(entities.data?.map((e) => [e.id, e]));
  const waitingAccounts = accounts.data ?? 0;
  const collected = (report.data ?? []).reduce((t, r) => t + Number(r.collections), 0);
  const hasPending = (r: { pending_remittances: number; pending_releases: number; pending_expenses: number }) =>
    r.pending_remittances + r.pending_releases + r.pending_expenses > 0;
  // Orgs that need SAS first (pending requests), otherwise the usual order.
  const orgs = [...(report.data ?? [])].sort((a, b) => Number(hasPending(b)) - Number(hasPending(a)));

  return (
    <>
      <PageHeader title="Dashboard" sub={`All organizations and clubs · ${year.data.label}`}
        action={<ExportMenu options={[
          { label: 'School summary', kind: 'pdf', run: async () => (await exportsLib()).schoolSummary('pdf', year.data!) },
          { label: 'School summary', kind: 'csv', run: async () => (await exportsLib()).schoolSummary('csv', year.data!) },
          { label: 'Full backup (all data)', kind: 'xlsx', run: async () => (await import('../../lib/export/backup')).fullBackup() },
        ]} />} />

      {/* Phone: total → waiting for you → numbers → orgs. Desktop: total | waiting, then numbers and the full-width table. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr] items-start">
        <HeroCard label="Total funds, all orgs & clubs" total={s?.total_fund ?? 0} cash={s?.cash_on_hand ?? 0} saved={s?.saved_with_sas ?? 0}
          foot={<>{s?.organizations ?? 0} organizations · {s?.clubs ?? 0} clubs · {s?.students ?? 0} students</>} />

        <Card>
          <SectionTitle action={<Link to="/approvals" className="text-primary text-[14px] font-semibold flex items-center h-11 -my-3">All<ChevronRight className="size-4" /></Link>}>Waiting for you</SectionTitle>
          {waitingAccounts > 0 && (
            <Link to="/approvals?tab=accounts" className="flex items-center gap-3 rounded-[14px] bg-warn-soft text-warn px-3 h-12 mb-2 font-semibold text-[14px] hover:brightness-95">
              <UserCheck className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">{waitingAccounts} {waitingAccounts === 1 ? 'account' : 'accounts'} to approve</span>
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
          {pending.data?.length ? (
            <div className="divide-y divide-line">
              {pending.data.slice(0, 5).map((r) => (
                <Link key={r.id} to="/approvals" className="block -mx-2 px-2 rounded-[12px] hover:bg-surface2" aria-label={`Review this request from ${byId.get(r.entity_id)?.short_name ?? 'an org'}`}>
                  <RequestRow r={r} entityName={byId.get(r.entity_id)?.short_name} />
                </Link>
              ))}
              {pending.data.length > 5 && <Link to="/approvals" className="block pt-3 text-[14px] font-semibold text-primary">+{pending.data.length - 5} more</Link>}
            </div>
          ) : !waitingAccounts && <p className="text-muted text-[14px] py-6 text-center">Nothing waiting. All clear.</p>}
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:col-span-2">
          <Stat label="Money requests" value={s?.pending_requests ?? 0} tone={s?.pending_requests ? 'warn' : undefined} />
          <Stat label="Accounts to approve" value={waitingAccounts} tone={waitingAccounts ? 'warn' : undefined} />
          <Stat label="Collected this year" value={peso(collected)} tone={collected ? 'ok' : undefined} />
          <Stat label="Spent this year" value={peso(s?.expenses ?? 0)} tone={s?.expenses ? 'bad' : undefined} />
        </div>

        <Card className="p-0 overflow-hidden lg:col-span-2">
          <div className="px-5 pt-5"><SectionTitle>Funds by org & club</SectionTitle></div>
          {report.isLoading ? <Spinner /> : (<>
            {/* Phones: one row per org, nothing scrolls sideways. */}
            <ul className="md:hidden divide-y divide-line">
              {orgs.map((r) => (
                <li key={r.entity_id}>
                  <Link to={`/orgs/${r.entity_id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-surface2/60">
                    <EntityLogo path={byId.get(r.entity_id)?.logo_path ?? null} name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{r.short_name}</span>
                        {hasPending(r) && <Chip tone="warn">Pending</Chip>}
                        <span className="money font-semibold ml-auto">{peso(r.total_fund)}</span>
                      </div>
                      <p className="text-[12.5px] text-muted money mt-0.5">Cash {peso(r.cash_on_hand)} · Saved {peso(r.saved_with_sas)}</p>
                      <div className="mt-2"><DuesBar paid={r.paid_members} members={r.members} /></div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Tablets and computers: the full table. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="micro px-5 py-2 font-semibold">Org / club</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Cash</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Saved</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Total</th>
                    <th className="micro px-5 py-2 font-semibold w-44 whitespace-nowrap">Dues · this semester</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((r) => (
                    <tr key={r.entity_id} className="border-b border-line last:border-0 hover:bg-surface2/60">
                      <td className="px-5 py-3">
                        <Link to={`/orgs/${r.entity_id}`} className="flex items-center gap-3 font-semibold">
                          <EntityLogo path={byId.get(r.entity_id)?.logo_path ?? null} name={r.name} size={32} />
                          <span className="truncate">{r.short_name}</span>
                          {r.is_school_wide && <Chip tone="primary">School-wide</Chip>}
                          {hasPending(r) && <Chip tone="warn">Pending</Chip>}
                        </Link>
                      </td>
                      <td className="money px-3 py-3 text-right whitespace-nowrap">{peso(r.cash_on_hand)}</td>
                      <td className="money px-3 py-3 text-right whitespace-nowrap">{peso(r.saved_with_sas)}</td>
                      <td className="money px-3 py-3 text-right font-semibold whitespace-nowrap">{peso(r.total_fund)}</td>
                      <td className="px-5 py-3"><DuesBar paid={r.paid_members} members={r.members} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
        </Card>
      </div>
      <div className="mt-4">
        <FinancePanel finance={school.data} loading={school.isLoading} title="Where all student funds went this year"
          note="Every org and club together — students see this on their Home page." />
      </div>
    </>
  );
}
