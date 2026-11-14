import { useState } from 'react';
import { useCurrentYear, useEntities, useEntityReport } from '../../lib/data';
import { peso } from '../../lib/format';
import { Card, Chip, DuesBar, EntityLogo, PageHeader, PocketBar, Spinner } from '../../components/ui';
import { NoYear, Segmented } from '../../components/common';

/** Aggregates only (counts, totals) — the same view for every role; no transaction-level detail.
 *  Orgs/clubs with money or members first (biggest fund first); ones with nothing yet are compact rows at the end. */
export function Reports() {
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const [cat, setCat] = useState<'all' | 'organization' | 'club'>('all');
  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Reports" /><NoYear /></>;
  const logo = new Map(entities.data?.map((e) => [e.id, e.logo_path]));
  const rows = (report.data ?? []).filter((r) => cat === 'all' || r.category === cat);
  const active = (r: (typeof rows)[number]) => Number(r.total_fund) !== 0 || Number(r.collections) !== 0 || Number(r.expenses) !== 0 || r.members > 0;
  const full = rows.filter(active).sort((a, b) => Number(b.total_fund) - Number(a.total_fund));
  const empty = rows.filter((r) => !active(r));
  return (
    <>
      <PageHeader title="Reports" sub={`Every org and club · ${year.data.label}`} />
      <div className="max-w-sm mb-5"><Segmented value={cat} onChange={setCat} options={[['all', 'All'], ['organization', 'Orgs'], ['club', 'Clubs']]} /></div>
      {report.isLoading ? <Spinner /> : (<>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {full.map((r) => (
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
                <div><dt className="text-muted">Collected</dt><dd className={`money font-semibold ${r.collections ? 'text-ok' : ''}`}>{peso(r.collections)}</dd></div>
                <div><dt className="text-muted">Spent</dt><dd className={`money font-semibold ${r.expenses ? 'text-bad' : ''}`}>{peso(r.expenses)}</dd></div>
              </dl>
              <p className="micro text-muted mt-4 mb-1.5">Dues · this semester</p>
              {r.members > 0 ? <DuesBar paid={r.paid_members} members={r.members} /> : <p className="text-[13px] text-muted">No members yet</p>}
            </Card>
          ))}
        </div>
        {empty.length > 0 && (
          <Card className="mt-4 p-0">
            <p className="micro text-muted px-5 pt-4 pb-1">Nothing recorded yet · {empty.length}</p>
            <ul className="divide-y divide-line">
              {empty.map((r) => (
                <li key={r.entity_id} className="px-5 py-3 flex items-center gap-3">
                  <EntityLogo path={logo.get(r.entity_id) ?? null} name={r.name} size={32} />
                  <span className="font-semibold truncate flex-1">{r.short_name}</span>
                  <span className="money text-[14px] text-muted">{peso(0)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>)}
    </>
  );
}
