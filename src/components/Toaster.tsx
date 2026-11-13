import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { Bell, CheckCircle2, Info, X } from 'lucide-react';
import { toastStore, type Toast } from '../lib/toast';

/** Pop-ups: top-centre on phones, top-right on desktop. Tap a pop-up to open what it's about. */
export function Toaster() {
  const list = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  if (!list.length) return null;
  return (
    <div aria-live="polite" className="fixed z-[70] inset-x-3 sm:inset-x-auto sm:right-6 top-[max(12px,env(safe-area-inset-top))] sm:w-[380px] flex flex-col gap-2 pointer-events-none">
      {list.map((t) => <Item key={t.id} t={t} />)}
    </div>
  );
}

function Item({ t }: { t: Toast }) {
  const nav = useNavigate();
  const Icon = t.tone === 'ok' ? CheckCircle2 : t.tone === 'warn' ? Info : Bell;
  const tint = t.tone === 'ok' ? 'bg-ok-soft text-ok' : t.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-primary-soft text-primary';
  const open = () => { if (t.href) { nav(t.href); toastStore.dismiss(t.id); } };
  return (
    <div role="status" className="pointer-events-auto animate-[toast-in_.22s_ease-out] bg-surface border border-line rounded-[18px] shadow-2xl p-3.5 flex gap-3 items-start">
      <span className={`size-9 rounded-full grid place-items-center shrink-0 ${tint}`}><Icon className="size-[18px]" aria-hidden /></span>
      <button type="button" onClick={open} className={`flex-1 min-w-0 text-left ${t.href ? 'cursor-pointer' : 'cursor-default'}`}>
        <p className="font-semibold text-[14px] leading-snug">{t.title}</p>
        {t.body && <p className="text-[13px] text-muted mt-0.5 leading-snug">{t.body}</p>}
        {t.action && (
          <span onClick={(e) => { e.stopPropagation(); t.action!.run(); toastStore.dismiss(t.id); }}
            className="inline-flex mt-2 h-8 px-3 rounded-[10px] bg-primary text-on-primary text-[13px] font-semibold items-center">{t.action.label}</span>
        )}
      </button>
      <button type="button" aria-label="Dismiss" onClick={() => toastStore.dismiss(t.id)} className="size-8 -m-1 grid place-items-center text-muted hover:text-ink cursor-pointer"><X className="size-4" /></button>
    </div>
  );
}
