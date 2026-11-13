import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { Loading, Spinner } from './components/ui';
import { Shell } from './components/Shell';

// Every screen loads on demand, so a visitor only downloads the screens their role can open.
// `load` is kept so the same files can be warmed in the background (see warmUp).
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const C = lazy(() => load().then((m) => ({ default: m[name] })));
  return Object.assign(C, { load });
}
const auth = () => import('./pages/auth/SignIn');
const SignIn = page(auth, 'SignIn'), Register = page(auth, 'Register'), Forgot = page(auth, 'Forgot'), ResetPassword = page(auth, 'ResetPassword');
const Pending = page(() => import('./pages/auth/Pending'), 'Pending');
const AdminDashboard = page(() => import('./pages/admin/Dashboard'), 'AdminDashboard');
const Approvals = page(() => import('./pages/admin/Approvals'), 'Approvals');
const Orgs = page(() => import('./pages/admin/Orgs'), 'Orgs');
const Accredited = page(() => import('./pages/admin/Accredited'), 'Accredited');
const Calendar = page(() => import('./pages/admin/Calendar'), 'Calendar');
const EntityDetail = page(() => import('./pages/admin/EntityDetail'), 'EntityDetail');
const TreasurerHome = page(() => import('./pages/treasurer/Home'), 'TreasurerHome');
const Members = page(() => import('./pages/treasurer/Members'), 'Members');
const Requests = page(() => import('./pages/treasurer/Requests'), 'Requests');
const StudentHome = page(() => import('./pages/student/Home'), 'StudentHome');
const Reports = page(() => import('./pages/student/Reports'), 'Reports');
const Account = page(() => import('./pages/Account'), 'Account');
const Messages = page(() => import('./pages/Messages'), 'Messages');
const Privacy = page(() => import('./pages/Privacy'), 'Privacy');

const ROLE_PAGES = {
  admin: [AdminDashboard, Approvals, Orgs, EntityDetail, Messages, Accredited, Calendar, Account],
  treasurer: [TreasurerHome, Members, Requests, Messages, Reports, Account],
  student: [StudentHome, Reports, Account],
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
      <Routes>
        {/* Public for everyone, signed in or not (Google's consent screen links here). */}
        <Route path="/privacy" element={<Lazy><Privacy /></Lazy>} />
        <Route path="*" element={<Gate />} />
      </Routes>
    </BrowserRouter>
  );
}

/** A password-reset link signs the user in; send them to the "new password" form. */
function RecoveryRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evt) => { if (evt === 'PASSWORD_RECOVERY') nav('/reset'); });
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
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={<SignIn />} />
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
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:key" element={<Messages />} />
        </>}
        {role === 'treasurer' && <>
          <Route index element={<TreasurerHome />} />
          <Route path="members" element={<Members />} />
          <Route path="requests" element={<Requests />} />
          <Route path="reports" element={<Reports />} />
          <Route path="messages" element={<Messages />} />
        </>}
        {role === 'student' && <>
          <Route index element={<StudentHome />} />
          <Route path="reports" element={<Reports />} />
        </>}
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
