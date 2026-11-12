import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityReport, useRequests, useSchoolSummary } from '../../lib/data';
import { peso } from '../../lib/format';
import { Card, DuesBar, EntityLogo, HeroCard, PageHeader, SectionTitle, Spinner, Stat, Chip } from '../../components/ui';
import { NoYear, RequestRow } from '../../components/common';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';

export function AdminDashboard() {
  const year = useCurrentYear();
  const y = year.data?.id;
  const summary = useSchoolSummary(y);
  const report = useEntityReport(y);
  const entities = useEntities();
  const pending = useRequests({ status: 'pending' });

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Dashboard" /><NoYear admin /></>;

  const s = summary.data;
  const byId = new Map(entities.data?.map((e) => [e.id, e]));
  return (
    <>
      <PageHeader title="Dashboard" sub={`All organizations and clubs · ${year.data.label}`}
        action={<ExportMenu options={[
          { label: 'School summary', kind: 'pdf', run: async () => (await exportsLib()).schoolSummary('pdf', year.data!) },
          { label: 'School summary', kind: 'csv', run: async () => (await exportsLib()).schoolSummary('csv', year.data!) },
        ]} />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <HeroCard label="Total funds, all orgs & clubs" total={s?.total_fund ?? 0} cash={s?.cash_on_hand ?? 0} saved={s?.saved_with_sas ?? 0}
          foot={<>{s?.organizations ?? 0} organizations · {s?.clubs ?? 0} clubs · {s?.students ?? 0} students</>} />
        <div className="grid grid-cols-2 gap-3 content-start">
          <Stat label="Pending requests" value={s?.pending_requests ?? 0} tone={s?.pending_requests ? 'warn' : undefined} />
          <Stat label="Expenses" value={peso(s?.expenses ?? 0)} tone={s?.expenses ? 'bad' : undefined} />
          <Stat label="Saved with SAS" value={peso(s?.saved_with_sas ?? 0)} />
          <Stat label="Cash on hand" value={peso(s?.cash_on_hand ?? 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr] mt-4 items-start">
        <Card className="p-0 overflow-hidden">
          <div className="px-5 pt-5"><SectionTitle>Funds by org & club</SectionTitle></div>
          {report.isLoading ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px] min-w-[640px]">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="micro px-5 py-2 font-semibold">Org / club</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Cash</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Saved</th>
                    <th className="micro px-3 py-2 font-semibold text-right">Total</th>
                    <th className="micro px-5 py-2 font-semibold w-40">Dues</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data?.map((r) => (
                    <tr key={r.entity_id} className="border-b border-line last:border-0 hover:bg-surface2/60">
                      <td className="px-5 py-3">
                        <Link to={`/orgs/${r.entity_id}`} className="flex items-center gap-3 font-semibold">
                          <EntityLogo path={byId.get(r.entity_id)?.logo_path ?? null} name={r.name} size={32} />
                          <span className="truncate">{r.short_name}</span>
                          {r.is_school_wide && <Chip tone="primary">School-wide</Chip>}
                          {r.pending_remittances + r.pending_releases + r.pending_expenses > 0 && <Chip tone="warn">Pending</Chip>}
                        </Link>
                      </td>
                      <td className="money px-3 py-3 text-right">{peso(r.cash_on_hand)}</td>
                      <td className="money px-3 py-3 text-right">{peso(r.saved_with_sas)}</td>
                      <td className="money px-3 py-3 text-right font-semibold">{peso(r.total_fund)}</td>
                      <td className="px-5 py-3"><DuesBar paid={r.paid_members} members={r.members} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle action={<Link to="/approvals" className="text-primary text-[14px] font-semibold flex items-center">All<ChevronRight className="size-4" /></Link>}>Waiting for you</SectionTitle>
          {pending.data?.length ? (
            <div className="divide-y divide-line">
              {pending.data.slice(0, 6).map((r) => <RequestRow key={r.id} r={r} entityName={byId.get(r.entity_id)?.short_name} />)}
            </div>
          ) : <p className="text-muted text-[14px] py-6 text-center">No requests waiting. All clear.</p>}
        </Card>
      </div>
    </>
  );
}
