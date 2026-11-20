// Renders the Android icon/splash sources from public/icon.svg (run: node scripts/make-app-assets.mjs),
// then `npx capacitor-assets generate --android` makes every Android size from assets/.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile('assets/icon-only.png');
// Adaptive icon: background = the brand tile without the glyph; foreground = glyph on transparent, inside the safe zone.
const bgOnly = svg.toString().replace(/<g fill="none"[\s\S]*<\/svg>/, '</svg>');
await sharp(Buffer.from(bgOnly), { density: 600 }).resize(1024, 1024).png().toFile('assets/icon-background.png');
const fgOnly = svg.toString().replace(/<rect width="512" height="512" fill="url\(#bg\)"\/>/, '');
const fg = await sharp(Buffer.from(fgOnly), { density: 600 }).resize(700, 700).png().toBuffer();   // ~68% = safe zone
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, gravity: 'center' }]).png().toFile('assets/icon-foreground.png');
// Splash: brand blue with the icon in the middle (light and dark use the same brand colours).
const mark = await sharp(Buffer.from(fgOnly), { density: 600 }).resize(640, 640).png().toBuffer();   // glyph only, no tile edge
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#13297A' } })
    .composite([{ input: mark, gravity: 'center' }]).png().toFile(`assets/${name}`);
}
console.log('assets/ written');
