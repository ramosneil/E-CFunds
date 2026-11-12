import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { Spinner } from './components/ui';
import { Shell } from './components/Shell';
import { Forgot, Register, ResetPassword, SignIn } from './pages/auth/SignIn';
import { Pending } from './pages/auth/Pending';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Approvals } from './pages/admin/Approvals';
import { Orgs } from './pages/admin/Orgs';
import { Accredited } from './pages/admin/Accredited';
import { Calendar } from './pages/admin/Calendar';
import { EntityDetail } from './pages/admin/EntityDetail';
import { TreasurerHome } from './pages/treasurer/Home';
import { Members } from './pages/treasurer/Members';
import { Requests } from './pages/treasurer/Requests';
import { StudentHome } from './pages/student/Home';
import { Reports } from './pages/student/Reports';

export function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Gate />
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
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 300); return () => clearTimeout(t); }, []);

  if (!ready || profileLoading) return slow ? <Spinner /> : null;

  if (!session) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="*" element={<SignIn />} />
      </Routes>
    );
  }

  if (!profile || profile.status !== 'approved' || !profile.role) {
    return (
      <Routes>
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="*" element={profile ? <Pending /> : <Spinner label="Setting up your account" />} />
      </Routes>
    );
  }

  const role = profile.role;
  return (
    <Routes>
      <Route path="/reset" element={<ResetPassword />} />
      <Route element={<Shell />}>
        {role === 'admin' && <>
          <Route index element={<AdminDashboard />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="orgs" element={<Orgs />} />
          <Route path="orgs/:id" element={<EntityDetail />} />
          <Route path="accredited" element={<Accredited />} />
          <Route path="calendar" element={<Calendar />} />
        </>}
        {role === 'treasurer' && <>
          <Route index element={<TreasurerHome />} />
          <Route path="members" element={<Members />} />
          <Route path="requests" element={<Requests />} />
          <Route path="reports" element={<Reports />} />
        </>}
        {role === 'student' && <>
          <Route index element={<StudentHome />} />
          <Route path="reports" element={<Reports />} />
        </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
