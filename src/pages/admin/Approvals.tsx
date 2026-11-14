import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Inbox, Paperclip, Search, UserCheck } from 'lucide-react';
import { useCurrentYear, useEntities, useEntityReport, useRequests } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { CATEGORIES, categoryLabel, date, kindLabel, peso } from '../../lib/format';
import type { Enum, Row } from '../../lib/database.types';
import { Alert, Button, Card, Chip, Empty, EntityLogo, Field, Input, PageHeader, Select, Spinner, StatusChip } from '../../components/ui';
import { IfApproved, RequestRow, Segmented } from '../../components/common';
import { confirmAsk, promptAsk } from '../../lib/confirm';
import { useAuth } from '../../lib/auth';
import { BudgetDecisionCard, useBudgets } from '../../components/budgets';
import { ExpenseItemList } from '../../components/ItemRows';

export function Approvals() {
  const [params] = useSearchParams();   // the Dashboard's "accounts to approve" link opens ?tab=accounts
  const t = params.get('tab');
  const [tab, setTab] = useState<'requests' | 'budgets' | 'accounts'>(t === 'accounts' || t === 'budgets' ? t : 'requests');
  const pending = useRequests({ status: 'pending' });
  const profiles = useProfiles();
  const budgets = useBudgets();
  const nReq = pending.data?.length ?? 0;
  const nBud = (budgets.data ?? []).filter((b) => b.status === 'pending' || b.status === 'liquidation_submitted').length;
  const nAcc = (profiles.data ?? []).filter((p) => p.status === 'pending').length;
  return (
    <>
      <PageHeader title="Approvals" sub="Money requests, activity budgets and new accounts wait here for SAS." />
      <div className="max-w-lg mb-5"><Segmented value={tab} onChange={setTab}
        options={[['requests', `Money · ${nReq}`], ['budgets', `Budgets · ${nBud}`], ['accounts', `Accounts · ${nAcc}`]]} /></div>
      {tab === 'requests' ? <RequestQueue /> : tab === 'budgets' ? <BudgetQueue /> : <AccountQueue />}
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

function BudgetQueue() {
  const budgets = useBudgets();
  const entities = useEntities();
  const byId = new Map(entities.data?.map((e) => [e.id, e]));
  if (budgets.isLoading) return <Spinner />;
  const all = budgets.data ?? [];
  const waiting = all.filter((b) => b.status === 'pending' || b.status === 'liquidation_submitted');
  const overdue = all.filter((b) => b.is_overdue);
  const open = all.filter((b) => b.status === 'approved' && !b.is_overdue);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr] items-start">
      <div className="space-y-4">
        {waiting.length ? waiting.map((b) => <BudgetDecisionCard key={b.id} b={b} entity={byId.get(b.entity_id)} />)
          : <Card><Empty icon={<ClipboardList className="size-6" />} title="No budgets or liquidations waiting">Activity budgets and liquidation reports from treasurers show up here.</Empty></Card>}
      </div>
      <div className="space-y-4">
        {overdue.length > 0 && (
          <Card>
            <h2 className="font-display text-[17px] font-bold mb-1 text-bad">Liquidation overdue · {overdue.length}</h2>
            <p className="text-[13px] text-muted mb-2">These orgs/clubs get no new releases until they liquidate.</p>
            <ul className="divide-y divide-line">{overdue.map((b) => <li key={b.id} className="py-2 text-[14px]"><b>{byId.get(b.entity_id)?.short_name}</b> · {b.title} <span className="text-muted">· due {date(b.liquidation_due)}</span></li>)}</ul>
          </Card>
        )}
        <Card>
          <h2 className="font-display text-[17px] font-bold mb-1">Approved, not yet liquidated</h2>
          {open.length ? <ul className="divide-y divide-line">{open.map((b) => (
            <li key={b.id} className="py-2 text-[14px] flex gap-3"><span className="flex-1 min-w-0"><b>{byId.get(b.entity_id)?.short_name}</b> · {b.title}<span className="block text-[13px] text-muted">Due {date(b.liquidation_due)} · released {peso(b.released)} of {peso(b.total)}</span></span></li>
          ))}</ul> : <p className="text-muted text-[14px] py-2">None.</p>}
        </Card>
      </div>
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
          {r.budget_id && <RequestBudget id={r.budget_id} />}
          <p className="text-[13px] text-muted mt-0.5">Filed {date(r.filed_at)}</p>
        </div>
        <p className="money font-display font-bold text-[22px]">{peso(r.amount)}</p>
      </div>
      {r.kind === 'expense' && <div className="mt-3"><ExpenseItemList requestId={r.id} /></div>}
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

/** "Budget: Seminar · ₱1,300 · ₱300 left" under a request that names a budget. */
function RequestBudget({ id }: { id: number }) {
  const budgets = useBudgets();
  const b = budgets.data?.find((x) => x.id === id);
  if (!b) return null;
  const left = Number(b.total) - Number(b.released);
  return <p className="text-[13px] mt-0.5"><span className="text-muted">Budget:</span> <b>{b.title}</b> · {peso(b.total)} · {peso(left)} not yet released{b.is_overdue ? ' · overdue' : ''}</p>;
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
      <AllAccounts others={others} name={name} />
    </div>
  );
}

/** Every account that isn't waiting: search, filter by role, and disable / enable (SAS). */
function AllAccounts({ others, name }: { others: Row<'profiles'>[]; name: (id: number | null) => string }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'treasurer' | 'student' | 'admin'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const studentNos = useQuery({
    queryKey: ['students', 'numbers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('id, student_no');
      if (error) throw error;
      return new Map(data.map((s) => [s.id, s.student_no]));
    },
  });
  const s = q.trim().toLowerCase();
  const list = others.filter((p) => (role === 'all' || p.role === role)
    && (!s || [p.full_name, p.email, name(p.entity_id), p.student_id ? studentNos.data?.get(p.student_id) : ''].some((v) => (v ?? '').toLowerCase().includes(s))));

  async function disable(p: Row<'profiles'>) {
    const reason = await promptAsk({
      title: `Disable ${p.full_name || p.email}?`, confirm: 'Disable', tone: 'bad',
      body: 'They can no longer sign in, and their phone stops getting notifications. You can enable the account again later.',
      input: { label: 'Reason', placeholder: p.role === 'treasurer' ? 'e.g. Term ended' : 'e.g. Graduated', minLength: 3 },
    });
    if (!reason) return;
    setBusy(p.id); setErr('');
    const { error } = await supabase.rpc('disable_account', { p_profile_id: p.id, p_remarks: reason.trim() });
    setBusy(null);
    if (error) setErr(errorText(error)); else void qc.invalidateQueries();
  }
  async function enable(p: Row<'profiles'>) {
    if (!(await confirmAsk({ title: `Enable ${p.full_name || p.email} again?`, body: 'They can sign in again with the same role.', confirm: 'Enable', tone: 'primary' }))) return;
    setBusy(p.id); setErr('');
    const { error } = await supabase.rpc('enable_account', { p_profile_id: p.id });
    setBusy(null);
    if (error) setErr(errorText(error)); else void qc.invalidateQueries();
  }

  return (
    <Card>
      <h2 className="font-display text-[17px] font-bold mb-3">All accounts · {others.length}</h2>
      <div className="relative mb-2">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, org or Student ID" aria-label="Search accounts"
          className="w-full h-11 pl-9 pr-3 rounded-[12px] bg-surface2 border border-transparent focus:border-primary outline-none text-[14px]" />
      </div>
      <div className="mb-2"><Segmented value={role} onChange={setRole} options={[['all', 'All'], ['treasurer', 'Treasurers'], ['student', 'Students'], ['admin', 'SAS']]} /></div>
      {err && <div className="my-2"><Alert>{err}</Alert></div>}
      <ul className="divide-y divide-line">
        {list.map((p) => (
          <li key={p.id} className="py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{p.full_name || p.email}</p>
              <p className="text-[13px] text-muted truncate">
                {p.role === 'treasurer' ? `Treasurer · ${name(p.entity_id)}` : p.role === 'admin' ? 'SAS Admin'
                  : p.role === 'student' ? `Student${p.student_id && studentNos.data?.get(p.student_id) ? ` · ${studentNos.data.get(p.student_id)}` : ''}` : p.email}
              </p>
              {p.status === 'disabled' && p.review_remarks && <p className="text-[12.5px] text-muted truncate">Reason: {p.review_remarks}</p>}
            </div>
            <StatusChip status={p.status} />
            {p.status === 'approved' && p.id !== session?.user.id && (
              <button onClick={() => disable(p)} disabled={busy === p.id}
                className="h-11 px-3 rounded-[12px] border border-line text-bad font-semibold text-[13px] hover:bg-bad-soft cursor-pointer disabled:opacity-50">Disable</button>
            )}
            {p.status === 'disabled' && (
              <button onClick={() => enable(p)} disabled={busy === p.id}
                className="h-11 px-3 rounded-[12px] bg-primary-soft text-primary font-semibold text-[13px] hover:brightness-95 cursor-pointer disabled:opacity-50">Enable</button>
            )}
          </li>
        ))}
        {!list.length && <li className="py-4 text-muted text-[14px]">{others.length ? 'No account matches.' : 'Nobody yet.'}</li>}
      </ul>
    </Card>
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
      {studentBlocked && <p className="text-[13px] text-muted mt-2">Add this Student ID first (Students page → Import, or a club adds the student), then approve.</p>}
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="danger" busy={busy === 'no'} disabled={!!busy} onClick={() => decide(false)}>Reject</Button>
        <Button busy={busy === 'yes'} disabled={!!busy || studentBlocked || (role === 'treasurer' && !entityId)} onClick={() => decide(true)}>Approve</Button>
      </div>
    </Card>
  );
}
