import type { CapacitorConfig } from '@capacitor/cli';

// Android app (Phase 7). The app id is permanent once phones have installed it — never change it.
// The app's screens are bundled (webDir) and run at https://localhost inside the app; data comes live from Supabase.
const config: CapacitorConfig = {
  appId: 'ph.edu.omsc.ecfunds',
  appName: 'E-CFunds',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#13297A',
  },
  server: { androidScheme: 'https' },
};

export default config;
