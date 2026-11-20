import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Paperclip, Plus, Receipt, RotateCcw, Signature, X } from 'lucide-react';
import { useFocusFromParam } from '../../lib/focus';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntityReport, useRequests } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { date, peso } from '../../lib/format';
import type { Row } from '../../lib/database.types';
import { Alert, Button, Card, Chip, Empty, Field, Input, PageHeader, SectionTitle, Sheet, Spinner } from '../../components/ui';
import { IfApproved, NoYear, RequestRow, Segmented } from '../../components/common';
import { confirmAsk } from '../../lib/confirm';
import { toast } from '../../lib/toast';
import { fileLabel, openPrivateFile, uploadOrgFile } from '../../lib/files';
import { ItemRows, blankItem, itemsPayload, itemsProblem, itemsTotal, type ItemLine } from '../../components/ItemRows';

// Treasurer requests (Neil, 2026-11-19): REMIT cash on hand to SAS, or send a RESOLUTION REQUEST — the signed resolution
// file only (its amount is written in the file; SAS reads it and types it when approving). An approved resolution is
// then LIQUIDATED: receipts/report files + the amount spent. Release, Expense and Budgets are no longer filed here.
type Kind = 'remittance' | 'resolution';
type Req = Row<'fund_requests'>;
const KINDS: [Kind, string][] = [['remittance', 'Remit'], ['resolution', 'Resolution request']];
const MAX_MB = 10;

