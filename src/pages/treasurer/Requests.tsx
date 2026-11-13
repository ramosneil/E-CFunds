import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Plus, Receipt } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useEntityReport, useRequests } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { peso } from '../../lib/format';
import type { Enum } from '../../lib/database.types';
import { Alert, Button, Card, Empty, Field, Input, PageHeader, Sheet, Spinner } from '../../components/ui';
import { IfApproved, NoYear, RequestRow, Segmented } from '../../components/common';
import { confirmAsk } from '../../lib/confirm';

type Kind = Enum<'request_kind'>;
const KINDS: [Kind, string][] = [['remittance', 'Remit'], ['release', 'Release'], ['expense', 'Expense']];

export function Requests() {
  const { profile } = useAuth();
  const entityId = profile?.entity_id ?? 0;
  const [params, setParams] = useSearchParams();
  const year = useCurrentYear();
  const requests = useRequests({ entityId });
  const qc = useQueryClient();
  const newKind = params.get('new') as Kind | null;
  const [err, setErr] = useState('');

  async function cancel(id: number) {
    if (!(await confirmAsk({ title: 'Cancel this request?', body: 'SAS will no longer see it. You can file a new one any time.', confirm: 'Cancel request', tone: 'bad' }))) return;
    const { error } = await supabase.rpc('cancel_request', { p_request_id: id });
    if (error) setErr(errorText(error));
    void qc.invalidateQueries();
  }

  if (year.isLoading) return <Spinner />;
  if (!year.data) return <><PageHeader title="Requests" /><NoYear /></>;
  return (
    <>
      <PageHeader title="Requests" sub="Remittances, releases and expenses go to SAS for approval."
        action={<Button onClick={() => setParams({ new: 'remittance' })}><Plus className="size-5" />New</Button>} />
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {requests.isLoading ? <Spinner /> : requests.data?.length ? (
        <Card>
          <div className="divide-y divide-line">
            {requests.data.map((r) => (
              <div key={r.id}>
                <RequestRow r={r} />
                {r.status === 'pending' && <button onClick={() => cancel(r.id)} className="text-[13px] font-semibold text-bad -mt-1 mb-3 ml-14 cursor-pointer">Cancel request</button>}
                {r.remarks && r.status !== 'pending' && <p className="text-[13px] text-muted -mt-1 mb-3 ml-14">SAS: {r.remarks}</p>}
              </div>
            ))}
          </div>
        </Card>
      ) : <Card><Empty icon={<Receipt className="size-6" />} title="No requests yet">Remit cash to SAS, ask for a release, or file an expense with its receipt.</Empty></Card>}
      {newKind && <NewRequest key={newKind} initial={KINDS.some(([k]) => k === newKind) ? newKind : 'remittance'} entityId={entityId} yearId={year.data.id} onClose={() => setParams({})} />}
    </>
  );
}

function NewRequest({ initial, entityId, yearId, onClose }: { initial: Kind; entityId: number; yearId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const report = useEntityReport(yearId);
  const r = report.data?.find((x) => x.entity_id === entityId);
  const [kind, setKind] = useState<Kind>(initial);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const a = Number(amount);
  const limit = !r ? 0 : kind === 'remittance' ? r.available_to_remit : kind === 'release' ? r.available_to_release : r.cash_on_hand - r.pending_expenses - r.pending_remittances;
  const limitLabel = kind === 'remittance' ? 'Cash you can remit' : kind === 'release' ? 'Saved with SAS you can ask for' : 'Cash available for expenses';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!(a > 0)) { setErr('Enter an amount above ₱0.'); return; }
    if (desc.trim().length < 3) { setErr('Describe what this is for.'); return; }
    if (kind === 'expense' && !file) { setErr('Attach the receipt for this expense.'); return; }
    if (file && file.size > 10 * 1024 * 1024) { setErr('Attachment must be 10 MB or smaller.'); return; }
    setBusy(true); setErr('');
    try {
      let path: string | undefined;
      if (file) {
        const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-60);
        path = `${entityId}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.rpc('file_request', { p_entity_id: entityId, p_kind: kind, p_amount: a, p_description: desc.trim(), p_attachment_path: path });
      if (error) throw error;
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title="New request">
      <form onSubmit={submit} className="space-y-4">
        <Segmented value={kind} onChange={setKind} options={KINDS} />
        <p className="text-[14px] text-muted -mt-1">
          {kind === 'remittance' ? 'Hand cash on hand to SAS to keep it safe.' : kind === 'release' ? 'Get cash back from what is saved with SAS, for a budget.' : 'Record money spent from cash on hand. A receipt is required.'}
        </p>
        <Field label="Amount" hint={r ? <>{limitLabel}: <b className="money text-ink">{peso(Math.max(0, limit))}</b></> : undefined}>
          <Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="money text-[24px] h-14 font-semibold" placeholder="0.00" />
        </Field>
        <Field label="What is it for?"><Input required value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'expense' ? 'e.g. Tarpaulin for org fair' : kind === 'release' ? 'e.g. Budget for seminar' : 'e.g. Dues collected this week'} /></Field>
        <label className="flex items-center gap-3 rounded-[14px] border border-dashed border-line p-4 cursor-pointer hover:bg-surface2">
          <span className="size-10 rounded-[12px] bg-primary-soft text-primary grid place-items-center"><Paperclip className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{file ? file.name : kind === 'expense' ? 'Attach receipt (required)' : 'Attach proof (optional)'}</b>
            <span className="text-[13px] text-muted">Photo or PDF, up to 10 MB</span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {r && <IfApproved kind={kind} amount={a || 0} cash={r.cash_on_hand} saved={r.saved_with_sas} />}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Send to SAS</Button>
      </form>
    </Sheet>
  );
}
