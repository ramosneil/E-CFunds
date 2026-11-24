// Signed-out welcome / landing page (Neil approved the design, 2026-11-24). Nothing here signs anyone in: it explains
// E-CFunds and sends people to the existing Sign in (/login) and Create account (/register) screens.
//   · Computers and tablets (lg+): a full landing page — hero, how it works, what each role gets, the app, footer.
//   · Phones and the Android app: one screen, no scrolling — what it is, three points, two big buttons within reach.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, Coins, Download, FileText, GraduationCap, Landmark, Lock, ReceiptText, Send, Smartphone, UserCheck, Wallet } from 'lucide-react';
import { ThemeToggle } from '../../components/ui';
import { APK_URL } from '../../components/AndroidAppLink';
import { IphoneSteps } from '../../components/IphoneInstall';
import { isNative } from '../../lib/native';
import { Brand, LegalFooter, SampleFundCard } from './AuthLayout';

const onAndroidBrowser = () => !isNative && /Android/i.test(navigator.userAgent);

// Link styled as a button (the routes stay plain links: keyboard, long-press and "open in new tab" all work).
const btn = 'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2';
const goldBtn = `${btn} bg-pocket-cash text-on-gold hover:brightness-105 focus-visible:outline-pocket-cash`;
const lineBtn = `${btn} border border-white/35 text-white hover:bg-white/10 focus-visible:outline-white`;

const TRUST: [ReactNode, string][] = [
  [<Lock key="l" className="size-4" aria-hidden />, 'One ledger nobody can quietly edit'],
  [<ReceiptText key="r" className="size-4" aria-hidden />, 'Numbered receipt for every payment'],
  [<UserCheck key="u" className="size-4" aria-hidden />, 'SAS approves every account'],
];

const STEPS: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Coins className="size-5" aria-hidden />, title: 'Collect', body: 'The treasurer records each member’s dues. A numbered receipt is issued right away.' },
  { icon: <Send className="size-5" aria-hidden />, title: 'Request', body: 'Remit the cash on hand to SAS, or send a resolution request for an activity.' },
  { icon: <FileText className="size-5" aria-hidden />, title: 'Approve and report', body: 'SAS approves and checks the liquidation. The Financial Report fills itself in.' },
];

const ROLES: { icon: ReactNode; who: string; points: string[] }[] = [
  { icon: <GraduationCap className="size-5" aria-hidden />, who: 'Students', points: ['Your dues for each semester', 'Your receipts', 'Where every org’s money goes'] },
  { icon: <Wallet className="size-5" aria-hidden />, who: 'Treasurers', points: ['Members and payments', 'Remittances and resolution requests', 'Liquidation and the Financial Report'] },
  { icon: <Landmark className="size-5" aria-hidden />, who: 'SAS', points: ['Approve accounts and requests', 'Every org’s funds in one place', 'Reports and the activity log'] },
];

export function Welcome() {
  return (
    <>
      <PhoneWelcome />
      <DesktopWelcome />
    </>
  );
}

/** Phones and the Android app: everything on one screen, buttons at the bottom where the thumb is. */
function PhoneWelcome() {
  return (
    <div className="lg:hidden min-h-dvh bg-hero text-white flex flex-col px-5 sm:px-[max(1.25rem,calc(50%-15rem))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <Brand light />
        <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
      </header>
      <main className="flex-1 flex flex-col justify-center py-6">
        <p className="text-[12.5px] font-semibold text-hero-muted">OMSC Mamburao · Office of Student Affairs and Services</p>
        <h1 className="font-display font-extrabold text-[32px] leading-[1.12] mt-3">Every peso of every club, out in the open.</h1>
        <p className="text-hero-muted text-[15px] mt-3">Dues, remittances and resolution requests for OMSC student organizations and clubs.</p>
        <ul className="mt-6 space-y-2.5 text-[14.5px]">
          {['See your dues and receipts', 'Treasurers record and request', 'SAS approves every peso'].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="size-6 rounded-full bg-white/12 grid place-items-center shrink-0"><Check className="size-3.5" aria-hidden /></span>{t}
            </li>
          ))}
        </ul>
      </main>
      <div className="space-y-3">
        <Link to="/login" className={`${goldBtn} w-full h-[54px] text-[16px]`}>Sign in</Link>
        <Link to="/register" className={`${lineBtn} w-full h-[54px] text-[16px]`}>Create an account</Link>
        {onAndroidBrowser() && (
          <a href={APK_URL} rel="noopener" className="flex items-center justify-center gap-2 min-h-11 text-[14px] font-semibold text-hero-muted hover:text-white">
            <Download className="size-4" aria-hidden />Get the Android app
          </a>
        )}
        <p className="text-center text-[12.5px] text-hero-muted pt-1">
          <Link to="/privacy" className="inline-block py-2 hover:text-white">Privacy</Link><span aria-hidden> · </span>
          <Link to="/terms" className="inline-block py-2 hover:text-white">Terms</Link>
        </p>
      </div>
    </div>
  );
}

