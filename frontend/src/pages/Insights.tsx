// Insights (Neil, 2026-11-25): the business-style finance dashboard — "Whole school" plus one per org/club, the same
// layout for each — for SAS, treasurers and students (everything except receipts). Present mode shows it as slides.
// Data: get_entity_report (fund, pockets, dues), get_school_finance / get_entity_finance (flows, categories, expenses,
// activities — migration 47). Nothing here changes money; it only reads.
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { MonitorPlay } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useCurrentYear, useEntities, useEntityFinance, useEntityReport, useSchoolFinance } from '../lib/data';
import { categoryLabel, peso } from '../lib/format';
import type { Finance } from '../lib/database.types';
import { Button, Card, Chip, EntityLogo, PageHeader, Select, Spinner } from '../components/ui';
import { NoYear } from '../components/common';
import { ExpenseList, MoneyInOut, SpendingByCategory } from '../components/finance/FinancePanel';
import { KpiTiles, kpisFor, lastTwo } from '../components/finance/KpiTiles';
import { BalanceTrend, balanceSentence } from '../components/finance/BalanceTrend';
import { BudgetVsActual, activityTotals } from '../components/finance/BudgetVsActual';
import { CashSaved, CompareEntities } from '../components/finance/CompareEntities';
import { Present, type Slide } from '../components/finance/Present';
import { n } from '../components/finance/chartKit';

/** Card with a title and one plain sentence saying what the chart means. */
function Panel({ title, says, children, className = '' }: { title: string; says?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <h2 className="font-display text-[17px] font-bold">{title}</h2>
      {says && <p className="text-[13.5px] text-muted mt-0.5 mb-3">{says}</p>}
      {!says && <div className="mb-3" />}
      {children}
    </Card>
  );
}

function spendSentence(f: Finance) {
  const top = [...f.categories].sort((a, b) => n(b.amount) - n(a.amount))[0];
  const inn = n(f.money_in), out = n(f.money_out);
  if (out <= 0) return `Nothing spent yet — all ${peso(inn)} collected is still in the fund.`;
  const per100 = inn > 0 ? Math.round((out / inn) * 100) : 0;
  return `Of every ₱100 collected, ₱${per100} was spent${top ? `, most on ${(categoryLabel[top.category] ?? 'other').toLowerCase()}` : ''}.`;
}

function flowSentence(f: Finance) {
  const t = lastTwo(f.monthly);
  if (!t.month) return '';
  const net = t.inNow - t.outNow;
  return `This month: ${peso(t.inNow)} in, ${peso(t.outNow)} out (${net >= 0 ? `+${peso(net)}` : `−${peso(-net)}`}).`;
}

