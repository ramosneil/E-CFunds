import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Paperclip, UserCheck } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityReport, useRequests } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { CATEGORIES, categoryLabel, date, kindLabel, peso } from '../../lib/format';
import type { Enum, Row } from '../../lib/database.types';
import { Alert, Button, Card, Chip, Empty, EntityLogo, Field, Input, PageHeader, Select, Spinner, StatusChip } from '../../components/ui';
import { IfApproved, RequestRow, Segmented } from '../../components/common';
import { confirmAsk, promptAsk } from '../../lib/confirm';

export function Approvals() {
  const [params] = useSearchParams();   // the Dashboard's "accounts to approve" link opens ?tab=accounts
  const [tab, setTab] = useState<'requests' | 'accounts'>(params.get('tab') === 'accounts' ? 'accounts' : 'requests');
  const pending = useRequests({ status: 'pending' });
  const profiles = useProfiles();
  const nReq = pending.data?.length ?? 0;
  const nAcc = (profiles.data ?? []).filter((p) => p.status === 'pending').length;
  return (
    <>
      <PageHeader title="Approvals" sub="Money requests and new accounts wait here for SAS." />
      <div className="max-w-sm mb-5"><Segmented value={tab} onChange={setTab}
        options={[['requests', `Money requests · ${nReq}`], ['accounts', `Accounts · ${nAcc}`]]} /></div>
      {tab === 'requests' ? <RequestQueue /> : <AccountQueue />}
    </>
  );
}

function RequestQueue() {
  const pending = useRequests({ status: 'pending' });
  const recent = useRequests();
  const year = useCurrentYear();
  const report = useEntityReport(year.data?.id);
  const entities = useEntities();
  const byId = new Map(entities.data?.map((e) => [e.id, e]));
  if (pending.isLoading) return <Spinner />;
  const done = (recent.data ?? []).filter((r) => r.status !== 'pending').slice(0, 10);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] items-start">
      <div className="space-y-4">
        {pending.data?.length ? pending.data.map((r) => {
          const rep = report.data?.find((x) => x.entity_id === r.entity_id);
          return <ApprovalCard key={r.id} r={r} entity={byId.get(r.entity_id)} cash={rep?.cash_on_hand ?? 0} saved={rep?.saved_with_sas ?? 0} />;
        }) : <Card><Empty icon={<Inbox className="size-6" />} title="Nothing to approve">New remittance, release and expense requests from treasurers show up here.</Empty></Card>}
      </div>
      <Card>
        <h2 className="font-display text-[17px] font-bold mb-1">Recently decided</h2>
        {done.length ? <div className="divide-y divide-line">{done.map((r) => <RequestRow key={r.id} r={r} entityName={byId.get(r.entity_id)?.short_name} />)}</div>
          : <p className="text-muted text-[14px] py-4">No decisions yet.</p>}
      </Card>
    </div>
  );
}

