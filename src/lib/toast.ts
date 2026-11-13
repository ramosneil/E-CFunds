// Tiny pop-up (toast) store shared by app updates and notifications. <Toaster /> renders them.
import { chime } from './chime';

export type Toast = {
  id: number;
  title: string;
  body?: string;
  tone?: 'info' | 'ok' | 'warn';
  href?: string;          // in-app route opened on tap
  action?: { label: string; run: () => void };
  sticky?: boolean;       // stays until dismissed
};

let toasts: Toast[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const toastStore = {
  get: () => toasts,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  dismiss: (id: number) => { toasts = toasts.filter((t) => t.id !== id); emit(); },
};

/** Shows a pop-up (max 3 at a time), plays the chime unless `silent`, hides after 5 s unless sticky. */
export function toast(t: Omit<Toast, 'id'> & { silent?: boolean }) {
  const id = ++seq;
  toasts = [...toasts.slice(-2), { ...t, id }];
  emit();
  if (!t.silent) chime();
  if (!t.sticky) setTimeout(() => toastStore.dismiss(id), 5000);
  return id;
}
