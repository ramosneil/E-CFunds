// In-app confirmation / question sheet, replacing window.confirm / window.prompt / window.alert (which phone app
// windows often don't show, so the action silently did nothing). <ConfirmHost /> renders it.
export type Ask = {
  title: string;
  body?: string;
  confirm: string;                 // button text, e.g. "Delete conversation"
  tone?: 'bad' | 'primary';
  input?: { label: string; placeholder?: string; minLength?: number };   // ask for text (e.g. a reason)
  alertOnly?: boolean;             // just an OK button
};
type Pending = Ask & { resolve: (v: string | boolean | null) => void };

let current: Pending | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const confirmStore = {
  get: () => current,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  finish: (v: string | boolean | null) => { const c = current; current = null; emit(); c?.resolve(v); },
};

function open(a: Ask) {
  return new Promise<string | boolean | null>((resolve) => {
    current?.resolve(null);
    current = { ...a, resolve };
    emit();
  });
}

/** Yes/no. Resolves true when confirmed. */
export const confirmAsk = async (a: Omit<Ask, 'input' | 'alertOnly'>) => (await open(a)) === true;
/** Ask for text. Resolves the text, or null when cancelled. */
export const promptAsk = async (a: Ask & { input: NonNullable<Ask['input']> }) => {
  const v = await open(a);
  return typeof v === 'string' ? v : null;
};
/** Show a message with OK. */
export const alertAsk = async (title: string, body?: string) => { await open({ title, body, confirm: 'OK', alertOnly: true }); };
