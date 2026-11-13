import { useState, type FormEvent } from 'react';
import { Megaphone } from 'lucide-react';
import { supabase, errorText } from '../lib/supabase';
import { toast } from '../lib/toast';
import { Alert, Button, Field, Input, Sheet } from './ui';

type Audience = 'students' | 'treasurers' | 'everyone';
const OPTIONS: [Audience, string][] = [['students', 'Students'], ['treasurers', 'Treasurers'], ['everyone', 'Everyone']];

/** SAS: send an announcement — it arrives as a notification (bell + pop-up + sound). */
export function AnnounceSheet({ onClose }: { onClose: () => void }) {
  const [audience, setAudience] = useState<Audience>('students');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('announce', { p_audience: audience, p_title: title.trim(), p_body: body.trim() });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    toast({ title: 'Announcement sent', body: `${data ?? 0} ${data === 1 ? 'person' : 'people'} will see it.`, tone: 'ok', silent: true });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="New announcement">
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="text-[13px] font-semibold text-muted mb-1.5">Send to</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {OPTIONS.map(([v, label]) => (
              <label key={v} className={`h-11 rounded-[12px] border grid place-items-center text-[14px] font-semibold cursor-pointer ${audience === v ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface hover:bg-surface2'}`}>
                <input type="radio" name="audience" value={v} checked={audience === v} onChange={() => setAudience(v)} className="sr-only" />{label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Title"><Input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Orientation on Friday" /></Field>
        <Field label="Message" hint={`${body.length}/500`}>
          <textarea required maxLength={500} rows={4} value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full px-4 py-3 rounded-[12px] bg-surface border border-line outline-none focus:border-primary placeholder:text-muted/70 resize-y"
            placeholder="What should they know?" />
        </Field>
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]"><Megaphone className="size-5" />Send announcement</Button>
      </form>
    </Sheet>
  );
}
