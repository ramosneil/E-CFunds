import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityFinance, useEntityReport } from '../../lib/data';
import { peso } from '../../lib/format';
import { Card, Chip, DuesBar, EntityLogo, PocketBar, Spinner } from '../../components/ui';
import { NoYear } from '../../components/common';
import { FinancePanel } from '../../components/finance/FinancePanel';

/** One org/club's public report (students + treasurers): fund, dues, and where the money went. */
export function ReportDetail() {
  const { id } = useParams();
  const entityId = Number(id);
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const finance = useEntityFinance(entityId, year.data?.id);
  const e = entities.data?.find((x) => x.id === entityId);
  const r = report.data?.find((x) => x.entity_id === entityId);

  if (year.isLoading || entities.isLoading) return <Spinner />;
  if (!year.data) return <NoYear />;
  if (!e) return <p className="text-muted">Not found.</p>;
  return (
    <>
      <Link to="/reports" className="inline-flex items-center gap-1 h-11 text-primary font-semibold mb-2"><ArrowLeft className="size-4" />All reports</Link>
      <div className="flex items-center gap-4 mb-5">
        <EntityLogo path={e.logo_path} name={e.name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] sm:text-[26px] font-extrabold leading-tight">{e.short_name}</h1>
          <p className="text-muted truncate">{e.name} · {year.data.label}</p>
        </div>
        {e.is_school_wide && <Chip tone="primary">School-wide</Chip>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr] items-start">
        <div className="space-y-4">
          {r && (
            <Card>
              <p className="micro text-muted">Total fund</p>
              <p className="money font-display font-bold text-[28px]">{peso(r.total_fund)}</p>
              <div className="mt-3"><PocketBar cash={r.cash_on_hand} saved={r.saved_with_sas} /></div>
              <p className="micro text-muted mt-5 mb-1.5">Dues · this semester</p>
              {r.members > 0 ? <DuesBar paid={r.paid_members} members={r.members} /> : <p className="text-[13px] text-muted">No members yet</p>}
            </Card>
          )}
        </div>
        <FinancePanel finance={finance.data} loading={finance.isLoading} />
      </div>
    </>
  );
}
