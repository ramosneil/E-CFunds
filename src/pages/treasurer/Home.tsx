import { Link } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Receipt, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntities, useEntityReport, useRequests } from '../../lib/data';
import { peso } from '../../lib/format';
import { Card, DuesBar, EntityLogo, HeroCard, SectionTitle, Spinner, Stat } from '../../components/ui';
import { NoYear, RequestRow } from '../../components/common';
import { LedgerList, useLedger } from '../admin/EntityDetail';
import { ExportMenu, exportsLib } from '../../components/ExportMenu';

export function TreasurerHome() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? undefined;
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const requests = useRequests({ entityId });
  const ledger = useLedger(entityId, year.data?.id);
  const e = entities.data?.find((x) => x.id === entityId);
  const r = report.data?.find((x) => x.entity_id === entityId);

  if (year.isLoading || entities.isLoading) return <Spinner />;
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        {e && <EntityLogo path={e.logo_path} name={e.name} size={48} />}
        <div className="min-w-0 flex-1">
          <p className="micro text-muted">Treasurer</p>
          <h1 className="font-display text-[24px] sm:text-[28px] font-extrabold leading-tight truncate">{e?.short_name ?? 'Your org'}</h1>
        </div>
        {e && year.data && <ExportMenu options={[
          { label: 'Financial report', kind: 'pdf', run: async () => (await exportsLib()).orgReport('pdf', e, year.data!) },
          { label: 'Ledger', kind: 'csv', run: async () => (await exportsLib()).orgReport('csv', e, year.data!) },
          { label: 'Members & dues', kind: 'csv', run: async () => (await exportsLib()).membersCsv(e, year.data!) },
        ]} />}
      </div>
      {!year.data ? <NoYear /> : !r ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <HeroCard label={`Total fund · ${year.data.label}`} total={r.total_fund} cash={r.cash_on_hand} saved={r.saved_with_sas}
              foot={<>Previous funds {peso(r.previous_funds)} · You can remit up to <b className="text-white money">{peso(r.available_to_remit)}</b></>} />
            <div className="grid grid-cols-2 gap-3 content-start">
              <Stat label="Collected" value={peso(r.collections)} tone={r.collections ? 'ok' : undefined} />
              <Stat label="Spent" value={peso(r.expenses)} tone={r.expenses ? 'bad' : undefined} />
              <div className="col-span-2 bg-surface border border-line rounded-[18px] p-4">
                <p className="micro text-muted mb-2">Dues this year</p>
                <DuesBar paid={r.paid_members} members={r.members} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Action to="/members" icon={<Wallet className="size-5" />} label="Record payment" gold />
            <Action to="/requests?new=remittance" icon={<ArrowUpRight className="size-5" />} label="Remit to SAS" />
            <Action to="/requests?new=release" icon={<ArrowDownLeft className="size-5" />} label="Ask for release" />
            <Action to="/requests?new=expense" icon={<Receipt className="size-5" />} label="File expense" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4 items-start">
            <Card>
              <SectionTitle action={<Link to="/requests" className="text-primary text-[14px] font-semibold flex items-center">All<ChevronRight className="size-4" /></Link>}>Requests</SectionTitle>
              {requests.data?.length ? <div className="divide-y divide-line">{requests.data.slice(0, 5).map((q) => <RequestRow key={q.id} r={q} />)}</div>
                : <p className="text-muted text-[14px] py-4">No requests yet.</p>}
            </Card>
            <Card>
              <SectionTitle>Recent activity</SectionTitle>
              {ledger.isLoading ? <Spinner /> : <LedgerList entries={(ledger.data ?? []).slice(0, 8)} />}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Action({ to, icon, label, gold }: { to: string; icon: React.ReactNode; label: string; gold?: boolean }) {
  return (
    <Link to={to} className={`rounded-[18px] p-4 flex flex-col gap-3 font-semibold transition hover:brightness-105 ${gold ? 'bg-gold text-on-gold' : 'bg-surface border border-line hover:bg-surface2'}`}>
      <span className={`size-10 rounded-[12px] grid place-items-center ${gold ? 'bg-black/10' : 'bg-primary-soft text-primary'}`}>{icon}</span>
      <span className="text-[14px] leading-tight">{label}</span>
    </Link>
  );
}
