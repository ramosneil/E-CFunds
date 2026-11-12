// Uploads the OMSC seal source image (poster from the old system, not committed) to Storage
// logos/brand/omsc-seal-source.jpg. The PDF letterhead crops the round seal from it at export time.
// Needs E-CFunds/.env: SUPABASE_URL + SUPABASE_SECRET_KEY (gitignored). Run:
//   node scripts/upload-brand-logo.mjs ["C:\xampp\htdocs\mini system\IMG\omsc logo.jpg"]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(readFileSync(join(repo, '.env'), 'utf8').split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]));
const url = env.SUPABASE_URL, key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in E-CFunds/.env');

const file = process.argv[2] || 'C:\\xampp\\htdocs\\mini system\\IMG\\omsc logo.jpg';
const bytes = readFileSync(file);
const path = 'brand/omsc-seal-source.jpg';
const up = await fetch(`${url}/storage/v1/object/logos/${path}`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'Cache-Control': '86400' },
  body: bytes,
});
if (!up.ok) throw new Error(`upload: ${up.status} ${await up.text()}`);
const pub = await fetch(`${url}/storage/v1/object/public/logos/${path}`);
const got = pub.ok ? (await pub.arrayBuffer()).byteLength : -1;
if (got !== bytes.length) throw new Error(`verify: ${got} bytes served, ${bytes.length} expected`);
console.log(`ok  logos/${path}  ${bytes.length} bytes, CORS: ${pub.headers.get('access-control-allow-origin') ?? '(none)'}`);