export function Requests() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? 0;
  const [params, setParams] = useSearchParams();
  const year = useCurrentYear();
  const requests = useRequests({ entityId });
  const qc = useQueryClient();
  useFocusFromParam('id', 'req');   // from a notification: /requests?id=12
  const raw = params.get('new');
  const newKind: Kind | null = raw === 'remittance' ? 'remittance' : raw ? 'resolution' : null;   // old links (release/expense) open Resolution
  const [err, setErr] = useState('');
  const [again, setAgain] = useState<{ amount: string; desc: string } | null>(null);   // "File again" for a rejected remittance
  const [liq, setLiq] = useState<Req | null>(null);

  async function cancel(id: number) {
    if (!(await confirmAsk({ title: 'Cancel this request?', body: 'SAS will no longer see it. You can file a new one any time.', confirm: 'Cancel request', tone: 'bad' }))) return;
    const { error } = await supabase.rpc('cancel_request', { p_request_id: id });
    if (error) setErr(errorText(error));
    void qc.invalidateQueries();
  }
  async function view(path: string) { const e = await openPrivateFile(path); if (e) setErr(e); }

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Requests" /><NoYear /></>;
  const all = requests.data ?? [];
  const waiting = all.filter((r) => r.status === 'pending');
  const toLiquidate = all.filter((r) => r.kind === 'resolution' && r.status === 'approved' && r.liquidation_status !== 'approved');
  const done = all.filter((r) => r.status !== 'pending' && !toLiquidate.includes(r));

  const fileButton = (r: Req) => r.attachment_path && (
    <Button variant="soft" className="h-11 px-4 text-[14px]" onClick={() => view(r.attachment_path!)}>
      <FileText className="size-4" aria-hidden />{r.kind === 'resolution' ? 'View resolution' : 'View proof'}
    </Button>
  );

  return (
    <>
      <PageHeader title="Requests" sub="Remittances and resolution requests go to SAS for approval."
        action={<Button onClick={() => { setAgain(null); setParams({ new: 'remittance' }); }}><Plus className="size-5" />New</Button>} />
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {requests.isLoading ? <Spinner /> : all.length ? (
        <div className="space-y-4">
          {toLiquidate.length > 0 && (
            <Card>
              <SectionTitle>Liquidate · {toLiquidate.length}</SectionTitle>
              <p className="text-[13px] text-muted -mt-1 mb-2">After the activity, attach the receipts and report and type how much was spent. Unspent cash goes back to your savings with SAS.</p>
              <div className="divide-y divide-line">
                {toLiquidate.map((r) => (
                  <div key={r.id} data-focus={`req-${r.id}`}>
                    <RequestRow r={r} />
                    <div className="pl-14 pb-3 space-y-2">
                      <LiquidationLine r={r} />
                      <div className="flex flex-wrap gap-2">
                        {r.liquidation_status !== 'submitted' && <Button className="h-11 px-4 text-[14px]" onClick={() => setLiq(r)}>
                          {r.liquidation_status === 'returned' ? 'Fix and send again' : 'Liquidate'}</Button>}
                        {fileButton(r)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {waiting.length > 0 && (
            <Card>
              <SectionTitle>Waiting for SAS · {waiting.length}</SectionTitle>
              <div className="divide-y divide-line">
                {waiting.map((r) => (
                  <div key={r.id} data-focus={`req-${r.id}`}>
                    <RequestRow r={r} />
                    <div className="pl-14 pb-3 flex flex-wrap gap-2">
                      {fileButton(r)}
                      <button type="button" onClick={() => cancel(r.id)}
                        className="inline-flex items-center h-11 px-4 rounded-[14px] border border-line text-bad font-semibold text-[14px] hover:bg-bad-soft transition cursor-pointer">Cancel request</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {done.length > 0 && (
            <Card>
              <SectionTitle>Done</SectionTitle>
              <div className="divide-y divide-line">
                {done.map((r) => (
                  <div key={r.id} data-focus={`req-${r.id}`}>
                    <RequestRow r={r} />
                    {r.remarks && <p className="text-[13px] text-muted -mt-1 mb-2 pl-14">SAS: {r.remarks}</p>}
                    {r.kind === 'resolution' && r.liquidation_status === 'approved' && <div className="pl-14 mb-2"><LiquidationLine r={r} /></div>}
                    {r.status === 'rejected' && (r.kind === 'remittance' || r.kind === 'resolution') && (
                      <div className="pl-14 pb-3">
                        <Button variant="soft" className="h-11 px-4 text-[14px]" onClick={() => {
                          setAgain(r.kind === 'remittance' ? { amount: String(r.amount ?? ''), desc: r.description } : null);
                          setParams({ new: r.kind });
                        }}><RotateCcw className="size-4" aria-hidden />File again</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : <Card><Empty icon={<Receipt className="size-6" />} title="No requests yet">Remit cash to SAS, or send a resolution request with the signed resolution file.</Empty></Card>}
      {newKind && <NewRequest key={newKind + (again ? ':again' : '')} initial={newKind} again={again} entityId={entityId} yearId={year.data.id}
        onClose={() => { setAgain(null); setParams({}); }} />}
      {liq && <LiquidateResolution r={liq} entityId={entityId} onClose={() => setLiq(null)} />}
    </>
  );
}

/** "Liquidation sent · spent ₱70 of ₱100" / "Returned: …" / "Liquidated · ₱30 back to savings". */
function LiquidationLine({ r }: { r: Req }) {
  const released = Number(r.amount ?? 0), spent = Number(r.liquidation_spent ?? 0);
  if (!r.liquidation_status) return <p className="text-[13px] text-muted">Released {peso(released)} · not liquidated yet</p>;
  if (r.liquidation_status === 'submitted') return <p className="text-[13px]"><Chip tone="primary">Liquidation sent</Chip> <span className="text-muted">spent {peso(spent)} of {peso(released)} · waiting for SAS</span></p>;
  if (r.liquidation_status === 'returned') return <Alert tone="warn">SAS returned the liquidation: {r.liquidation_remarks}</Alert>;
  return <p className="text-[13px]"><Chip tone="ok">Liquidated</Chip> <span className="text-muted">spent {peso(spent)} of {peso(released)}{released > spent ? ` · ${peso(released - spent)} back to savings` : ''}{r.liquidated_at ? ` · ${date(r.liquidated_at)}` : ''}</span></p>;
}

function NewRequest({ initial, again, entityId, yearId, onClose }: { initial: Kind; again: { amount: string; desc: string } | null; entityId: number; yearId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const report = useEntityReport(yearId);
  const r = report.data?.find((x) => x.entity_id === entityId);
  const [kind, setKind] = useState<Kind>(initial);
  const [amount, setAmount] = useState(again?.amount ?? '');
  const [desc, setDesc] = useState(again?.desc ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const a = Number(amount);
  const max = Math.max(0, r ? r.available_to_remit : 0);
  const nothing = kind === 'remittance' && !!r && max <= 0;
  const over = kind === 'remittance' && !!r && a > max;

  function pick(f: File | null) {
    if (f && f.size > MAX_MB * 1024 * 1024) { setErr(`“${f.name}” is bigger than ${MAX_MB} MB.`); return; }
    setErr(''); setFile(f);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (kind === 'resolution') {
      if (!file) { setErr('Attach the signed resolution (photo or PDF).'); return; }
      if (!(await confirmAsk({ title: 'Send this resolution to SAS?', body: `“${file.name}”. SAS reads the amount in the file and approves or rejects it.`, confirm: 'Send to SAS', tone: 'primary' }))) return;
      setBusy(true);
      try {
        const path = await uploadOrgFile(entityId, 'res', file);
        const { error } = await supabase.rpc('file_resolution', { p_entity_id: entityId, p_path: path, p_file_name: file.name });
        if (error) throw error;
        void qc.invalidateQueries();
        toast({ title: 'Resolution sent to SAS', body: file.name, tone: 'ok', silent: true });
        onClose();
      } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
      return;
    }
    if (!(a > 0)) { setErr('Enter an amount above ₱0.00.'); return; }
    if (over || nothing) return;
    if (desc.trim().length < 3) { setErr('Describe what this is for.'); return; }
    setBusy(true);
    try {
      const path = file ? await uploadOrgFile(entityId, 'proof', file) : undefined;
      const { error } = await supabase.rpc('file_request', { p_entity_id: entityId, p_kind: 'remittance', p_amount: a, p_description: desc.trim(), p_attachment_path: path });
      if (error) throw error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="New request">
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={kind} onChange={(k) => { setKind(k); setFile(null); setErr(''); }} options={KINDS} />
        {kind === 'resolution' ? (
          <>
            <p className="text-[14px] text-muted -mt-1">Attach the signed resolution. The amount must be written in it — SAS reads the file, then approves (the money moves from your savings with SAS to your cash on hand) or rejects it with a reason.</p>
            <label className="flex items-center gap-3 rounded-[14px] border border-dashed border-line p-4 cursor-pointer hover:bg-surface2">
              <span className="size-10 rounded-[12px] bg-gold-soft text-gold-text grid place-items-center"><Signature className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{file ? file.name : 'Attach the resolution (required)'}</b>
                <span className="text-[13px] text-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · tap to change` : `Photo or PDF, up to ${MAX_MB} MB`}</span>
              </span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            </label>
            {r && <p className="text-[13px] text-muted">Saved with SAS now: <b className="money text-ink">{peso(r.saved_with_sas)}</b></p>}
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted -mt-1">Hand cash on hand to SAS to keep it safe.</p>
            {nothing && <Alert tone="warn">There is no cash on hand to remit right now (pending requests already count).</Alert>}
            {again && !nothing && <Alert tone="ok">Filled in from your rejected remittance. Fix what SAS asked for, then send it again.</Alert>}
            <Field label="Amount" hint={r ? <>Cash you can remit: <b className="money text-ink">{peso(max)}</b></> : undefined}
              error={over && !nothing ? `That’s more than you have. Cash you can remit: ${peso(max)}.` : null}>
              <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={over || undefined}
                className="money text-[24px] h-14 font-semibold" placeholder="0.00" disabled={nothing} />
            </Field>
            <Field label="What is it for?"><Input required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Dues collected this week" /></Field>
            <label className="flex items-center gap-3 rounded-[14px] border border-dashed border-line p-4 cursor-pointer hover:bg-surface2">
              <span className="size-10 rounded-[12px] bg-primary-soft text-primary grid place-items-center"><Paperclip className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{file ? file.name : 'Attach proof (optional)'}</b>
                <span className="text-[13px] text-muted">Photo or PDF, up to {MAX_MB} MB</span>
              </span>
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            </label>
            {r && !over && !nothing && <IfApproved kind="remittance" amount={a || 0} cash={r.cash_on_hand} saved={r.saved_with_sas} />}
          </>
        )}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={over || nothing || (kind === 'resolution' && !file)} className="w-full h-[54px]">Send to SAS</Button>
      </form>
    </Sheet>
  );
}

/** Liquidate an approved resolution: files (receipts, report, photos) + amount spent. */
function LiquidateResolution({ r, entityId, onClose }: { r: Req; entityId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const released = Number(r.amount ?? 0);
  const [files, setFiles] = useState<File[]>([]);
  // Activity name + receipt items (Neil, 2026-11-20): printed on the Financial Report like the SAS form.
  // The amount spent is the items' total — nothing else to type.
  const [title, setTitle] = useState(r.activity_title ?? '');
  const [lines, setLines] = useState<ItemLine[] | null>(r.liquidation_status === 'returned' ? null : [blankItem()]);
  const earlier = useQuery({   // a returned liquidation starts from the items sent before
    queryKey: ['expense-items', r.id], enabled: lines === null,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_items').select('particular, unit, qty, unit_price').eq('request_id', r.id).order('line_no');
      if (error) throw error;
      return data as { particular: string; unit: string; qty: number; unit_price: number }[];
    },
  });
  const items = lines ?? (earlier.data?.length ? earlier.data.map((i) => ({ particular: i.particular, unit: i.unit, qty: String(i.qty), price: String(i.unit_price) })) : [blankItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = itemsTotal(items);
  const valid = s <= released;

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    const big = next.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (big) { setErr(`“${big.name}” is bigger than ${MAX_MB} MB.`); return; }
    if (next.length > 10) { setErr('Attach up to 10 files.'); return; }
    setErr(''); setFiles(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr('Type the activity name (e.g. Intramurals).'); return; }
    const problem = itemsProblem(items);
    if (problem) { setErr(problem); return; }
    if (!valid) { setErr(`The items add up to ${peso(s)}, more than the ${peso(released)} released.`); return; }
    if (!files.length) { setErr('Attach the receipts or the liquidation report.'); return; }
    if (!(await confirmAsk({ title: 'Send the liquidation to SAS?', body: `${title.trim()}: spent ${peso(s)} of ${peso(released)} released (${itemsPayload(items).length} item${itemsPayload(items).length === 1 ? '' : 's'}), with ${files.length} file${files.length > 1 ? 's' : ''}.${released > s ? ` ${peso(released - s)} goes back to your savings with SAS when it is approved.` : ''}`, confirm: 'Send', tone: 'primary' }))) return;
    setBusy(true); setErr('');
    try {
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadOrgFile(entityId, `liq-r${r.id}`, f));
      const { error } = await supabase.rpc('submit_resolution_liquidation', { p_request_id: r.id, p_files: paths, p_title: title.trim(), p_items: itemsPayload(items) });
      if (error) throw error;
      void qc.invalidateQueries();
      toast({ title: 'Liquidation sent to SAS', body: title.trim(), tone: 'ok', silent: true });
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="Liquidate resolution">
      <form onSubmit={submit} className="space-y-4">
        <p className="font-semibold">{r.file_name ?? 'Resolution'} <span className="text-muted font-normal">· approved {r.reviewed_at ? date(r.reviewed_at) : ''}</span></p>
        {r.liquidation_status === 'returned' && <Alert tone="warn">SAS returned it: {r.liquidation_remarks}</Alert>}
        <dl className="grid grid-cols-3 gap-2 rounded-[16px] bg-surface2 p-4 text-[13px]">
          <div><dt className="text-muted">Released</dt><dd className="money font-semibold text-[16px]">{peso(released)}</dd></div>
          <div><dt className="text-muted">Spent (items)</dt><dd className={`money font-semibold text-[16px] ${valid ? '' : 'text-bad'}`}>{peso(s)}</dd></div>
          <div><dt className="text-muted">Back to savings</dt><dd className="money font-semibold text-[16px]">{valid ? peso(released - s) : '—'}</dd></div>
        </dl>
        {!valid && <Alert>The items add up to {peso(s)}, more than the {peso(released)} released.</Alert>}
        <Field label="Activity name" hint="The heading on the Financial Report, e.g. SimuLIT, Intramurals, Tarpaulin.">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Intramurals" />
        </Field>
        <div>
          <p className="text-[14px] font-semibold">Items on the receipts</p>
          <p className="text-[13px] text-muted mb-2">One line per item: Particular, Unit, Quantity, Unit price. The total is worked out for you.</p>
          {lines === null && earlier.isLoading ? <Spinner label="Loading the items you sent" /> : <ItemRows lines={items} onChange={setLines} disabled={busy} />}
        </div>
        <div>
          <p className="text-[14px] font-semibold">Files <span className="text-muted font-normal">(required, up to 10)</span></p>
          <p className="text-[13px] text-muted mb-2">Photos or PDFs: official receipts, liquidation report, attendance, activity photos.</p>
          {files.length > 0 && (
            <ul className="space-y-2 mb-2">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-[12px] bg-surface2 pl-3 text-[14px]">
                  <Paperclip className="size-4 text-muted shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0 truncate">{f.name}</span>
                  <span className="text-[12px] text-muted shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="size-11 grid place-items-center rounded-full hover:bg-surface cursor-pointer"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
          {files.length < 10 && (
            <label className="inline-flex items-center gap-2 h-11 px-4 rounded-[14px] border border-line text-primary font-semibold text-[14px] cursor-pointer hover:bg-surface2">
              <Paperclip className="size-4" aria-hidden />Attach files
              <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            </label>
          )}
          {r.liquidation_files.length > 0 && files.length === 0 && (
            <p className="text-[13px] text-muted mt-2">Sent before: {r.liquidation_files.map(fileLabel).join(', ')}. Attach them again with the fixes.</p>
          )}
        </div>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Send liquidation</Button>
      </form>
    </Sheet>
  );
}
