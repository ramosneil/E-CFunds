import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IdCard, KeyRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useEntities } from '../lib/data';
import { supabase, errorText } from '../lib/supabase';
import { Alert, Button, Card, Field, Input, PageHeader, SectionTitle } from '../components/ui';

/** My account: who I am, plus set/change password (lets Google users use Student ID sign-in too). */
export function Account() {
  const { profile, session } = useAuth();
  const entities = useEntities();
  const student = useQuery({
    queryKey: ['my-student', profile?.student_id],
    enabled: !!profile?.student_id,
    queryFn: async () => {
      const { data, error } = await supabase.from('students').select('student_no, full_name').eq('id', profile!.student_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const user = session?.user;
  const hasPassword = (user?.identities ?? []).some((i) => i.provider === 'email');
  const viaGoogle = (user?.identities ?? []).some((i) => i.provider === 'google');
  const org = entities.data?.find((e) => e.id === profile?.entity_id);
  const roleLabel = profile?.role === 'admin' ? 'SAS Admin' : profile?.role === 'treasurer' ? `Treasurer · ${org?.short_name ?? ''}` : 'Student';

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
        <Card>
          <SectionTitle>Profile</SectionTitle>
          <dl className="divide-y divide-line text-[14px]">
            <Row k="Name" v={profile?.full_name || '—'} />
            <Row k="Email" v={user?.email ?? '—'} />
            <Row k="Role" v={roleLabel} />
            {profile?.role === 'student' && <Row k="Student ID" v={student.data?.student_no ?? '—'} />}
            <Row k="Signs in with" v={[hasPassword && 'Password', viaGoogle && 'Google'].filter(Boolean).join(' + ') || '—'} />
          </dl>
          {profile?.role === 'student' && student.data && (
            <div className="mt-4 rounded-[16px] bg-primary-soft text-primary p-4 flex gap-3 text-[14px]">
              <IdCard className="size-5 shrink-0" aria-hidden />
              <p>You can sign in with your Student ID <b>{student.data.student_no}</b> and your password{hasPassword ? '' : ' once you set one'}.</p>
            </div>
          )}
        </Card>
        <PasswordCard hasPassword={hasPassword} />
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="font-semibold text-right break-all">{v}</dd></div>;
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setMsg({ tone: 'bad', text: 'Use at least 8 characters.' }); return; }
    if (pw !== pw2) { setMsg({ tone: 'bad', text: 'The two passwords do not match.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ tone: 'bad', text: errorText(error) }); return; }
    setPw(''); setPw2('');
    setMsg({ tone: 'ok', text: hasPassword ? 'Password changed.' : 'Password set. You can now sign in with it.' });
  }

  return (
    <Card>
      <SectionTitle>{hasPassword ? 'Change password' : 'Set a password'}</SectionTitle>
      {!hasPassword && <p className="text-[14px] text-muted -mt-1 mb-4">You signed in with Google. A password lets you also sign in with your email or Student ID.</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Type it again"><Input type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" busy={busy} className="w-full"><KeyRound className="size-5" />{hasPassword ? 'Change password' : 'Set password'}</Button>
      </form>
    </Card>
  );
}
