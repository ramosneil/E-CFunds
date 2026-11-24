// Puts the latest released Android app on our own website: dist/E-CFunds.apk (Vercel builds only, VERCEL=1).
// Why (Neil, 2026-11-24): GitHub's download server sent the APK to the Philippines at ~20 KB/s (about 6 minutes);
// Vercel's edge sends it at ~1 MB/s (seconds). Runs AFTER make-ota-bundle.mjs so the APK is not put in the OTA zip.
// If GitHub can't be reached the build still succeeds: vercel.json then forwards /E-CFunds.apk to the GitHub file.
// A new release reaches the website on the next Vercel deploy (the Android workflow asks for one; see docs/handoff.md).
import { writeFileSync } from 'node:fs';

if (process.env.VERCEL !== '1') {
  console.log('[apk] not a Vercel build — skipped.');
  process.exit(0);
}

const SRC = 'https://github.com/ramosneil/E-CFunds/releases/latest/download/E-CFunds.apk';
try {
  const r = await fetch(SRC, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const apk = Buffer.from(await r.arrayBuffer());
  // An APK is a zip ("PK") of a few MB; anything else (an error page) is not published.
  if (apk.length < 1_000_000 || apk[0] !== 0x50 || apk[1] !== 0x4b) throw new Error(`not an APK (${apk.length} bytes)`);
  writeFileSync('dist/E-CFunds.apk', apk);
  console.log(`[apk] dist/E-CFunds.apk ${(apk.length / 1024 / 1024).toFixed(1)} MB from ${r.url.split('?')[0].slice(0, 80)}`);
} catch (e) {
  console.warn(`[apk] could not fetch the latest APK (${e.message}) — /E-CFunds.apk falls back to GitHub.`);
}
