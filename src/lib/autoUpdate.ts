// Automatic app updates (Neil, 2026-11-15: "make it automatic, remove the manual check").
// A new version switches in by itself as soon as it is SAFE — nobody is typing and no sheet/dialog is open — or
// the moment the person leaves the screen. Website: service worker (AppStatus.tsx). Android app: ota.ts.

/** True when reloading now can't lose anything the person is doing. */
export function safeToReload(): boolean {
  if (document.querySelector('[role="dialog"]')) return false;
  const a = document.activeElement as HTMLElement | null;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return false;
  return true;
}

let waiting: (() => void) | null = null;

/** Runs `apply` now if safe; otherwise when it becomes safe (checked every 2 s) or when the page goes to the
 *  background — whichever comes first. Only the newest pending update is kept. */
export function applyWhenSafe(apply: () => void) {
  if (safeToReload()) { apply(); return; }
  const first = !waiting;
  waiting = apply;
  if (!first) return;
  const go = () => { const f = waiting; waiting = null; clearInterval(t); document.removeEventListener('visibilitychange', onHide); f?.(); };
  const onHide = () => { if (document.visibilityState === 'hidden') go(); };
  const t = setInterval(() => { if (safeToReload()) go(); }, 2000);
  document.addEventListener('visibilitychange', onHide);
}

/** Asks for an update check right now (pull-to-refresh). Website: AppStatus listens; Android: ota.ts. */
export const CHECK_UPDATE_EVENT = 'ecfunds:check-update';
export const requestUpdateCheck = () => window.dispatchEvent(new Event(CHECK_UPDATE_EVENT));
