import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { supabase, errorText } from '../../lib/supabase';
import { Alert, Button, Field, Input } from '../../components/ui';
import { AuthLayout, Divider, GoogleButton } from './AuthLayout';

const redirect = () => window.location.origin + '/';

export async function googleSignIn(setErr: (s: string) => void) {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } });
  if (error) setErr(/provider is not enabled/i.test(error.message)
    ? 'Google sign-in is not switched on yet. Use email and password for now.'
    : errorText(error));
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(/email not confirmed/i.test(error.message)
      ? 'Please confirm your email first. Check your inbox for the link we sent.'
      : /invalid login/i.test(error.message) ? 'Wrong email or password.' : errorText(error));
  }

  return (
    <AuthLayout title="Welcome back" sub="Sign in to see your club funds.">
      <GoogleButton onClick={() => googleSignIn(setErr)} />
      <Divider label="or with email" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Sign in</Button>
      </form>
      <div className="mt-5 flex justify-between text-[14px]">
        <Link to="/forgot" className="text-primary font-semibold">Forgot password?</Link>
        <Link to="/register" className="text-primary font-semibold">Create an account</Link>
      </div>
    </AuthLayout>
  );
}

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr('Use at least 8 characters for your password.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirect() },
    });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    if (!data.session) setSent(true); // email confirmation is on: wait for the link
  }

  if (sent) return (
    <AuthLayout title="Check your email" sub={<>We sent a confirmation link to <b className="text-ink">{email}</b>.</>}>
      <div className="rounded-[20px] bg-primary-soft text-primary p-5 flex gap-3">
        <MailCheck className="size-6 shrink-0" aria-hidden />
        <p className="text-[14px]">Open the link on this device. You'll come back here signed in, then tell SAS which org or club you belong to.</p>
      </div>
      <Link to="/" className="block text-center mt-6 text-primary font-semibold">Back to sign in</Link>
    </AuthLayout>
  );

  return (
    <AuthLayout title="Create your account" sub="Students and treasurers sign up here. SAS approves every account.">
      <GoogleButton onClick={() => googleSignIn(setErr)} />
      <Divider label="or with email" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Create account</Button>
      </form>
      <p className="mt-5 text-center text-[14px] text-muted">Already have one? <Link to="/" className="text-primary font-semibold">Sign in</Link></p>
    </AuthLayout>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset' });
    setBusy(false);
    if (error) setErr(errorText(error)); else setDone(true);
  }
  return (
    <AuthLayout title="Reset your password" sub="We'll email you a link to set a new one.">
      {done ? <Alert tone="ok">If that email has an account, a reset link is on its way.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" busy={busy} className="w-full h-[54px]">Send reset link</Button>
        </form>
      )}
      <Link to="/" className="block text-center mt-6 text-primary font-semibold">Back to sign in</Link>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr('Use at least 8 characters.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(errorText(error)); else setDone(true);
  }
  return (
    <AuthLayout title="Set a new password">
      {done ? <><Alert tone="ok">Password changed.</Alert><Link to="/" className="block text-center mt-6 text-primary font-semibold">Continue</Link></> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" hint="At least 8 characters."><Input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" busy={busy} className="w-full h-[54px]">Save password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
