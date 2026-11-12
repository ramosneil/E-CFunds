import { useState } from 'react';
import { useCurrentYear, useEntities, useEntityReport } from '../../lib/data';
import { peso } from '../../lib/format';
import { Card, Chip, DuesBar, EntityLogo, PageHeader, PocketBar, Spinner } from '../../components/ui';
import { NoYear, Segmented } from '../../components/common';

/** Aggregates only (counts, totals) — the same view for every role; no transaction-level detail. */
export function Reports() {
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const [cat, setCat] = useState<'all' | 'organization' | 'club'>('all');
  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Reports" /><NoYear /></>;
  const logo = new Map(entities.data?.map((e) => [e.id, e.logo_path]));
  const rows = (report.data ?? []).filter((r) => cat === 'all' || r.category === cat);
  return (
    <>
      <PageHeader title="Reports" sub={`Every org and club · ${year.data.label}`} />
      <div className="max-w-sm mb-5"><Segmented value={cat} onChange={setCat} options={[['all', 'All'], ['organization', 'Orgs'], ['club', 'Clubs']]} /></div>
      {report.isLoading ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.entity_id}>
              <div className="flex items-center gap-3">
                <EntityLogo path={logo.get(r.entity_id) ?? null} name={r.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{r.short_name}</p>
                  <p className="text-[13px] text-muted truncate">{r.name}</p>
                </div>
                {r.is_school_wide && <Chip tone="primary">School-wide</Chip>}
              </div>
              <p className="micro text-muted mt-4">Total fund</p>
              <p className="money font-display font-bold text-[24px]">{peso(r.total_fund)}</p>
              <div className="mt-3"><PocketBar cash={r.cash_on_hand} saved={r.saved_with_sas} /></div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-[13px]">
                <div><dt className="text-muted">Previous</dt><dd className="money font-semibold">{peso(r.previous_funds)}</dd></div>
                <div><dt className="text-muted">Collected</dt><dd className="money font-semibold text-ok">{peso(r.collections)}</dd></div>
                <div><dt className="text-muted">Spent</dt><dd className="money font-semibold text-bad">{peso(r.expenses)}</dd></div>
              </dl>
              <div className="mt-4"><DuesBar paid={r.paid_members} members={r.members} /></div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
