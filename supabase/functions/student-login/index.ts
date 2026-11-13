// student-login: sign a student in with Student ID + password (business-rules §4.6).
// The Student ID is turned into the approved student's email HERE, on the server; the browser only ever gets
// session tokens back, never the email. Lockout: 5 failed tries per Student ID in 15 minutes (migration 9).
// Deployed with verify_jwt = false: callers are not signed in yet; the password check below is the authentication.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Browser origins allowed to call this function. Add the live app address (Phase 8) with the ALLOWED_ORIGINS secret.
const ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000', 'https://localhost' /* Android app */,
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)]);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

function cors(origin: string | null): Record<string, string> {
  return origin && ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    : { 'Vary': 'Origin' };
}

const WRONG = 'Wrong Student ID or password.';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  let studentNo = '', password = '';
  try {
    const b = await req.json();
    studentNo = String(b?.student_no ?? '').trim();
    password = String(b?.password ?? '');
  } catch { /* falls through to the check below */ }
  if (studentNo.length < 3 || studentNo.length > 30 || !password || password.length > 200) {
    return reply(400, { error: 'Enter your Student ID and password.' });
  }

  const started = Date.now();
  // Failed answers take at least ~600 ms whether or not the ID exists, so timing does not reveal real IDs.
  const fail = async (status: number, body: unknown) => { await sleep(Math.max(0, 600 - (Date.now() - started))); return reply(status, body); };

  const look = await admin.rpc('student_login_lookup', { p_student_no: studentNo }).single();
  if (look.error) { console.error('lookup', look.error.message); return reply(500, { error: 'Sign-in is unavailable right now. Try again soon.' }); }
  const { email, locked_until } = look.data as { email: string | null; locked_until: string | null };

  if (locked_until) {
    const mins = Math.max(1, Math.ceil((new Date(locked_until).getTime() - Date.now()) / 60000));
    return fail(429, { error: `Too many tries. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, retry_in_minutes: mins });
  }
  if (!email) {
    await admin.rpc('student_login_record', { p_student_no: studentNo, p_ok: false });
    return fail(401, { error: WRONG });
  }

  const auth = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  await admin.rpc('student_login_record', { p_student_no: studentNo, p_ok: !error && !!data.session });
  if (error || !data.session) {
    if (error && /rate limit/i.test(error.message)) return fail(429, { error: 'Too many sign-ins right now. Wait a minute and try again.' });
    return fail(401, { error: WRONG });
  }
  return reply(200, { access_token: data.session.access_token, refresh_token: data.session.refresh_token });
});