export function Insights() {
  const { profile } = useAuth();
  const year = useCurrentYear();
  const entities = useEntities();
  const report = useEntityReport(year.data?.id);
  const [params, setParams] = useSearchParams();
  const [presenting, setPresenting] = useState(false);

  // Scope: ?org=<id> or the whole school. A treasurer starts on their own org/club.
  const raw = params.get('org');
  const own = profile?.role === 'treasurer' ? profile.entity_id ?? null : null;
  const entityId = raw === 'school' ? null : raw ? Number(raw) : own;
  const setScope = (v: string) => setParams(v === 'school' ? { org: 'school' } : { org: v }, { replace: true });

  const yid = year.data?.id;
  const entityFin = useEntityFinance(entityId ?? undefined, yid);
  const schoolFin = useSchoolFinance(entityId ? undefined : yid);
  const fin = entityId ? entityFin : schoolFin;
  const f = fin.data;

  const rows = report.data ?? [];
  const e = entities.data?.find((x) => x.id === entityId);
  const r = rows.find((x) => x.entity_id === entityId);
  const logos = useMemo(() => new Map((entities.data ?? []).map((x) => [x.id, x.logo_path])), [entities.data]);
  const k = kpisFor(entityId ? (r ? [r] : []) : rows, f);
  const name = entityId ? e?.short_name ?? 'Org / club' : 'Whole school';
  const orgs = (entities.data ?? []).filter((x) => x.category !== 'club').sort((a, b) => a.short_name.localeCompare(b.short_name));
  const clubs = (entities.data ?? []).filter((x) => x.category === 'club').sort((a, b) => a.short_name.localeCompare(b.short_name));

  if (year.isLoading || entities.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Insights" /><NoYear /></>;
  const ready = !!f && !report.isLoading && (!entityId || !!r);
  const acts = f?.activities ?? [];
  const at = activityTotals(acts);

  const slides: Slide[] = !ready || !f ? [] : [
    { kicker: `Insights · School year ${year.data.label}`, title: entityId ? e?.name ?? name : 'All organizations and clubs',
      note: balanceSentence(f.monthly, k.fund),
      body: <div className="max-w-3xl"><p className="micro text-muted">Fund balance</p><p className="money font-display font-extrabold text-[56px] sm:text-[88px] leading-none mt-2">{peso(k.fund)}</p><div className="mt-8"><CashSaved cash={k.cash} saved={k.saved} big /></div></div> },
    { kicker: 'Headline numbers', title: 'Where we stand', note: flowSentence(f), body: <KpiTiles k={k} monthly={f.monthly} big /> },
    { kicker: 'Trend', title: 'Fund balance over time', note: balanceSentence(f.monthly, k.fund), body: <BalanceTrend monthly={f.monthly} fund={k.fund} tall /> },
    { kicker: 'Cash flow', title: 'Money in and out by month', note: flowSentence(f), body: <MoneyInOut monthly={f.monthly} /> },
    { kicker: 'Spending', title: 'What it was spent on', note: spendSentence(f),
      body: f.categories.length ? <div className="max-w-3xl text-[18px]"><SpendingByCategory categories={f.categories} /></div> : <p className="text-[20px] text-muted">Nothing spent yet this school year.</p> },
    entityId
      ? { kicker: 'Activities', title: 'Budget vs actual', note: acts.length ? `${acts.length} activit${acts.length === 1 ? 'y' : 'ies'} · ${peso(at.spent)} spent of ${peso(at.approved)} approved · ${peso(at.returned)} returned to savings.` : undefined,
          body: <BudgetVsActual activities={acts} big /> }
      : { kicker: 'Comparison', title: 'Orgs and clubs side by side', note: 'Each fund split into cash on hand and savings with SAS, biggest first.',
          body: <div className="max-w-4xl"><CompareEntities rows={rows} logos={logos} big /></div> },
    { kicker: 'Summary', title: 'In short', body: (
      <ul className="space-y-4 text-[18px] sm:text-[24px] max-w-[46ch] list-disc pl-6">
        <li>{balanceSentence(f.monthly, k.fund)}</li>
        <li>{spendSentence(f)}</li>
        {k.members > 0 && <li>{Math.round((k.paid / k.members) * 100)}% of members paid their dues this semester ({k.paid} of {k.members}).</li>}
        {entityId && acts.length > 0 && <li>{acts.filter((a) => a.state === 'liquidated').length} of {acts.length} activities fully liquidated.</li>}
        <li>Cash on hand {peso(k.cash)} · saved with SAS {peso(k.saved)}.</li>
      </ul>) },
  ];

  return (
    <>
      <PageHeader title="Insights" eyebrow={`School year ${year.data.label}`}
        sub={entityId ? 'One org or club: its fund, cash flow, spending and activities.' : 'Every org and club together, and how they compare.'}
        action={<Button onClick={() => setPresenting(true)} disabled={!ready}><MonitorPlay className="size-5" aria-hidden />Present</Button>} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        {entityId && e ? <EntityLogo path={e.logo_path} name={e.name} size={44} /> : null}
        <label className="min-w-0 flex-1 sm:flex-none sm:w-80">
          <span className="sr-only">Show the dashboard of</span>
          <Select value={entityId ? String(entityId) : 'school'} onChange={(ev) => setScope(ev.target.value)}>
            <option value="school">Whole school (all orgs and clubs)</option>
            <optgroup label="Organizations">{orgs.map((x) => <option key={x.id} value={x.id}>{x.short_name}{x.id === own ? ' (yours)' : ''}</option>)}</optgroup>
            <optgroup label="Clubs">{clubs.map((x) => <option key={x.id} value={x.id}>{x.short_name}{x.id === own ? ' (yours)' : ''}</option>)}</optgroup>
          </Select>
        </label>
        {entityId && e && e.name !== e.short_name && <p className="text-[13.5px] text-muted basis-full sm:basis-auto">{e.name}</p>}
        {entityId && e?.is_school_wide && <Chip tone="primary">School-wide</Chip>}
      </div>

      {!ready || !f ? <Spinner label="Adding up the numbers" /> : (
        <div className="space-y-4">
          <KpiTiles k={k} monthly={f.monthly} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel title="Fund balance over time" says={balanceSentence(f.monthly, k.fund)}><BalanceTrend monthly={f.monthly} fund={k.fund} /></Panel>
            <Panel title="Money in and out by month" says={flowSentence(f)}><MoneyInOut monthly={f.monthly} /></Panel>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel title="Where the money is now" says={entityId ? 'Cash the treasurer holds, and savings kept by SAS.' : 'Cash held by treasurers, and savings kept by SAS, for all orgs and clubs.'}>
              <CashSaved cash={k.cash} saved={k.saved} />
            </Panel>
            <Panel title="What it was spent on" says={spendSentence(f)}>
              {f.categories.length ? <SpendingByCategory categories={f.categories} /> : <p className="text-[14px] text-muted">Nothing spent yet this school year.</p>}
            </Panel>
          </div>
          {entityId ? (<>
            <Panel title="Budget vs actual" says={acts.length ? `${acts.length} activit${acts.length === 1 ? 'y' : 'ies'} · ${peso(at.spent)} spent of ${peso(at.approved)} approved · ${peso(at.returned)} returned to savings.` : 'Approved resolution requests and activity budgets, with what was spent.'}>
              <BudgetVsActual activities={acts} />
            </Panel>
            <Panel title="Approved expenses" says="Every expense SAS approved this school year, newest first.">
              {f.expenses?.length ? <ExpenseList expenses={f.expenses} /> : <p className="text-[14px] text-muted">No approved expenses yet this school year.</p>}
            </Panel>
          </>) : (
            <Panel title="Compare orgs and clubs" says="Tap one to open its own dashboard.">
              <CompareEntities rows={rows} logos={logos} onOpen={(id) => { setScope(String(id)); window.scrollTo({ top: 0 }); }} />
            </Panel>
          )}
          <p className="text-[12.5px] text-muted">
            Collected and spent count dues and approved expenses only; moving money between cash and savings isn't spending. Receipt files stay with SAS and the treasurer.
          </p>
        </div>
      )}
      {presenting && ready && <Present slides={slides} label={`${name} · ${year.data.label}`} onClose={() => setPresenting(false)} />}
    </>
  );
}
