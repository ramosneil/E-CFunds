import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, GraduationCap, ShieldX, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { SECTIONS, YEARS } from '../../lib/roster';

/** The course list (BSIT, BEED, BSBA OM, BSBA FM — SAS keeps it). */
function useCourseList() {
  return useQuery({
    queryKey: ['courses'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('courses').select('code, name').order('sort');
      if (error) throw error;
      return data;
    },
  });
}
import { useEntities } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { TermsCheckbox } from '../../components/Terms';
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
        <Row k="Student ID" v={profile.requested_student_no ?? '—'} />
        <Row k="Course, year and section" v={profile.requested_year_level ? `${profile.requested_course ?? '—'} · Year ${profile.requested_year_level} · Section ${profile.requested_section ?? '—'}` : '—'} />
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
  initial: { requested_role: string | null; requested_entity_id: number | null; requested_student_no: string | null; full_name: string | null;
    requested_year_level?: number | null; requested_section?: string | null; requested_course?: string | null };
  onDone: () => void; onCancel?: () => void;
}) {
  const entities = useEntities();
  const [role, setRole] = useState<'student' | 'treasurer'>(initial.requested_role === 'treasurer' ? 'treasurer' : 'student');
  const [entityId, setEntityId] = useState(initial.requested_entity_id ? String(initial.requested_entity_id) : '');
  const [studentNo, setStudentNo] = useState(initial.requested_student_no ?? '');
  const [name, setName] = useState(initial.full_name ?? '');
  const [year, setYear] = useState(initial.requested_year_level ? String(initial.requested_year_level) : '');
  const [section, setSection] = useState(initial.requested_section ?? '');
  const [course, setCourse] = useState(initial.requested_course ?? '');
  const courses = useCourseList();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { signOut, profile } = useAuth();
  const needsTerms = !profile?.terms_accepted_at;   // Google sign-ups accept here; email sign-ups already did
  const [agree, setAgree] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (needsTerms && !agree) { setErr('Please agree to the Terms and Privacy Notice.'); return; }
    if (!course || !year || !section) { setErr('Choose your course, year level and section.'); return; }
    setBusy(true); setErr('');
    if (needsTerms) {
      const t = await supabase.rpc('accept_terms');
      if (t.error) { setBusy(false); setErr(errorText(t.error)); return; }
    }
    const { error } = await supabase.rpc('set_my_request', {
      p_role: role,
      p_entity_id: role === 'treasurer' ? Number(entityId) || undefined : undefined,
      p_student_no: studentNo.trim(),   // treasurers are students too (Neil, 2026-11-26)
      p_full_name: name.trim() || undefined,
      p_course: course, p_year_level: Number(year), p_section: section,   // required for both (Neil, 2026-11-26)
    });
    setBusy(false);
    if (error) setErr(errorText(error)); else onDone();
  }

  // Orgs/clubs that already have an approved treasurer aren't offered (the server refuses them too, migration 48).
  const taken = useQuery({
    queryKey: ['entities-with-treasurer'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('entities_with_treasurer');
      if (error) throw error;
      return new Set((data ?? []).map(Number));
    },
  });
  const active = (entities.data ?? []).filter((e) => e.is_active && !taken.data?.has(e.id));
  const orgs = active.filter((e) => e.category === 'organization'), clubs = active.filter((e) => e.category === 'club');
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
        {role === 'treasurer' && (
          <Field label="Organization or club" hint="Orgs and clubs that already have a treasurer aren't listed. If yours changed treasurer, ask SAS.">
            <Select required value={entityId} onChange={(e) => setEntityId(e.target.value)} disabled={taken.isLoading}>
              <option value="">{taken.isLoading ? 'Loading…' : orgs.length + clubs.length ? 'Choose one' : 'Every org and club already has a treasurer'}</option>
              {orgs.length > 0 && <optgroup label="Organizations">{orgs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
              {clubs.length > 0 && <optgroup label="Clubs">{clubs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
            </Select>
          </Field>
        )}
        <Field label="Student ID" hint={role === 'treasurer' ? 'Treasurers are students too. It must be on the student list SAS keeps.' : "Must match the ID on your org's roster."}>
          <Input required value={studentNo} onChange={(e) => setStudentNo(e.target.value)} placeholder="e.g. 24-1-03178" className="money" autoCapitalize="characters" />
        </Field>
        <Field label="Course">
          <Select required value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Choose your course</option>
            {courses.data?.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year level">
            <Select required value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Choose</option>
              {YEARS.map((y) => <option key={y} value={y}>{y === '1' ? '1st' : y === '2' ? '2nd' : y === '3' ? '3rd' : '4th'} year</option>)}
            </Select>
          </Field>
          <Field label="Section">
            <Select required value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Choose</option>
              {SECTIONS.map((x) => <option key={x} value={x}>Section {x}</option>)}
            </Select>
          </Field>
        </div>
        {needsTerms && <TermsCheckbox checked={agree} onChange={setAgree} />}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} disabled={needsTerms && !agree} className="w-full h-[54px]">Send to SAS</Button>
        {onCancel ? <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>Cancel</Button>
          : <button type="button" onClick={signOut} className="block mx-auto text-primary font-semibold cursor-pointer">Sign out</button>}
      </form>
    </AuthLayout>
  );
}
