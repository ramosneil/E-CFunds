// push: sends one notification row to the recipient's phones via Firebase Cloud Messaging (HTTP v1).
// Called only by the database (migration 22, pg_net) with the secret from private.push_config in `x-push-secret`;
// verify_jwt = false because the database has no user token — the secret is the check, and push_job() re-checks it.
// Secrets: FCM_SERVICE_ACCOUNT (the Firebase service-account JSON). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cached: { token: string; until: number } | null = null;

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** OAuth access token for FCM from the service account (signed JWT, RS256), cached ~55 minutes. */
async function accessToken(sa: ServiceAccount) {
  if (cached && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!r.ok) throw new Error(`token ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  cached = { token: j.access_token, until: Date.now() + 55 * 60_000 };
  return cached.token;
}

Deno.serve(async (req) => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const secret = req.headers.get('x-push-secret') ?? '';
  let id = 0;
  try { id = Number((await req.json())?.id) || 0; } catch { /* checked below */ }
  if (!secret || !id) return reply(400, { error: 'bad request' });

  const job = await db.rpc('push_job', { p_id: id, p_secret: secret });
  if (job.error) return reply(403, { error: 'not allowed' });
  const j = job.data as { title: string; body: string; link: string; kind: string; tokens: string[] } | null;
  if (!j || !j.tokens?.length) return reply(200, { sent: 0 });

  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) { console.error('push: FCM_SERVICE_ACCOUNT secret missing'); return reply(503, { error: 'push not configured' }); }
  let sa: ServiceAccount;
  try { sa = JSON.parse(raw); } catch { console.error('push: FCM_SERVICE_ACCOUNT is not valid JSON'); return reply(503, { error: 'push not configured' }); }

  let sent = 0;
  const token = await accessToken(sa);
  for (const t of j.tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token: t,
        notification: { title: j.title, body: j.body },
        data: { link: j.link, kind: j.kind, id: String(id) },
        android: {
          priority: 'HIGH',
          notification: { channel_id: 'ecfunds', icon: 'ic_stat_notify', color: '#2447C4', sound: 'default', tag: `ecf-${id}` },
        },
      } }),
    });
    if (r.ok) { sent++; continue; }
    const text = await r.text();
    if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) {
      await db.rpc('push_drop_dead', { p_token: t, p_secret: secret });   // phone uninstalled / token expired
    } else {
      console.error('push: FCM', r.status, text.slice(0, 200));
    }
  }
  return reply(200, { sent });
});
