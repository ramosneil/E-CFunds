// Automatic app updates (Neil, 2026-11-15).
// When a new version is downloaded and ready, a banner says "New version ready — pull down to update" (phones) /
// "Update" button (computers). Pulling down installs it at once. If nobody does, it installs by itself the moment the
// person leaves the screen (Home button, another app or tab), so they come back to the new version.
// Website: service worker (AppStatus.tsx). Android app: ota.ts.
import { useSyncExternalStore } from 'react';

let pending: (() => void) | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function onHide() { if (document.visibilityState === 'hidden') installUpdate(); }

/** A new version is ready: remember how to switch to it (the newest wins) and show the banner. */
export function offerUpdate(apply: () => void) {
  const first = !pending;
  pending = apply;
  if (first) document.addEventListener('visibilitychange', onHide);
  emit();
}

/** Switch to the waiting version now (pull-to-refresh, the banner's button, or leaving the screen). */
export function installUpdate(): boolean {
  const f = pending;
  if (!f) return false;
  pending = null;
  document.removeEventListener('visibilitychange', onHide);
  emit();
  f();
  return true;
}

export const updateReady = () => !!pending;
export function useUpdateReady() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, updateReady);
}

/** Asks for an update check right now (pull-to-refresh). Website: AppStatus listens; Android: ota.ts. */
export const CHECK_UPDATE_EVENT = 'ecfunds:check-update';
export const requestUpdateCheck = () => window.dispatchEvent(new Event(CHECK_UPDATE_EVENT));
