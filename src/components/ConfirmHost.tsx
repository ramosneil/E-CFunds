import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { confirmStore } from '../lib/confirm';
import { Button, Field, Input, Sheet } from './ui';

/** Renders the in-app confirmation / question sheet (src/lib/confirm.ts). */
export function ConfirmHost() {
  const a = useSyncExternalStore(confirmStore.subscribe, confirmStore.get);
  const [text, setText] = useState('');
  useEffect(() => { setText(''); }, [a]);
  if (!a) return null;
  const min = a.input?.minLength ?? 1;
  const ok = !a.input || text.trim().length >= min;
  const submit = (e: FormEvent) => { e.preventDefault(); if (ok) confirmStore.finish(a.input ? text.trim() : true); };
  return (
    <Sheet open onClose={() => confirmStore.finish(null)} title={a.title}>
      <form onSubmit={submit} className="space-y-4">
        {a.body && <p className="text-[15px] text-muted whitespace-pre-line">{a.body}</p>}
        {a.input && (
          <Field label={a.input.label} hint={min > 1 ? `At least ${min} characters.` : undefined}>
            <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={a.input.placeholder} />
          </Field>
        )}
        <div className={`grid gap-3 ${a.alertOnly ? '' : 'grid-cols-2'}`}>
          {!a.alertOnly && <Button type="button" variant="soft" className="h-12" onClick={() => confirmStore.finish(null)}>Cancel</Button>}
          <Button type="submit" disabled={!ok}
            className={`h-12 ${a.tone === 'bad' ? '!bg-bad !text-white' : ''}`}>{a.confirm}</Button>
        </div>
      </form>
    </Sheet>
  );
}