/** Computers and tablets: a short landing page. */
function DesktopWelcome() {
  return (
    <div className="hidden lg:block min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 bg-surface/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center gap-3 whitespace-nowrap">
          <Link to="/welcome" aria-label="E-CFunds home" className="shrink-0"><Brand /></Link>
          <span className="hidden xl:inline text-[13px] text-muted border-l border-line pl-4">OMSC Mamburao · SAS</span>
          <nav aria-label="On this page" className="ml-auto flex items-center gap-1 text-[14px] font-semibold text-muted">
            <a href="#how" className="px-3 py-2 rounded-[10px] hover:text-ink hover:bg-surface2">How it works</a>
            <a href="#roles" className="px-3 py-2 rounded-[10px] hover:text-ink hover:bg-surface2">Who it’s for</a>
            {!isNative && <a href="#app" className="px-3 py-2 rounded-[10px] hover:text-ink hover:bg-surface2">Get the app</a>}
          </nav>
          <ThemeToggle />
          <Link to="/login" className={`${btn} h-11 px-4 text-[14px] border border-line text-ink hover:bg-surface2 focus-visible:outline-primary`}>Sign in</Link>
          <Link to="/register" className={`${btn} h-11 px-4 text-[14px] bg-primary text-on-primary hover:brightness-110 focus-visible:outline-primary`}>Create account</Link>
        </div>
      </header>

      <section className="bg-hero text-white">
        <div className="max-w-6xl mx-auto px-8 py-20 grid grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-hero-muted">For OMSC student organizations and clubs</span>
            <h1 className="font-display font-extrabold text-[52px] leading-[1.05] mt-5">Every peso of every club, out in the open.</h1>
            <p className="text-hero-muted text-[18px] leading-relaxed mt-5 max-w-[520px]">
              Dues, remittances and resolution requests in one ledger nobody can quietly edit. SAS approves every
              peso, and students can see where the money goes.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/login" className={`${goldBtn} h-[54px] px-7 text-[16px]`}>Sign in<ArrowRight className="size-5" aria-hidden /></Link>
              <Link to="/register" className={`${lineBtn} h-[54px] px-7 text-[16px]`}>Create an account</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-hero-muted">
              {TRUST.map(([icon, t]) => <li key={t} className="flex items-center gap-2">{icon}{t}</li>)}
            </ul>
          </div>
          <SampleFundCard />
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-8">
        <section id="how" className="py-16 scroll-mt-16" aria-labelledby="how-title">
          <h2 id="how-title" className="font-display font-extrabold text-[30px]">How it works</h2>
          <p className="text-muted mt-2 text-[16px]">The same three steps for every organization and club.</p>
          <ol className="mt-8 grid grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-[20px] border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="size-11 rounded-[14px] bg-primary-soft text-primary grid place-items-center">{s.icon}</span>
                  <span className="micro text-muted">Step {i + 1}</span>
                </div>
                <h3 className="font-display font-bold text-[19px] mt-4">{s.title}</h3>
                <p className="text-muted mt-1.5 text-[15px] leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="roles" className="pb-16 scroll-mt-16" aria-labelledby="roles-title">
          <h2 id="roles-title" className="font-display font-extrabold text-[30px]">Made for every role</h2>
          <p className="text-muted mt-2 text-[16px]">One account per person. SAS approves it, then you see what your role needs.</p>
          <div className="mt-8 grid grid-cols-3 gap-5">
            {ROLES.map((r) => (
              <div key={r.who} className="rounded-[20px] border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="size-11 rounded-[14px] bg-gold-soft text-gold-text grid place-items-center">{r.icon}</span>
                  <h3 className="font-display font-bold text-[19px]">{r.who}</h3>
                </div>
                <ul className="mt-4 space-y-2 text-[15px]">
                  {r.points.map((p) => <li key={p} className="flex items-start gap-2"><Check className="size-4 text-ok mt-1 shrink-0" aria-hidden />{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {!isNative && (
          <section id="app" className="pb-16 scroll-mt-16" aria-labelledby="app-title">
            <div className="rounded-[24px] bg-primary-soft p-8 grid grid-cols-[1fr_1fr] gap-8">
              <div>
                <span className="size-12 rounded-[16px] bg-surface text-primary grid place-items-center"><Smartphone className="size-6" aria-hidden /></span>
                <h2 id="app-title" className="font-display font-extrabold text-[26px] mt-4">Use E-CFunds on your phone</h2>
                <p className="text-muted mt-2 text-[15px] leading-relaxed">The Android app gets notifications and updates itself. On iPhone, add the website to your Home Screen.</p>
                <a href={APK_URL} rel="noopener" className={`${btn} mt-6 h-12 px-5 text-[15px] bg-primary text-on-primary hover:brightness-110 focus-visible:outline-primary`}>
                  <Download className="size-5" aria-hidden />Get the Android app
                </a>
                <p className="text-[13px] text-muted mt-2">Free. If your phone asks, allow installing from your browser.</p>
              </div>
              <div className="rounded-[20px] bg-surface p-6">
                <p className="font-semibold mb-4">On iPhone</p>
                <IphoneSteps />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-8 py-6"><LegalFooter /></div>
      </footer>
    </div>
  );
}
