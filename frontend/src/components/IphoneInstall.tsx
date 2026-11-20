import { useState, type ReactNode } from 'react';
import { ChevronDown, Share, Smartphone, SquarePlus } from 'lucide-react';
import { isNative } from '../lib/native';
import { isIos, isStandalone } from '../lib/webpush';

/** iPhone (Safari): 3 steps to put E-CFunds on the Home Screen — it then opens full screen and can get notifications. */
export function IphoneSteps() {
  const steps: [ReactNode, ReactNode][] = [
    [<Share key="s" className="size-5" aria-hidden />, <>In <b>Safari</b>, tap <b>Share</b> (the square with an arrow, at the bottom).</>],
    [<SquarePlus key="a" className="size-5" aria-hidden />, <>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</>],
    [<Smartphone key="o" className="size-5" aria-hidden />, <>Open <b>E-CFunds</b> from your Home Screen. Turn on notifications in <b>My account</b>.</>],
  ];
  return (
    <ol className="space-y-3">
      {steps.map(([icon, text], i) => (
        <li key={i} className="flex items-start gap-3 text-[14px]">
          <span className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">{icon}</span>
          <span className="pt-1.5"><b className="text-muted mr-1">{i + 1}.</b>{text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Sign-in page: "On iPhone? Add E-CFunds to your Home Screen" (iPhone/iPad Safari only, not once installed). */
export function IphoneAppHint() {
  const [open, setOpen] = useState(false);
  if (isNative || !isIos() || isStandalone()) return null;
  return (
    <div className="mt-6 rounded-[16px] border border-line bg-surface">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer">
        <span className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0"><Smartphone className="size-5" aria-hidden /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[14px]">Use E-CFunds like an app on iPhone</span>
          <span className="block text-[12.5px] text-muted">Add it to your Home Screen — full screen, with notifications.</span>
        </span>
        <ChevronDown className={`size-5 text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && <div className="px-4 pb-4"><IphoneSteps /></div>}
    </div>
  );
}
