import { useState, type InputHTMLAttributes } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { Input } from './ui';
import { PASSWORD_RULES, STRENGTH_LABEL, strength } from '../lib/password';

/** Password field with an eye button to show / hide what was typed. */
export function PasswordInput(p: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...p} type={show ? 'text' : 'password'} className={`pr-12 ${p.className ?? ''}`} autoCapitalize="none" spellCheck={false} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 size-10 grid place-items-center rounded-[10px] text-muted hover:text-ink hover:bg-surface2 cursor-pointer">
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </div>
  );
}

const BAR = ['bg-line', 'bg-bad', 'bg-warn', 'bg-primary', 'bg-ok'];
const TEXT = ['text-muted', 'text-bad', 'text-warn', 'text-primary', 'text-ok'];

/** Live strength meter + the rule checklist (ticks as each rule is met). */
export function PasswordStrength({ value }: { value: string }) {
  const s = strength(value);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= s ? BAR[s] : 'bg-line'}`} />)}
        </div>
        <span className={`text-[12.5px] font-semibold w-14 text-right ${TEXT[s]}`}>{STRENGTH_LABEL[s]}</span>
      </div>
      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value);
          return (
            <li key={r.key} className={`flex items-center gap-1.5 text-[12.5px] ${ok ? 'text-ok' : 'text-muted'}`}>
              {ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0 opacity-60" aria-hidden />}
              <span>{r.label}</span><span className="sr-only">{ok ? '(done)' : '(missing)'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[12px] text-muted">Example of a strong one: <span className="font-mono">Mamburao#2026</span> — make up your own.</p>
    </div>
  );
}
