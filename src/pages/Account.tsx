import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BellOff, BellRing, CheckCircle2, Download, IdCard, KeyRound, LogOut, RefreshCw, Smartphone } from 'lucide-react';
import { isIos, webPushOff, webPushOn, webPushState, type WebPushState } from '../lib/webpush';
import { askSignOut } from '../lib/confirm';
import { applyReady, checkForUpdate, otaState } from '../lib/ota';
import { notifyPermission, requestNotify, type PhonePermission } from '../lib/phone';
import { install } from '../lib/install';
import { AndroidAppLink } from '../components/AndroidAppLink';
import { IphoneSteps } from '../components/IphoneInstall';
import { PasswordInput, PasswordStrength } from '../components/PasswordInput';
import { meetsRules } from '../lib/password';
import { isNative } from '../lib/native';
import { useAuth } from '../lib/auth';
import { useEntities } from '../lib/data';
import { supabase, errorText } from '../lib/supabase';
import { Alert, Button, Card, Field, PageHeader, SectionTitle } from '../components/ui';

/** My account: who I am, plus set/change password (lets Google users use Student ID sign-in too). */
export function Account() {
  const { profile, session, signOut } = useAuth();
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
        {isNative ? <PhoneNotifyCard /> : <WebNotifyCard />}
        {isNative ? <AppUpdateCard /> : <InstallCard />}
      </div>
      <Button variant="soft" className="mt-6 w-full sm:w-auto sm:px-6 h-12 text-bad" onClick={() => void askSignOut(signOut)}>
        <LogOut className="size-5" aria-hidden />Sign out
      </Button>
      <p className="mt-6 text-[13px] text-muted"><Link to="/privacy" className="text-primary font-semibold">Privacy notice</Link> · what E-CFunds keeps and who can see it</p>
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
    if (!meetsRules(pw)) { setMsg({ tone: 'bad', text: 'Choose a stronger password: it needs every item in the checklist.' }); return; }
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
        <div>
          <Field label="New password"><PasswordInput autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <PasswordStrength value={pw} />
        </div>
        <Field label="Type it again" error={pw2 && pw2 !== pw ? 'The two passwords do not match.' : null}><PasswordInput autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button type="submit" busy={busy} className="w-full"><KeyRound className="size-5" />{hasPassword ? 'Change password' : 'Set password'}</Button>
      </form>
    </Card>
  );
}

/** Install E-CFunds on this phone/computer (installable web app). Hidden inside the Android app itself. */
function InstallCard() {
  const [, tick] = useState(0);
  useEffect(() => install.subscribe(() => tick((n) => n + 1)), []);
  const [msg, setMsg] = useState('');
  if (install.installed()) {
    return (
      <Card>
        <SectionTitle>App</SectionTitle>
        <p className="flex items-center gap-2 text-[14px] text-ok font-semibold"><CheckCircle2 className="size-5" aria-hidden />E-CFunds is installed on this device.</p>
      </Card>
    );
  }
  return (
    <Card>
      <SectionTitle>Install the app</SectionTitle>
      <p className="text-[14px] text-muted -mt-1 mb-4">Put E-CFunds on your home screen. It opens full-screen and starts instantly, even on a weak signal.</p>
      {install.available() ? (
        <Button className="w-full" onClick={async () => setMsg((await install.prompt()) ? 'Installed — look for E-CFunds on your home screen.' : '')}>
          <Download className="size-5" />Install E-CFunds
        </Button>
      ) : (
        isIos() ? <IphoneSteps /> : (
          <div className="rounded-[16px] bg-surface2 p-4 text-[14px] flex gap-3">
            <Smartphone className="size-5 shrink-0 text-primary" aria-hidden />
            <p>Open your browser menu (<b>⋮</b>) and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
          </div>
        )
      )}
      {msg && <p className="text-[13px] text-ok mt-3">{msg}</p>}
      {!install.isIOS() && <AndroidAppLink always />}
    </Card>
  );
}

