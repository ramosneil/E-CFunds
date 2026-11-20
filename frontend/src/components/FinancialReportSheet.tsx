// "Financial report (SAS form)": pick the period → see the numbers → type the cash count → check signatories →
// Download PDF. Numbers come from get_financial_report (migrations 34–35); nothing here is typed except the count.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, Download, FileText } from 'lucide-react';
import { supabase, errorText } from '../lib/supabase';
import { useEntities, useSemesters } from '../lib/data';
import { peso } from '../lib/format';
import type { FinancialReport } from '../lib/database.types';
import { Alert, Button, Card, Field, Input, Select, Sheet, Spinner } from './ui';
import { toast } from '../lib/toast';

const DENOMS = [1000, 500, 200, 100, 50, 20] as const;
const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

export function FinancialReportButton({ entityId, yearId, className }: { entityId: number; yearId: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="soft" className={className ?? 'h-11 px-4'} onClick={() => setOpen(true)}><FileText className="size-4" aria-hidden />Financial report</Button>
      {open && <FinancialReportSheet entityId={entityId} yearId={yearId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function FinancialReportSheet({ entityId, yearId, onClose }: { entityId: number; yearId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const sems = useSemesters(yearId);
  const [period, setPeriod] = useState<string>('');           // semester id, or 'year'
  const [asOf, setAsOf] = useState(manilaToday());
  const [count, setCount] = useState<Record<number, string>>({});
  const [coins, setCoins] = useState('');
  const [skipCount, setSkipCount] = useState(false);
  const [sig, setSig] = useState({ head_title: 'Mayor', head_name: '', auditor_name: '', adviser_name: '' });
  const [sigDirty, setSigDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!period && sems.data?.length) setPeriod(String((sems.data.find((x) => x.is_current) ?? sems.data[0]).id));
  }, [sems.data, period]);

  const report = useQuery({
    queryKey: ['financial-report', entityId, period, asOf],
    enabled: !!period && !!asOf,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_financial_report', {
        p_entity_id: entityId, ...(period !== 'year' ? { p_semester_id: Number(period) } : {}), p_as_of: asOf,
      });
      if (error) throw error;
      return data as FinancialReport;
    },
  });
  // Club or organization decides the signatory lines (Neil, 2026-11-19); the report itself doesn't carry it.
  const entities = useEntities();
  const category = entities.data?.find((e) => e.id === entityId)?.category;
  const r = report.data ? { ...report.data, entity: { ...report.data.entity, category } } : undefined;
  const kind: 'ssg' | 'club' | 'org' = r?.entity.is_school_wide ? 'ssg' : category === 'club' ? 'club' : 'org';
  const headTitle = kind === 'ssg' ? 'Governor' : 'Mayor';

  // Load the saved signatories once.
  useEffect(() => {
    const r = report.data;
    if (!r || sigDirty) return;
    const s = r.signatories;
    setSig({ head_title: headTitle, head_name: s?.head_name ?? '', auditor_name: s?.auditor_name ?? '', adviser_name: s?.adviser_name ?? '' });
  }, [report.data, sigDirty]);   // eslint-disable-line react-hooks/exhaustive-deps

  const counted = DENOMS.reduce((t, d) => t + d * (Number(count[d]) || 0), 0) + (Number(coins) || 0);
  const anyCount = DENOMS.some((d) => count[d]) || !!coins;
  const diff = r ? Math.round((counted - Number(r.cash_on_hand)) * 100) / 100 : 0;

  async function saveSig() {
    const { error } = await supabase.rpc('save_signatories', { p_entity_id: entityId, p_head_title: headTitle, p_head_name: kind === 'club' ? '' : sig.head_name,
      p_auditor_name: sig.auditor_name, p_adviser_name: sig.adviser_name });
    if (error) throw error;
    setSigDirty(false);
    void qc.invalidateQueries({ queryKey: ['financial-report'] });
  }

  async function download() {
    if (!r) return;
    if (!skipCount && !anyCount) { setErr('Type the cash count (how many of each bill, and the coins), or tick “Leave the cash count blank”.'); return; }
    setBusy(true); setErr('');
    try {
      if (sigDirty) await saveSig();
      const fresh = sigDirty ? (await supabase.rpc('get_financial_report', { p_entity_id: entityId, ...(period !== 'year' ? { p_semester_id: Number(period) } : {}), p_as_of: asOf })).data as FinancialReport : r;
      const { financialReportPdf } = await import('../lib/export/financialReport');
      await financialReportPdf(fresh ? { ...fresh, entity: { ...fresh.entity, category } } : r, skipCount ? null : { bills: Object.fromEntries(DENOMS.map((d) => [d, Number(count[d]) || 0])), coins: Number(coins) || 0 });
      toast({ title: 'Financial report ready', body: `${r.entity.short_name} · as of ${asOf}`, tone: 'ok', silent: true });
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="Financial report">
      <div className="space-y-4">
        <p className="text-[14px] text-muted -mt-1">The SAS form, filled in from your recorded payments and approved expenses. Only the cash count is typed.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Period">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {sems.data?.map((x) => <option key={x.id} value={x.id}>{x.term === 1 ? '1st' : x.term === 2 ? '2nd' : 'Summer'} semester</option>)}
              <option value="year">Whole school year</option>
            </Select>
          </Field>
          <Field label="As of"><Input type="date" value={asOf} max={manilaToday()} onChange={(e) => setAsOf(e.target.value)} /></Field>
        </div>

        {report.isLoading ? <Spinner label="Adding up the transactions" /> : report.error ? <Alert>{errorText(report.error)}</Alert> : r && (
          <>
            <Card className="p-4 space-y-1.5 text-[14px]">
              <Row label="Previous fund" v={r.previous_fund} />
              <Row label={`Membership fees (${r.membership.paid} paid · ${r.membership.unpaid} remaining)`} v={r.total_collection} />
              <Row label={`Expenses (${r.expense_groups.length} activit${r.expense_groups.length === 1 ? 'y' : 'ies'})`} v={-Number(r.total_expenses)} />
              {Math.abs(Number(r.adjustments)) >= 0.005 && <Row label="Adjustments by SAS" v={r.adjustments} />}
              <div className="border-t border-line pt-1.5"><Row label="Total remaining fund" v={r.remaining_fund} bold /></div>
              <p className="text-[13px] text-muted">Cash on hand {peso(r.cash_on_hand)} · saved with SAS {peso(r.saved_with_sas)}</p>
            </Card>

            <div>
              <p className="text-[14px] font-semibold mb-1">Cash count</p>
              <p className="text-[13px] text-muted mb-2">Count the cash you are holding: how many of each bill, and the coins’ total.</p>
              <div className="grid grid-cols-3 gap-2">
                {DENOMS.map((d) => (
                  <label key={d} className="block">
                    <span className="text-[12px] text-muted">₱{d.toLocaleString('en-PH')} ×</span>
                    <Input inputMode="numeric" value={count[d] ?? ''} onChange={(e) => setCount({ ...count, [d]: e.target.value.replace(/\D/g, '') })} placeholder="0" disabled={skipCount} aria-label={`Number of ${d} peso bills`} />
                  </label>
                ))}
              </div>
              <label className="block mt-2">
                <span className="text-[12px] text-muted">Coins (₱ total)</span>
                <Input inputMode="decimal" value={coins} onChange={(e) => setCoins(e.target.value)} placeholder="0.00" disabled={skipCount} className="money" aria-label="Coins total in pesos" />
              </label>
              {!skipCount && anyCount && (
                <p className={`mt-2 text-[14px] flex items-center gap-2 font-semibold ${diff === 0 ? 'text-ok' : 'text-warn'}`}>
                  {diff === 0 ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
                  Counted {peso(counted)}{diff === 0 ? ' — matches the cash on hand' : ` — ${peso(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than the ${peso(r.cash_on_hand)} on record`}
                </p>
              )}
              <label className="mt-2 flex items-center gap-2 text-[14px] min-h-11 cursor-pointer">
                <input type="checkbox" checked={skipCount} onChange={(e) => setSkipCount(e.target.checked)} className="size-5 accent-[var(--primary)]" />
                Leave the cash count blank (fill it in by hand)
              </label>
            </div>

            <div>
              <p className="text-[14px] font-semibold mb-1">Signatories</p>
              <p className="text-[13px] text-muted mb-2">Saved for the whole school year. Prepared by: {r.treasurer_name ?? 'the treasurer'} (from the account).
</p>
              <ol className="text-[13px] text-muted mb-3 list-decimal pl-5 space-y-0.5">
                {(kind === 'club'
                  ? ['Club treasurer', 'Club auditor', 'SSG auditor', 'SSG governor', 'Club adviser', 'SAS coordinator']
                  : kind === 'org'
                    ? ['Org treasurer', 'Mayor of the organization', 'Org auditor', 'SSG auditor', 'SSG governor', 'Org adviser', 'SAS coordinator']
                    : ['SSG treasurer', 'SSG governor', 'SSG auditor', 'SSG adviser', 'SAS coordinator']).map((x) => <li key={x}>{x}</li>)}
              </ol>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kind === 'org' && <Field label={`${headTitle} (name)`}><Input value={sig.head_name} maxLength={80} onChange={(e) => { setSig({ ...sig, head_name: e.target.value }); setSigDirty(true); }} placeholder="e.g. Hannah C. Alfaro" /></Field>}
                {kind !== 'ssg' && <Field label={`${kind === 'club' ? 'Club' : 'Org'} auditor (name)`}><Input value={sig.auditor_name} maxLength={80} onChange={(e) => { setSig({ ...sig, auditor_name: e.target.value }); setSigDirty(true); }} /></Field>}
                <Field label={`${kind === 'club' ? 'Club' : kind === 'ssg' ? 'SSG' : 'Org'} adviser (name)`}><Input value={sig.adviser_name} maxLength={80} onChange={(e) => { setSig({ ...sig, adviser_name: e.target.value }); setSigDirty(true); }} /></Field>
              </div>
              <p className="text-[13px] text-muted mt-2">Set by SAS (School year page): SSG governor {r.settings.ssg_governor_name ?? '— not set yet'} ·
                SSG auditor {r.settings.ssg_auditor_name ?? '— not set yet'} · SAS Coordinator {r.settings.coordinator_name ?? '— not set yet'}.</p>
            </div>
          </>
        )}
        {err && <Alert>{err}</Alert>}
        <Button className="w-full h-[54px]" busy={busy} disabled={!r} onClick={download}><Download className="size-5" aria-hidden />Download PDF</Button>
      </div>
    </Sheet>
  );
}

function Row({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  return (
    <p className={`flex justify-between gap-3 ${bold ? 'font-semibold' : ''}`}>
      <span className="min-w-0">{label}</span><span className="money whitespace-nowrap">{peso(v)}</span>
    </p>
  );
}

/** SAS: the report header lines and the SAS Coordinator (School year page). */
export function ReportSettingsCard() {
  const qc = useQueryClient();
  const st = useQuery({
    queryKey: ['report-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('report_settings').select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (st.data && !f) setF({ website: st.data.website ?? '', email: st.data.email ?? '', phone: st.data.phone ?? '',
      coordinator_name: st.data.coordinator_name ?? '', coordinator_title: st.data.coordinator_title,
      ssg_governor_name: st.data.ssg_governor_name ?? '', ssg_auditor_name: st.data.ssg_auditor_name ?? '' });
  }, [st.data, f]);
  if (!f) return null;
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('save_report_settings', { p: f });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries({ queryKey: ['report-settings'] });
    void qc.invalidateQueries({ queryKey: ['financial-report'] });
    toast({ title: 'Saved', body: 'Financial report header & signers', tone: 'ok', silent: true });
  }
  return (
    <Card>
      <h2 className="font-display text-[17px] font-bold">Financial report — header & signers</h2>
      <p className="text-[14px] text-muted mt-1 mb-4">Printed on every org/club's Financial Report (the SAS form). The SSG governor and SSG auditor sign every club, org and SSG report.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Website"><Input value={f.website} onChange={set('website')} /></Field>
        <Field label="Email address"><Input value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="SAS Coordinator (name)"><Input value={f.coordinator_name} onChange={set('coordinator_name')} placeholder="e.g. Cristina A. Caponpon, PhD" /></Field>
        <Field label="Title"><Input value={f.coordinator_title} onChange={set('coordinator_title')} /></Field>
        <div className="hidden sm:block" />
        <Field label="SSG governor (name)"><Input value={f.ssg_governor_name} maxLength={80} onChange={set('ssg_governor_name')} placeholder="e.g. Juan Dela Cruz" /></Field>
        <Field label="SSG auditor (name)"><Input value={f.ssg_auditor_name} maxLength={80} onChange={set('ssg_auditor_name')} placeholder="e.g. Ana Reyes" /></Field>
      </div>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      <Button className="mt-4" busy={busy} onClick={save}>Save</Button>
    </Card>
  );
}
