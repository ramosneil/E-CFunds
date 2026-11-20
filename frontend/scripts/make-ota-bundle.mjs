// Builds the silent-update package for the Android app (runs after `vite build`, only on Vercel: VERCEL=1).
// dist/ → dist/ota/<build>.zip  +  dist/ota/manifest.json { version, url, sha256, minNativeBuild, builtAt }
// The app (src/lib/ota.ts) reads the manifest, downloads the zip and switches to it on the next open.
// Local test: VERCEL=1 VERCEL_GIT_COMMIT_SHA=abc123 node scripts/make-ota-bundle.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

if (process.env.VERCEL !== '1') {
  console.log('[ota] not a Vercel build — skipped (APK builds bundle the code themselves).');
  process.exit(0);
}

const DIST = 'dist';
const SITE = 'https://e-cfunds.vercel.app';
const version = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'dev').slice(0, 12);
const { minNativeBuild } = JSON.parse(readFileSync('ota.json', 'utf8'));

// Every file of the app except the update folder itself (no zip inside the zip).
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(DIST, full).split(sep).join('/');
    if (rel === 'ota' || rel.startsWith('ota/')) continue;
    if (statSync(full).isDirectory()) walk(full);
    else files[rel] = readFileSync(full);
  }
};
walk(DIST);
if (!files['index.html']) throw new Error('[ota] dist/index.html missing — run vite build first');

const zip = zipSync(files, { level: 9 });
const sha256 = createHash('sha256').update(zip).digest('hex');
mkdirSync(join(DIST, 'ota'), { recursive: true });
writeFileSync(join(DIST, 'ota', `${version}.zip`), zip);
const manifest = { version, url: `${SITE}/ota/${version}.zip`, sha256, minNativeBuild, builtAt: new Date().toISOString() };
writeFileSync(join(DIST, 'ota', 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[ota] ${Object.keys(files).length} files → ota/${version}.zip (${(zip.length / 1024).toFixed(0)} KB), sha256 ${sha256.slice(0, 12)}…`);
