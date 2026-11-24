import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { hasSignedInBefore, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { Loading, Spinner } from './components/ui';
import { Shell } from './components/Shell';
import { Toaster } from './components/Toaster';
import { NativeBack } from './components/NativeBack';
import { AutoLogout } from './components/AutoLogout';
import { ConfirmHost } from './components/ConfirmHost';

// Every screen loads on demand, so a visitor only downloads the screens their role can open.
// `load` is kept so the same files can be warmed in the background (see warmUp).
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const C = lazy(() => load().then((m) => ({ default: m[name] })));
  return Object.assign(C, { load });
}
const auth = () => import('./pages/auth/SignIn');
const SignIn = page(auth, 'SignIn'), Register = page(auth, 'Register'), Forgot = page(auth, 'Forgot'), ResetPassword = page(auth, 'ResetPassword');
const Pending = page(() => import('./pages/auth/Pending'), 'Pending');
const Welcome = page(() => import('./pages/auth/Welcome'), 'Welcome');
const AdminDashboard = page(() => import('./pages/admin/Dashboard'), 'AdminDashboard');
const Approvals = page(() => import('./pages/admin/Approvals'), 'Approvals');
const Orgs = page(() => import('./pages/admin/Orgs'), 'Orgs');
const Accredited = page(() => import('./pages/admin/Accredited'), 'Accredited');
const Calendar = page(() => import('./pages/admin/Calendar'), 'Calendar');
const Students = page(() => import('./pages/admin/Students'), 'Students');
const ActivityLog = page(() => import('./pages/admin/ActivityLog'), 'ActivityLog');
const EntityDetail = page(() => import('./pages/admin/EntityDetail'), 'EntityDetail');
const TreasurerHome = page(() => import('./pages/treasurer/Home'), 'TreasurerHome');
const Members = page(() => import('./pages/treasurer/Members'), 'Members');
const Requests = page(() => import('./pages/treasurer/Requests'), 'Requests');
const StudentHome = page(() => import('./pages/student/Home'), 'StudentHome');
const Insights = page(() => import('./pages/Insights'), 'Insights');
function ReportRedirect() { const { id } = useParams(); return <Navigate to={`/insights?org=${id}`} replace />; }
const Account = page(() => import('./pages/Account'), 'Account');
const Messages = page(() => import('./pages/Messages'), 'Messages');
const Receipt = page(() => import('./pages/Receipt'), 'Receipt');
const ReceiptOfMembership = page(() => import('./pages/Receipt'), 'ReceiptOfMembership');
const Privacy = page(() => import('./pages/Privacy'), 'Privacy');
const Terms = page(() => import('./pages/Terms'), 'Terms');

const ROLE_PAGES = {
  admin: [AdminDashboard, Approvals, Orgs, EntityDetail, Messages, Insights, Accredited, Calendar, ActivityLog, Students, Account],
  treasurer: [TreasurerHome, Members, Requests, Messages, Insights, Account],
  student: [StudentHome, Insights, Account],
} as const;

/** After the first screen has painted, fetch the rest of this role's screens while the browser is idle. */
function warmUp(role: keyof typeof ROLE_PAGES) {
  const run = () => ROLE_PAGES[role].forEach((p) => { void p.load().catch(() => { /* offline: loads on tap instead */ }); });
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
}

const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<Loading />}>{children}</Suspense>;

export function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Toaster />
      <NativeBack />
      <AutoLogout />
      <ConfirmHost />
      <Routes>
        {/* Public for everyone, signed in or not (Google's consent screen links here). */}
        <Route path="/privacy" element={<Lazy><Privacy /></Lazy>} />
        <Route path="/terms" element={<Lazy><Terms /></Lazy>} />
        <Route path="*" element={<Gate />} />
      </Routes>
    </BrowserRouter>
  );
}

/** A password-reset link signs the user in; send them to the "new password" form.
 *  Any other sign-in or sign-out starts on the home screen, scrolled to the top — otherwise the app reopens the
 *  page the last person was on (e.g. My account, where Sign out lives) instead of the Dashboard. */
