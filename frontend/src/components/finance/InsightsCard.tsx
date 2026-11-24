// The short version of Insights for Home and the Dashboard (Neil, 2026-11-25): the four headline numbers and a link
// to the full dashboard (charts, budget vs actual, comparison, Present mode).
import { Link } from 'react-router';
import { BarChart3, ChevronRight } from 'lucide-react';
import type { Finance } from '../../lib/database.types';
import { useEntityReport } from '../../lib/data';
import { Card, Spinner } from '../ui';
import { KpiTiles, kpisFor } from './KpiTiles';
import { balanceSentence } from './BalanceTrend';

export function InsightsCard({ yearId, entityId, finance, loading, title, note }: {
  yearId: number | undefined; entityId?: number | null; finance?: Finance | null; loading?: boolean; title: string; note?: string;
}) {
  const report = useEntityReport(yearId);
  const rows = (report.data ?? []).filter((r) => !entityId || r.entity_id === entityId);
  const to = entityId ? `/insights?org=${entityId}` : '/insights?org=school';
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 mb-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[17px] font-bold">{title}</h2>
          <p className="text-[13.5px] text-muted mt-0.5">{finance && rows.length ? balanceSentence(finance.monthly, kpisFor(rows, finance).fund) : note}</p>
        </div>
        <Link to={to} className="lux-primary lux-press h-11 px-4 rounded-[14px] inline-flex items-center gap-2 font-semibold text-[14px] shrink-0">
          <BarChart3 className="size-4" aria-hidden />Open Insights<ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {loading || report.isLoading || !finance ? <Spinner /> : <KpiTiles k={kpisFor(rows, finance)} monthly={finance.monthly} />}
      {note && finance && <p className="text-[12.5px] text-muted mt-3">{note}</p>}
    </Card>
  );
}