/** Android app: which version is running, the last update check, and buttons to check / apply now. */
function AppUpdateCard() {
  const status = useSyncExternalStore(otaState.subscribe, otaState.status);
  const [busy, setBusy] = useState(false);
  const when = status ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(status.at)) : null;
  return (
    <Card>
      <SectionTitle>App updates</SectionTitle>
      <dl className="divide-y divide-line text-[14px]">
        <Row k="Version" v={__BUILD_ID__} />
        <Row k="Last check" v={when ?? 'Not yet'} />
      </dl>
      {status && <p className={`mt-3 text-[14px] ${status.ok ? 'text-muted' : 'text-bad'}`}>{status.text}</p>}
      <p className="mt-2 text-[13px] text-muted">New versions download by themselves and switch on the next time you open E-CFunds.</p>
      {status?.ready && status.ready !== __BUILD_ID__ ? (
        <Button className="w-full mt-4" onClick={async () => { setBusy(true); if (!(await applyReady())) setBusy(false); }} busy={busy}>
          <RefreshCw className="size-5" />Restart to update
        </Button>
      ) : (
        <Button variant="soft" className="w-full mt-4" busy={busy} onClick={async () => { setBusy(true); await checkForUpdate(); setBusy(false); }}>
          <RefreshCw className="size-5" />Check for updates
        </Button>
      )}
    </Card>
  );
}

/** Website (computers, iPhone Home Screen app): notifications even when E-CFunds is closed — Web Push. */
function WebNotifyCard() {
  const [state, setState] = useState<WebPushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { void webPushState().then(setState); }, []);
  if (state === null || state === 'unsupported') return null;
  return (
    <Card>
      <SectionTitle>Notifications on this {isIos() ? 'iPhone' : 'device'}</SectionTitle>
      {state === 'on' ? (
        <>
          <p className="flex items-center gap-2 text-[14px] text-ok font-semibold"><CheckCircle2 className="size-5" aria-hidden />On — you'll be notified even when E-CFunds is closed.</p>
          <Button variant="soft" className="w-full mt-4" busy={busy} onClick={async () => { setBusy(true); await webPushOff(); setState(await webPushState()); setBusy(false); }}>
            <BellOff className="size-5" />Turn off on this device
          </Button>
        </>
      ) : state === 'install-first' ? (
        <p className="text-[14px] text-muted">On iPhone, notifications work from the Home Screen app. Add E-CFunds to your Home Screen first (see <b>Install the app</b>), open it from there, then come back here.</p>
      ) : state === 'blocked' ? (
        <p className="text-[14px] text-muted">Blocked for this site. To allow them: click the <b>🔒 lock</b> (or settings icon) left of the address → <b>Notifications → Allow</b>, then reload.{isIos() ? ' On iPhone: Settings → Notifications → E-CFunds → Allow.' : ''}</p>
      ) : (
        <>
          <p className="text-[14px] text-muted -mt-1 mb-4">Get payments, requests, messages and announcements as notifications, even when E-CFunds is closed.</p>
          <Button className="w-full" busy={busy} onClick={async () => {
            setBusy(true); setErr('');
            try { setState(await webPushOn()); } catch (e) { setErr(errorText(e)); }
            setBusy(false);
          }}><BellRing className="size-5" />Turn on notifications</Button>
        </>
      )}
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
    </Card>
  );
}

/** Android app: phone notifications on/off (Android asks for permission; if refused, it must be allowed in Settings). */
function PhoneNotifyCard() {
  const [perm, setPerm] = useState<PhonePermission | null>(null);
  useEffect(() => { void notifyPermission().then(setPerm); }, []);
  if (perm === null || perm === 'unavailable') return null;
  return (
    <Card>
      <SectionTitle>Phone notifications</SectionTitle>
      {perm === 'granted' ? (
        <p className="flex items-center gap-2 text-[14px] text-ok font-semibold"><CheckCircle2 className="size-5" aria-hidden />On — E-CFunds can notify you on this phone.</p>
      ) : perm === 'denied' ? (
        <p className="text-[14px] text-muted">Off. To turn them on: phone <b>Settings → Apps → E-CFunds → Notifications</b> → allow.</p>
      ) : (
        <>
          <p className="text-[14px] text-muted -mt-1 mb-4">Get payments, requests, messages and announcements in your phone's notifications.</p>
          <Button className="w-full" onClick={async () => setPerm(await requestNotify())}><BellRing className="size-5" />Turn on notifications</Button>
        </>
      )}
    </Card>
  );
}