function ApprovalCard({ r, entity, cash, saved }: { r: Row<'fund_requests'>; entity?: Row<'entities'>; cash: number; saved: number }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [category, setCategory] = useState<Enum<'expense_category'>>(r.category ?? 'other');
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [err, setErr] = useState('');

  async function decide(approve: boolean) {
    // Money moves on approval and can only be fixed later with a correction, so always confirm first.
    const what = `${entity?.short_name ?? 'this org'}’s ${peso(r.amount)} ${kindLabel[r.kind].toLowerCase()}`;
    let note = remarks.trim();
    if (approve) {
      const ok = await confirmAsk({ title: `Approve ${what}?`, body: 'The money moves right away. A mistake can only be fixed later with a correction.', confirm: 'Approve', tone: 'primary' });
      if (!ok) return;
    } else if (note.length >= 3) {
      const ok = await confirmAsk({ title: `Reject ${what}?`, body: `Reason sent to the treasurer: “${note}”`, confirm: 'Reject', tone: 'bad' });
      if (!ok) return;
    } else {
      const reason = await promptAsk({ title: `Reject ${what}?`, body: 'The treasurer sees this reason and can file again.', confirm: 'Reject', tone: 'bad',
        input: { label: 'Reason', placeholder: 'e.g. The receipt is unreadable', minLength: 3 } });
      if (!reason) return;
      note = reason.trim();
    }
    setBusy(approve ? 'yes' : 'no'); setErr('');
    const { error } = await supabase.rpc('review_request', { p_request_id: r.id, p_approve: approve, p_remarks: note || undefined,
      ...(approve && r.kind === 'expense' ? { p_category: category } : {}) });
    setBusy(null);
    if (error) { setErr(errorText(error)); return; }
    void qc.invalidateQueries();
  }
  async function openReceipt() {
    if (!r.attachment_path) return;
    // Open the tab during the click itself (phones block tabs opened after an await), then point it at the file.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(r.attachment_path, 300);
    if (error) { tab?.close(); setErr(errorText(error)); return; }
    if (tab) tab.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <EntityLogo path={entity?.logo_path ?? null} name={entity?.name ?? ''} size={44} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{kindLabel[r.kind]} · {entity?.short_name}</p>
          <p className="text-[14px] text-muted">{r.description}</p>
          <p className="text-[13px] text-muted mt-0.5">Filed {date(r.filed_at)}</p>
        </div>
        <p className="money font-display font-bold text-[22px]">{peso(r.amount)}</p>
      </div>
      {r.attachment_path && (
        <Button variant="soft" onClick={openReceipt} className="mt-3 h-11 px-4 text-[14px]"><Paperclip className="size-4" aria-hidden />{r.kind === 'expense' ? 'View receipt' : 'View proof'}</Button>
      )}
      <div className="mt-4"><IfApproved kind={r.kind} amount={Number(r.amount)} cash={Number(cash)} saved={Number(saved)} /></div>
      {r.kind === 'expense' && (
        <div className="mt-4">
          <Field label="Category" hint="Students see this category (and the purpose and amount) once approved. Change it if it doesn't fit.">
            <Select value={category} onChange={(e) => setCategory(e.target.value as Enum<'expense_category'>)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <div className="mt-4"><Field label="Note to the treasurer" hint="Optional when approving. When rejecting, you'll be asked for a reason."><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note" /></Field></div>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="danger" busy={busy === 'no'} disabled={!!busy} onClick={() => decide(false)}>Reject</Button>
        <Button busy={busy === 'yes'} disabled={!!busy} onClick={() => decide(true)}>Approve</Button>
      </div>
    </Card>
  );
}

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function AccountQueue() {
  const profiles = useProfiles();
  const entities = useEntities();
  if (profiles.isLoading) return <Spinner />;
  const pending = (profiles.data ?? []).filter((p) => p.status === 'pending');
  const others = (profiles.data ?? []).filter((p) => p.status !== 'pending');
  const name = (id: number | null) => entities.data?.find((e) => e.id === id)?.short_name ?? '—';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr] items-start">
      <div className="space-y-4">
        {pending.length ? pending.map((p) => <AccountCard key={p.id} p={p} />)
          : <Card><Empty icon={<UserCheck className="size-6" />} title="No accounts waiting">People who sign up appear here for approval.</Empty></Card>}
      </div>
      <Card>
        <h2 className="font-display text-[17px] font-bold mb-2">All accounts</h2>
        <ul className="divide-y divide-line">
          {others.map((p) => (
            <li key={p.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.full_name || p.email}</p>
                <p className="text-[13px] text-muted truncate">{p.role === 'treasurer' ? `Treasurer · ${name(p.entity_id)}` : p.role === 'admin' ? 'SAS Admin' : p.role === 'student' ? 'Student' : p.email}</p>
              </div>
              <StatusChip status={p.status} />
            </li>
          ))}
          {!others.length && <li className="py-4 text-muted text-[14px]">Nobody yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

function AccountCard({ p }: { p: Row<'profiles'> }) {
  const qc = useQueryClient();
  const entities = useEntities();
  const [role, setRole] = useState<'student' | 'treasurer' | 'admin'>(p.requested_role === 'treasurer' ? 'treasurer' : 'student');
  const [entityId, setEntityId] = useState(p.requested_entity_id ? String(p.requested_entity_id) : '');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [err, setErr] = useState('');
  const match = useQuery({
    queryKey: ['student-by-no', p.requested_student_no],
    enabled: !!p.requested_student_no,
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('*').eq('student_no', p.requested_student_no!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function decide(approve: boolean) {
    if (!approve && remarks.trim().length < 3) { setErr('Write a short reason before rejecting.'); return; }
    setBusy(approve ? 'yes' : 'no'); setErr('');
    const { error } = await supabase.rpc('review_account', {
      p_profile_id: p.id, p_approve: approve,
      p_role: approve ? role : undefined,
      p_entity_id: approve && role === 'treasurer' ? Number(entityId) : undefined,
      p_student_id: approve && role === 'student' ? match.data?.id : undefined,
      p_remarks: remarks.trim() || undefined,
    });
    setBusy(null);
    if (error) setErr(errorText(error)); else void qc.invalidateQueries({ queryKey: ['profiles'] });
  }

  const studentBlocked = role === 'student' && !match.data;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[16px] truncate">{p.full_name || 'No name given'}</p>
          <p className="text-[14px] text-muted truncate">{p.email}</p>
          <p className="text-[13px] text-muted">Signed up {date(p.created_at)}</p>
        </div>
        <Chip tone="warn">{p.requested_role ? `Asks: ${p.requested_role}` : 'No request yet'}</Chip>
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <Field label="Approve as">
          <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="student">Student</option><option value="treasurer">Treasurer</option><option value="admin">SAS Admin</option>
          </Select>
        </Field>
        {role === 'treasurer' && (
          <Field label="Organization / club">
            <Select value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Choose one</option>
              {entities.data?.filter((e) => e.is_active).map((e) => <option key={e.id} value={e.id}>{e.short_name}</option>)}
            </Select>
          </Field>
        )}
        {role === 'student' && (
          <div className="rounded-[12px] bg-surface2 p-3 text-[14px] self-end">
            <p className="text-muted text-[13px]">Student ID {p.requested_student_no ?? '—'}</p>
            {match.isLoading ? 'Checking roster…' : match.data
              ? <p className="font-semibold text-ok">On roster: {match.data.full_name}</p>
              : <p className="font-semibold text-bad">Not on any roster yet</p>}
          </div>
        )}
      </div>
      <div className="mt-3"><Field label="Remarks" hint="Required when rejecting."><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field></div>
      {studentBlocked && <p className="text-[13px] text-muted mt-2">A treasurer must add this student ID to their roster before the account can be approved as a student.</p>}
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="danger" busy={busy === 'no'} disabled={!!busy} onClick={() => decide(false)}>Reject</Button>
        <Button busy={busy === 'yes'} disabled={!!busy || studentBlocked || (role === 'treasurer' && !entityId)} onClick={() => decide(true)}>Approve</Button>
      </div>
    </Card>
  );
}
