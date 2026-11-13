import { useState, type FormEvent } from 'react';
import { Clock, GraduationCap, ShieldX, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useEntities } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { AuthLayout } from './AuthLayout';

export function Pending() {
  const { profile, signOut, refreshProfile, session } = useAuth();
  const entities = useEntities();
  const [editing, setEditing] = useState(false);

  if (!profile) return null;

  if (profile.status === 'rejected' || profile.status === 'disabled') {
    return (
      <AuthLayout title={profile.status === 'rejected' ? 'Account not approved' : 'Account turned off'}>
        <div className="rounded-[20px] bg-bad-soft text-bad p-5 flex gap-3">
          <ShieldX className="size-6 shrink-0" aria-hidden />
          <div className="text-[14px]">
            <p>SAS {profile.status === 'rejected' ? 'did not approve' : 'turned off'} this account.</p>
            {profile.review_remarks && <p className="mt-1">Reason: <b>{profile.review_remarks}</b></p>}
            <p className="mt-1">Visit the Office of Student Affairs if you think this is a mistake.</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full mt-6" onClick={signOut}>Sign out</Button>
      </AuthLayout>
    );
  }

  const asked = profile.requested_role;
  const org = entities.data?.find((e) => e.id === profile.requested_entity_id);
  if (!asked || editing) {
    return <RequestForm initial={profile} onDone={() => { setEditing(false); refreshProfile(); }}
      onCancel={asked ? () => setEditing(false) : undefined} />;
  }

  return (
    <AuthLayout title="Waiting for SAS approval" sub={<>Signed in as <b className="text-ink">{session?.user.email}</b></>}>
      <div className="rounded-[20px] bg-warn-soft text-warn p-5 flex gap-3">
        <Clock className="size-6 shrink-0" aria-hidden />
        <p className="text-[14px]">The Office of Student Affairs checks every account before it can see any money. This page updates once you're approved.</p>
      </div>
      <dl className="mt-5 rounded-[20px] border border-line divide-y divide-line text-[14px]">
        <Row k="Name" v={profile.full_name || '—'} />
        <Row k="You asked to be" v={asked === 'treasurer' ? 'Treasurer' : 'Student'} />
        {asked === 'treasurer' && <Row k="Organization / club" v={org?.name ?? '—'} />}
        {asked === 'student' && <Row k="Student ID" v={profile.requested_student_no ?? '—'} />}
      </dl>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => setEditing(true)}>Change details</Button>
        <Button variant="soft" onClick={refreshProfile}>Check again</Button>
      </div>
      <button onClick={signOut} className="block mx-auto mt-6 text-primary font-semibold cursor-pointer">Sign out</button>
    </AuthLayout>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>;
}

function RequestForm({ initial, onDone, onCancel }: {
  initial: { requested_role: string | null; requested_entity_id: number | null; requested_student_no: string | null; full_name: string | null };
  onDone: () => void; onCancel?: () => void;
}) {
  const entities = useEntities();
  const [role, setRole] = useState<'student' | 'treasurer'>(initial.requested_role === 'treasurer' ? 'treasurer' : 'student');
  const [entityId, setEntityId] = useState(initial.requested_entity_id ? String(initial.requested_entity_id) : '');
  const [studentNo, setStudentNo] = useState(initial.requested_student_no ?? '');
  const [name, setName] = useState(initial.full_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { signOut } = useAuth();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('set_my_request', {
      p_role: role,
      p_entity_id: role === 'treasurer' ? Number(entityId) || undefined : undefined,
      p_student_no: role === 'student' ? studentNo.trim() : undefined,
      p_full_name: name.trim() || undefined,
    });
    setBusy(false);
    if (error) setErr(errorText(error)); else onDone();
  }

  const active = (entities.data ?? []).filter((e) => e.is_active);
  return (
    <AuthLayout title="Tell SAS who you are" sub="This goes to the Office of Student Affairs for approval.">
      <form onSubmit={submit} className="space-y-5">
        <fieldset>
          <legend className="text-[13px] font-semibold text-muted mb-2">I am a…</legend>
          <div className="grid grid-cols-2 gap-3">
            {([['student', 'Student', GraduationCap, 'See my dues and club reports'], ['treasurer', 'Treasurer', Wallet, "Manage my org's funds"]] as const).map(([v, label, Icon, sub]) => (
              <label key={v} className={`rounded-[16px] border p-4 cursor-pointer transition ${role === v ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-surface2'}`}>
                <input type="radio" name="role" value={v} checked={role === v} onChange={() => setRole(v)} className="sr-only" />
                <Icon className={`size-6 ${role === v ? 'text-primary' : 'text-muted'}`} aria-hidden />
                <span className="block font-semibold mt-2">{label}</span>
                <span className="block text-[13px] text-muted mt-0.5">{sub}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        {role === 'treasurer' ? (
          <Field label="Organization or club">
            <Select required value={entityId} onChange={(e) => setEntityId(e.target.value)}>
              <option value="">Choose one</option>
              <optgroup label="Organizations">{active.filter((e) => e.category === 'organization').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
              <optgroup label="Clubs">{active.filter((e) => e.category === 'club').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
            </Select>
          </Field>
        ) : (
          <Field label="Student ID" hint="Must match the ID on your org's roster."><Input required value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="e.g. 2024-0317" /></Field>
        )}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Send to SAS</Button>
        {onCancel ? <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
          : <button type="button" onClick={signOut} className="block mx-auto text-primary font-semibold cursor-pointer">Sign out</button>}
      </form>
    </AuthLayout>
  );
}
