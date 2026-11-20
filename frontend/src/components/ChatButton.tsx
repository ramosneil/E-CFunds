import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Sparkles } from 'lucide-react';

const ChatPanel = lazy(() => import('./ChatPanel'));
const OPEN = 'ecfunds:ask';

/** ✨ in the phone's top bar (next to the bell) — nothing floats over the page on phones. */
export function AskTopButton() {
  return (
    <button onClick={() => window.dispatchEvent(new Event(OPEN))} aria-label="Ask E-CFunds assistant" title="Ask E-CFunds"
      className="size-11 grid place-items-center rounded-full text-primary hover:bg-surface2 cursor-pointer">
      <Sparkles className="size-5" aria-hidden />
    </button>
  );
}

/** The assistant panel for every approved user. Computers also get a floating "Ask E-CFunds" button
 *  (bottom right; hidden on Messages, whose composer sits in the same corner). Phones use AskTopButton. */
export function ChatButton() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN, on);
    return () => window.removeEventListener(OPEN, on);
  }, []);
  return (
    <>
      {!open && !loc.pathname.startsWith('/messages') && (
        <button onClick={() => setOpen(true)} aria-label="Ask E-CFunds assistant"
          className="hidden lg:flex fixed z-40 right-8 bottom-8 h-14 pl-4 pr-5 rounded-full bg-primary text-on-primary shadow-xl items-center gap-2 font-semibold hover:brightness-110 cursor-pointer">
          <Sparkles className="size-5" aria-hidden />Ask E-CFunds
        </button>
      )}
      {open && <Suspense fallback={null}><ChatPanel onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