function RecoveryRedirect() {
  const nav = useNavigate();
  // Android: a password-reset link that opened the app (nativeAuth.ts) asks to show a page.
  useEffect(() => {
    const on = (e: Event) => { nav(String((e as CustomEvent).detail)); window.scrollTo(0, 0); };
    window.addEventListener('ecfunds:native-go', on);
    return () => window.removeEventListener('ecfunds:native-go', on);
  }, [nav]);
  useEffect(() => {
    let had: boolean | null = null;   // was someone signed in? (null until the stored session is read)
    void supabase.auth.getSession().then(({ data }) => { if (had === null) had = !!data.session; });
    const { data } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === 'PASSWORD_RECOVERY') { had = true; nav('/reset'); return; }
      if (evt === 'INITIAL_SESSION') { had = !!s; return; }
      const now = !!s;
      let recovering = false;
      try { recovering = sessionStorage.getItem('ecfunds:recovery') === '1'; if (recovering) sessionStorage.removeItem('ecfunds:recovery'); } catch { /* fine */ }
      // Signing in on a deep link (a notification tapped while signed out, e.g. /requests) stays there; signing in
      // from Home or a sign-in page goes to the Dashboard; signing out always goes to the start.
      const path = window.location.pathname;
      const deep = now && !['/', '/welcome', '/login', '/register', '/forgot'].includes(path);
      if (had !== null && now !== had && path !== '/reset' && !(deep && !recovering)) {
        nav(recovering ? '/reset' : '/', { replace: true });
        window.scrollTo(0, 0);
      } else if (had !== null && now !== had && deep) window.scrollTo(0, 0);
      had = now;
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);
  return null;
}

function Gate() {
  const { session, ready, profile, profileLoading } = useAuth();
  const role = profile?.status === 'approved' ? profile.role : null;
  useEffect(() => { if (role) warmUp(role); }, [role]);

  if (!ready || profileLoading) return <Loading />;

  if (!session) {
    return (
      <Lazy>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/welcome" element={<Welcome />} />
          {/* New device → the welcome page (Neil, 2026-11-24); a device that has signed in before → Sign in.
              Any other address (e.g. a notification tapped while signed out) keeps its path on a known device, so
              signing in lands on it; on a new device it goes to the welcome page. */}
          <Route path="/" element={hasSignedInBefore() ? <SignIn /> : <Welcome />} />
          <Route path="*" element={hasSignedInBefore() ? <SignIn /> : <Navigate to="/" replace />} />
        </Routes>
      </Lazy>
    );
  }

  if (!profile || !role) {
    return (
      <Lazy>
        <Routes>
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={profile ? <Pending /> : <Spinner label="Setting up your account" />} />
        </Routes>
      </Lazy>
    );
  }

  return (
    <Routes>
      <Route path="/reset" element={<Lazy><ResetPassword /></Lazy>} />
      {/* The Shell (sidebar, top and bottom bars) stays on screen; only the content area waits. */}
      <Route element={<Shell />}>
        {role === 'admin' && <>
          <Route index element={<AdminDashboard />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="orgs" element={<Orgs />} />
          <Route path="orgs/:id" element={<EntityDetail />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="students" element={<Students />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:key" element={<Messages />} />
        </>}
        {role === 'treasurer' && <>
          <Route index element={<TreasurerHome />} />
          <Route path="members" element={<Members />} />
          <Route path="requests" element={<Requests />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:key" element={<Messages />} />
        </>}
        {role === 'student' && <>
          <Route index element={<StudentHome />} />
        </>}
        {/* Insights (2026-11-25) replaced Reports for everyone; old links land on the same org's dashboard. */}
        <Route path="insights" element={<Insights />} />
        <Route path="reports" element={<Navigate to="/insights" replace />} />
        <Route path="reports/:id" element={<ReportRedirect />} />
        <Route path="receipt/:no" element={<Receipt />} />
        <Route path="receipt/m/:mid" element={<ReceiptOfMembership />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
