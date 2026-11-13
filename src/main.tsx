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
