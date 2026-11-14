import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { supabase, errorText } from '../../lib/supabase';
import { Alert, Button, Field, Input } from '../../components/ui';
import { AuthLayout, Divider, GoogleButton } from './AuthLayout';
import { isNative, webOrigin } from '../../lib/native';
import { NATIVE_AUTH_ERROR, nativeGoogleSignIn } from '../../lib/nativeAuth';
import { AndroidAppLink } from '../../components/AndroidAppLink';
import { IphoneAppHint } from '../../components/IphoneInstall';
import { PasswordInput, PasswordStrength } from '../../components/PasswordInput';
import { TermsCheckbox, TermsNote } from '../../components/Terms';
import { meetsRules } from '../../lib/password';
import { toast } from '../../lib/toast';

const redirect = () => webOrigin() + '/';
const googleError = (m: string) => /provider is not enabled/i.test(m)
  ? 'Google sign-in is not switched on yet. Use email and password for now.' : m;

/** Browser: normal Google redirect. Android app: Google opens in the phone's browser and returns via an app link. */
export async function googleSignIn(setErr: (s: string) => void) {
  if (isNative) { const m = await nativeGoogleSignIn(); if (m) setErr(googleError(m)); return; }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } });
  if (error) setErr(googleError(errorText(error)));
}

/** Shows errors that come back from the Android Google sign-in round-trip. */
function useNativeAuthErrors(setErr: (s: string) => void) {
  useEffect(() => {
    if (!isNative) return;
    const on = (e: Event) => setErr(googleError(String((e as CustomEvent).detail)));
    window.addEventListener(NATIVE_AUTH_ERROR, on);
    return () => window.removeEventListener(NATIVE_AUTH_ERROR, on);
  }, [setErr]);
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useNativeAuthErrors(setErr);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const id = email.trim();
    if (!id.includes('@')) {
      // Student ID: the server function finds the student's email privately and returns a session.
      const { data, error } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>('student-login', {
        body: { student_no: id, password },
      });
      if (error || !data) {
        let msg = 'Sign-in is unavailable right now. Try again soon.';
        const ctx = (error as { context?: Response } | null)?.context;
        if (ctx && typeof ctx.json === 'function') { try { msg = (await ctx.json()).error ?? msg; } catch { /* keep default */ } }
        setBusy(false); setErr(msg); return;
      }
      const s = await supabase.auth.setSession(data);
      setBusy(false);
      if (s.error) setErr(errorText(s.error));
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: id, password });
    setBusy(false);
    if (!error && (data as { weakPassword?: unknown } | null)?.weakPassword) {
      toast({ title: 'Please update your password', body: 'It is weaker than the new rule. Change it in My account.', tone: 'warn', href: '/account', sticky: true, silent: true });
    }
    if (error) setErr(/email not confirmed/i.test(error.message)
      ? 'Please confirm your email first. Check your inbox for the link we sent.'
      : /invalid login/i.test(error.message) ? 'Wrong email or password.' : errorText(error));
  }

  return (
    <AuthLayout title="Welcome back" sub="Sign in to see your club funds.">
      <GoogleButton onClick={() => googleSignIn(setErr)} />
      <Divider label="or with email or Student ID" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email or Student ID" hint="Students: your Student ID works once SAS has approved your account.">
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password"><PasswordInput autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">Sign in</Button>
        <TermsNote action="signing in" />
      </form>
      <div className="mt-5 flex justify-between text-[14px]">
        <Link to="/forgot" className="text-primary font-semibold">Forgot password?</Link>
        <Link to="/register" className="text-primary font-semibold">Create an account</Link>
      </div>
      <AndroidAppLink />
      <IphoneAppHint />
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
  const [agree, setAgree] = useState(false);
  useNativeAuthErrors(setErr);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!meetsRules(password)) { setErr('Choose a stronger password: it needs every item in the checklist.'); return; }
    if (!agree) { setErr('Please agree to the Terms and Privacy Notice to create an account.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim(), terms_accepted: true }, emailRedirectTo: redirect() },
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
      <p className="text-[12.5px] text-muted text-center mt-2">With Google you'll agree to the Terms on the next screen.</p>
      <Divider label="or with email" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><Input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <div>
          <Field label="Password"><PasswordInput autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <PasswordStrength value={password} />
        </div>
        <TermsCheckbox checked={agree} onChange={setAgree} />
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={!agree || !meetsRules(password)} className="w-full h-[54px]">Create account</Button>
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: webOrigin() + '/reset' });
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
    if (!meetsRules(password)) { setErr('Choose a stronger password: it needs every item in the checklist.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(errorText(error)); else setDone(true);
  }
  return (
    <AuthLayout title="Set a new password">
      {done ? <><Alert tone="ok">Password changed.</Alert><Link to="/" className="block text-center mt-6 text-primary font-semibold">Continue</Link></> : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Field label="New password"><PasswordInput autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <PasswordStrength value={password} />
          </div>
          {err && <Alert>{err}</Alert>}
          <Button type="submit" busy={busy} disabled={!meetsRules(password)} className="w-full h-[54px]">Save password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
