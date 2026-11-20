// Captures the browser's "install this app" offer as early as possible (it fires once, soon after load), so
// My account can show an Install button later. Chrome/Edge/Android only; iPhone uses Share → Add to Home Screen.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export const install = {
  available: () => !!deferred,
  installed: () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  isIOS: () => /iPad|iPhone|iPod/.test(navigator.userAgent),
  subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
  async prompt() {
    if (!deferred) return false;
    const e = deferred; deferred = null; notify();
    await e.prompt();
    return (await e.userChoice).outcome === 'accepted';
  },
};
