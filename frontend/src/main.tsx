import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import { App } from './App';
import { AppStatus } from './components/AppStatus';
import './lib/install';
import { isNative } from './lib/native';
import './index.css';

// Android app: finish Google sign-in when the phone's browser hands the app link back (src/lib/nativeAuth.ts).
if (isNative) void import('./lib/nativeAuth').then((m) => m.listenForAuthLinks());
// Android app: full screen (status bar hidden), again whenever the app comes back. Android keeps the bar showing after
// a swipe down from the top (e.g. to read notifications), so it is also hidden again on the next tap (at most every 2 s).
if (isNative) void import('./lib/phone').then(async (m) => {
  await m.fullScreen();
  const { App } = await import('@capacitor/app');
  await App.addListener('resume', () => { void m.fullScreen(); });
  let last = 0;
  const again = () => { const now = Date.now(); if (now - last > 2000) { last = now; void m.fullScreen(); } };
  window.addEventListener('pointerdown', again, { passive: true });
  window.addEventListener('focus', again);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') again(); });
});
// Android app: silent app-code updates (src/lib/ota.ts).
if (isNative) void import('./lib/ota').then((m) => m.startOta()).catch((e) => console.warn('[ota]', e));

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <App />
        <AppStatus />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
