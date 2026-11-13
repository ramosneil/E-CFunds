// Generates the web/PWA icons from public/icon.svg:  npx pwa-assets-generator
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The SVG is already a full-bleed tile, so no extra padding (keeps the ₱ large and crisp).
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#13297A' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#13297A' } },
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
  },
  images: ['public/icon.svg'],
});
