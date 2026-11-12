import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Libraries go into their own long-lived files, so an app update only re-downloads the app code; icons stay in one
// file instead of dozens of tiny requests. jsPDF and the export code are not listed: they stay on-demand chunks.
const lib = (pkgs: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${pkgs})[\\\\/]`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: lib('react|react-dom|scheduler'), priority: 30 },
            { name: 'supabase', test: lib('@supabase'), priority: 20 },
            { name: 'app-libs', test: lib('@tanstack|react-router|cookie|set-cookie-parser|lucide-react'), priority: 10 },
          ],
        },
      },
    },
  },
});
