import { lazy, Suspense, useState } from 'react';
import { useLocation } from 'react-router';
import { Sparkles } from 'lucide-react';

const ChatPanel = lazy(() => import('./ChatPanel'));

/** Floating "Ask" button for every approved user. Hidden on Messages (its composer sits in the same corner). */
export function ChatButton() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  if (loc.pathname.startsWith('/messages')) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Ask E-CFunds assistant"
          className="fixed z-40 right-4 bottom-[92px] lg:right-8 lg:bottom-8 h-14 pl-4 pr-5 rounded-full bg-primary text-on-primary shadow-xl flex items-center gap-2 font-semibold hover:brightness-110 cursor-pointer">
          <Sparkles className="size-5" aria-hidden /><span className="hidden sm:inline">Ask E-CFunds</span><span className="sm:hidden">Ask</span>
        </button>
      )}
      {open && <Suspense fallback={null}><ChatPanel onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
