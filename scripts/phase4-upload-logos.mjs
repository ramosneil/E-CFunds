// Phase 4: upload the 10 org/club logos from the old system to Storage (logos/<entity_id>/logo.png)
// and set entities.logo_path. Safe to re-run (upsert).
//
// Needs in E-CFunds/.env (gitignored, never commit, never paste in chat):
//   SUPABASE_URL=https://nvmlawpojydnouzqilaf.supabase.co
//   SUPABASE_SECRET_KEY=<Project Settings → API Keys → secret key (sb_secret_…) or legacy service_role>
// Run:  node scripts/phase4-upload-logos.mjs ["C:\xampp\htdocs\mini system"]
// The logo files themselves stay in the old folder; nothing from it is copied into this repo.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(repo, '.env'), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in E-CFunds/.env');

const oldRoot = process.argv[2] || 'C:\\xampp\\htdocs\\mini system';
// short_name → file, exactly as the old `entities.photo_path` pointed.
const logos = {
  'SSG': 'IMG/Organizations/SSG.png',
  'JOES': 'IMG/Organizations/OAES.png', // old system used this file for JOES (seal reads "Office Administration Executive Society")
  'PADC': 'IMG/Organizations/PADC.png',
  'YMO': 'IMG/Organizations/CTE.png',
  'LSC': 'IMG/Organizations/LSC.png',
  'JFMS': 'IMG/Organizations/JFMS.png',
  'Sports Club': 'IMG/Clubs/Sports Club.png',
  'English Club': 'IMG/Clubs/ENGLISH.png',
  'Sci-Math Club': 'IMG/Clubs/SCI-MATH.png',
  'SamFilko Club': 'IMG/Clubs/SAMFILKO.png',
};

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const res = await fetch(`${url}/rest/v1/entities?select=id,short_name`, { headers });
if (!res.ok) throw new Error(`read entities: ${res.status} ${await res.text()}`);
const entities = await res.json();
if (entities.length !== 10) throw new Error(`expected 10 entities, found ${entities.length}`);

let ok = 0;
for (const e of entities) {
  const file = logos[e.short_name];
  if (!file) throw new Error(`no logo mapped for ${e.short_name}`);
  const bytes = readFileSync(join(oldRoot, file));
  const path = `${e.id}/logo.png`;
  const up = await fetch(`${url}/storage/v1/object/logos/${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png', 'x-upsert': 'true', 'Cache-Control': '3600' },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload ${e.short_name}: ${up.status} ${await up.text()}`);
  const patch = await fetch(`${url}/rest/v1/entities?id=eq.${e.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ logo_path: path }),
  });
  if (!patch.ok) throw new Error(`set logo_path ${e.short_name}: ${patch.status} ${await patch.text()}`);
  // Self-check: the public URL serves the same number of bytes.
  const pub = await fetch(`${url}/storage/v1/object/public/logos/${path}`);
  const got = pub.ok ? (await pub.arrayBuffer()).byteLength : -1;
  if (got !== bytes.length) throw new Error(`verify ${e.short_name}: ${got} bytes served, ${bytes.length} expected`);
  console.log(`ok  ${e.short_name.padEnd(14)} logos/${path}  ${bytes.length} bytes`);
  ok++;
}
console.log(`\n${ok}/10 logos uploaded and verified.`);
