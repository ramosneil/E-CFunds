import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizontal, Sparkles, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

type Turn = { role: 'user' | 'assistant'; text: string; error?: boolean };

const SUGGEST: Record<string, string[]> = {
  admin: ['How much do all orgs have in total?', 'Which requests are waiting for me?', 'Which org has the most saved with SAS?'],
  treasurer: ['How much can I remit to SAS now?', 'Who still owes dues?', 'Paano mag-file ng expense?'],
  student: ['Have I paid all my dues?', 'How much does each org have?', 'Paano mag-sign in gamit ang Student ID?'],
};

// The conversation lives only in memory for this visit (kept while the panel is closed, gone on reload).
let memory: Turn[] = [];

/** The assistant's chat panel (lazy-loaded the first time the button is pressed). */
export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [turns, setTurns] = useState<Turn[]>(memory);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null | undefined>(undefined);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { memory = turns; end.current?.scrollIntoView({ block: 'end' }); }, [turns]);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.filter((t) => !t.error).map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: 'user', text: question }]);
    setQ(''); setBusy(true);
    const { data, error } = await supabase.functions.invoke<{ reply: string; remaining: number | null }>('chat', { body: { question, history } });
    let msg = data?.reply, bad = false;
    if (error || !data) {
      bad = true; msg = 'The assistant could not answer just now. Try again.';
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === 'function') { try { const j = await ctx.json(); msg = j.error ?? msg; if ('remaining' in j) setLeft(j.remaining); } catch { /* keep default */ } }
    } else setLeft(data.remaining);
    setTurns((t) => [...t, { role: 'assistant', text: msg ?? '', error: bad }]);
    setBusy(false);
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(q); }
  }

  const role = profile?.role ?? 'student';
  return (
    <div role="dialog" aria-label="E-CFunds assistant" className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] h-[min(78dvh,640px)] bg-surface border border-line rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
        <span className="size-10 rounded-full bg-primary text-on-primary grid place-items-center"><Sparkles className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Ask E-CFunds</p>
          <p className="text-[12px] text-muted">{left === undefined ? 'Answers from your own data' : left === null ? 'Unlimited for SAS' : `${left} question${left === 1 ? '' : 's'} left today`}</p>
        </div>
        <button onClick={onClose} aria-label="Close assistant" className="size-10 grid place-items-center rounded-full hover:bg-surface2 cursor-pointer"><X className="size-5" /></button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2" aria-live="polite">
        {!turns.length && (
          <div className="text-center pt-4">
            <p className="font-semibold">Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! Ask about your funds.</p>
            <p className="text-[13px] text-muted mt-1">English, Filipino or Taglish. I only see what you can see in the app.</p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGEST[role].map((s) => (
                <button key={s} onClick={() => void ask(s)} className="text-left text-[14px] px-4 py-2.5 rounded-[14px] border border-line hover:bg-surface2 cursor-pointer">{s}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-[18px] px-4 py-2.5 text-[14.5px] whitespace-pre-wrap break-words ${
              t.role === 'user' ? 'bg-primary text-on-primary rounded-br-[6px]' : t.error ? 'bg-bad-soft text-bad rounded-bl-[6px]' : 'bg-surface2 rounded-bl-[6px]'}`}>
              {t.text}
            </div>
          </div>
        ))}
        {busy && <div className="flex"><div className="bg-surface2 rounded-[18px] rounded-bl-[6px] px-4 py-3 flex gap-1" aria-label="Thinking">
          {[0, 1, 2].map((d) => <span key={d} className="size-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}
        </div></div>}
        <div ref={end} />
      </div>

      <div className="border-t border-line p-3 flex items-end gap-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <label htmlFor="ask" className="sr-only">Your question</label>
        <textarea id="ask" ref={box} rows={1} value={q} maxLength={600} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          placeholder="Ask about your funds…" className="flex-1 resize-none max-h-32 min-h-12 px-4 py-3 rounded-[16px] bg-surface2 border border-transparent focus:border-primary outline-none field-sizing-content" />
        <button onClick={() => void ask(q)} disabled={busy || !q.trim()} aria-label="Send question"
          className="size-12 shrink-0 rounded-full bg-primary text-on-primary grid place-items-center disabled:opacity-40 cursor-pointer hover:brightness-110">
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  );
}
