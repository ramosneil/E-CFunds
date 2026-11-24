// Signed-out welcome / landing page. v1 approved 2026-11-24; v2 the same day (Neil): premium navy-and-gold,
// business-grade, gradients, product visuals instead of photos. Nothing here signs anyone in: it explains E-CFunds and
// sends people to the existing Sign in (/login) and Create account (/register) screens.
//   · Computers (lg+): a landing page — hero with the live app window, how it works, what each role gets, the
//     Financial Report, the phone app, a closing call and the footer.
//   · Phones and the Android app: one screen — what it is, an example fund card, two big buttons within reach.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BadgeCheck, Check, Coins, Download, FileSpreadsheet, GraduationCap, Landmark, Lock, ReceiptText, Send, UserCheck, Wallet } from 'lucide-react';
import { ThemeToggle } from '../../components/ui';
import { APK_URL } from '../../components/AndroidAppLink';
import { IphoneSteps } from '../../components/IphoneInstall';
import { isNative } from '../../lib/native';
import { Brand, SampleFundCard } from './AuthLayout';
import { AppWindow, PhoneMini, ReceiptChip, ReportPreview } from './landing';

const onAndroidBrowser = () => !isNative && /Android/i.test(navigator.userAgent);

// Links styled as buttons (routes stay plain links: keyboard, long-press and "open in new tab" all work).
const btn = 'lux-press inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2';
const goldBtn = `${btn} lux-gold-btn focus-visible:outline-pocket-cash`;
const glassBtn = `${btn} border border-white/30 bg-white/[0.06] text-white hover:bg-white/[0.12] focus-visible:outline-white`;
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

const TRUST: [ReactNode, string][] = [
  [<Lock key="l" className="size-4" aria-hidden />, 'A ledger nobody can quietly edit'],
  [<ReceiptText key="r" className="size-4" aria-hidden />, 'A numbered receipt for every payment'],
  [<UserCheck key="u" className="size-4" aria-hidden />, 'Every account approved by SAS'],
  [<FileSpreadsheet key="f" className="size-4" aria-hidden />, 'The SAS Financial Report in one tap'],
];

const STEPS: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Coins className="size-5" aria-hidden />, title: 'Collect dues', body: 'The treasurer records each member’s payment and a numbered receipt is issued on the spot.' },
  { icon: <Send className="size-5" aria-hidden />, title: 'Request funds', body: 'Remit cash on hand to SAS, or send a resolution request for an activity with the signed file.' },
  { icon: <BadgeCheck className="size-5" aria-hidden />, title: 'Approve and liquidate', body: 'SAS approves, the treasurer liquidates with receipts, and unspent money returns to savings.' },
];

const ROLES: { icon: ReactNode; who: string; line: string; points: string[]; demo: ReactNode }[] = [
  {
    icon: <GraduationCap className="size-5" aria-hidden />, who: 'Students', line: 'See what you owe and where it goes.',
    points: ['Your dues for each semester', 'Your receipts, anytime', 'Every org’s approved spending'],
    demo: <DemoRow left={<><b className="block text-[13px]">Sports Club · 1st semester</b><span className="text-[12px] text-muted money">Receipt SPORTSCLUB-2026-0012</span></>} right={<span className="rounded-full bg-ok-soft text-ok text-[12px] font-semibold px-2.5 py-1">Paid</span>} />,
  },
  {
    icon: <Wallet className="size-5" aria-hidden />, who: 'Treasurers', line: 'Run your organization’s money in one place.',
    points: ['Members and payments by section', 'Remittances and resolution requests', 'Liquidation and the Financial Report'],
    demo: <DemoRow left={<><b className="block text-[13px]">Dela Cruz, Juan · 3A</b><span className="text-[12px] text-muted">To collect</span></>} right={<span className="rounded-[10px] bg-gold text-on-gold text-[12px] font-bold px-3 py-1.5">Record ₱20</span>} />,
  },
  {
    icon: <Landmark className="size-5" aria-hidden />, who: 'SAS', line: 'Oversee every organization at once.',
    points: ['Approve accounts and requests', 'Every org’s funds side by side', 'Reports and a full activity log'],
    demo: <DemoRow left={<><b className="block text-[13px]">Resolution · Intramurals</b><span className="text-[12px] text-muted">Sports Club · ₱1,500.00</span></>} right={<span className="rounded-[10px] bg-primary text-on-primary text-[12px] font-bold px-3 py-1.5">Approve</span>} />,
  },
];

function DemoRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="rounded-[14px] border border-line bg-bg p-3.5 flex items-center justify-between gap-3" aria-hidden><span className="min-w-0">{left}</span>{right}</div>;
}

/** The entrance plays once; after 1.2 s everything is shown whatever happened to the animation (hidden tab). */
export function useEntered() {
  const [done, setDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDone(true), 1200); return () => clearTimeout(t); }, []);
  return done ? 'lux-entered' : '';
}

export function Welcome() {
  const entered = useEntered();
  return (
    <div className={entered}>
      <PhoneWelcome />
      <DesktopWelcome />
    </div>
  );
}

/** Phones and the Android app: everything on one screen, buttons at the bottom where the thumb is. */
function PhoneWelcome() {
  return (
    <div className="lg:hidden relative min-h-dvh lux-ground text-white overflow-hidden">
      <div aria-hidden className="absolute inset-0 lux-grid" />
      <div className="relative min-h-dvh flex flex-col px-5 sm:px-[max(1.25rem,calc(50%-15rem))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between lux-enter">
          <Brand light />
          <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
        </header>
        <main className="flex-1 flex flex-col justify-center py-6">
          <p className="lux-enter text-[12.5px] font-semibold text-hero-muted" style={d(60)}>Fund monitoring · OMSC Mamburao student organizations</p>
          <h1 className="lux-enter font-display font-extrabold text-[33px] leading-[1.1] mt-3" style={d(120)}>Every peso of every club, <span className="lux-gold-text">out in the open.</span></h1>
          <p className="lux-enter text-hero-muted text-[15px] mt-3" style={d(180)}>Dues, remittances and resolution requests, approved by the Office of Student Affairs and Services.</p>
          <div className="lux-enter mt-6 [@media(max-height:700px)]:hidden" style={d(260)}><SampleFundCard compact /></div>
        </main>
        <div className="space-y-3 lux-enter" style={d(320)}>
          <Link to="/login" className={`${goldBtn} w-full h-[54px] text-[16px]`}>Sign in</Link>
          <Link to="/register" className={`${glassBtn} w-full h-[54px] text-[16px]`}>Create an account</Link>
          {onAndroidBrowser() && (
            <a href={APK_URL} rel="noopener" className="flex items-center justify-center gap-2 min-h-11 text-[14px] font-semibold text-hero-muted hover:text-white">
              <Download className="size-4" aria-hidden />Get the Android app
            </a>
          )}
          <p className="text-center text-[12.5px] text-hero-muted">
            <Link to="/privacy" className="inline-block py-2 hover:text-white">Privacy</Link><span aria-hidden> · </span>
            <Link to="/terms" className="inline-block py-2 hover:text-white">Terms</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Computers: the landing page. */
function DesktopWelcome() {
  const wrap = 'max-w-[1200px] mx-auto px-10';
  return (
    <div className="hidden lg:block min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold">Skip to content</a>
      <header className="sticky top-0 z-30 bg-[#0A1747]/85 backdrop-blur-md border-b border-white/10 text-white">
        <div className={`${wrap} h-[68px] flex items-center gap-3 whitespace-nowrap`}>
          <Link to="/welcome" aria-label="E-CFunds home" className="shrink-0 rounded-xl"><Brand light /></Link>
          <span className="hidden xl:inline text-[13px] text-hero-muted border-l border-white/15 pl-4 ml-1">OMSC Mamburao · SAS</span>
          <nav aria-label="On this page" className="ml-auto flex items-center gap-1 text-[14px] font-semibold text-hero-muted">
            {[['#how', 'How it works'], ['#roles', 'Who it’s for'], ['#report', 'Reports'], ...(!isNative ? [['#app', 'Mobile app']] : [])].map(([h, t]) => (
              <a key={h} href={h} className="px-3 py-2 rounded-[10px] hover:text-white hover:bg-white/10">{t}</a>
            ))}
          </nav>
          <ThemeToggle className="text-hero-muted! hover:bg-white/10!" />
          <Link to="/login" className={`${btn} h-11 px-4 text-[14px] text-white hover:bg-white/10 focus-visible:outline-white`}>Sign in</Link>
          <Link to="/register" className={`${btn} h-11 px-5 text-[14px] bg-white text-[#13297A] hover:bg-[#EEF2FF] focus-visible:outline-white`}>Create account</Link>
        </div>
      </header>

      <section className="relative lux-ground text-white overflow-hidden -mt-px">
        <div aria-hidden className="absolute inset-0 lux-grid" />
        <div className={`${wrap} relative min-h-[calc(100dvh-68px)] grid grid-rows-[1fr_auto]`}>
          <div className="grid grid-cols-[1fr_1.05fr] gap-12 items-center py-14">
            <div>
              <p className="lux-enter inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-semibold text-hero-muted">
                <span className="size-1.5 rounded-full bg-pocket-cash" aria-hidden />Fund monitoring for OMSC Mamburao student organizations
              </p>
              <h1 className="lux-enter font-display font-extrabold text-[clamp(42px,4.4vw,60px)] leading-[1.04] tracking-[-0.01em] mt-6" style={d(80)}>
                Every peso of every club, <span className="lux-gold-text">out in the open.</span>
              </h1>
              <p className="lux-enter text-hero-muted text-[18px] leading-relaxed mt-6 max-w-[520px]" style={d(160)}>
                E-CFunds keeps the dues, remittances and resolution requests of every organization and club in one
                ledger, approved by the Office of Student Affairs and Services.
              </p>
              <div className="lux-enter mt-9 flex gap-3" style={d(240)}>
                <Link to="/login" className={`${goldBtn} h-[56px] px-7 text-[16px]`}>Sign in<ArrowRight className="size-5" aria-hidden /></Link>
                <Link to="/register" className={`${glassBtn} h-[56px] px-7 text-[16px]`}>Create an account</Link>
              </div>
            </div>
            <div className="lux-enter relative" style={d(200)}>
              <div aria-hidden className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(60%_60%_at_60%_40%,rgb(138_164_255/.35),transparent_70%)]" />
              <AppWindow className="relative" />
              <ReceiptChip className="absolute -left-10 -bottom-14" />
            </div>
          </div>
          <ul className="lux-enter grid grid-cols-4 gap-6 border-t border-white/10 py-6 text-[14px] text-hero-muted" style={d(320)}>
            {TRUST.map(([icon, t]) => <li key={t} className="flex items-center gap-2.5"><span className="size-8 rounded-full bg-white/[0.08] grid place-items-center text-pocket-cash shrink-0">{icon}</span>{t}</li>)}
          </ul>
        </div>
      </section>

      <main id="main">
        <section id="how" className="scroll-mt-[68px] bg-bg" aria-labelledby="how-title">
          <div className={`${wrap} py-24`}>
            <p className="micro text-gold-text">How it works</p>
            <h2 id="how-title" className="font-display font-extrabold text-[38px] leading-tight mt-2 max-w-[640px]">Three steps, the same for every organization</h2>
            <ol className="mt-14 grid grid-cols-3 gap-6 relative">
              <span aria-hidden className="absolute top-7 left-[16%] right-[16%] h-px bg-gradient-to-r from-pocket-cash via-primary/40 to-pocket-cash" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-[22px] border border-line bg-surface p-7 pt-0 text-center">
                  <span className="relative -top-7 mx-auto size-14 rounded-full lux-gold-btn grid place-items-center font-display font-extrabold text-[20px]">{i + 1}</span>
                  <span className="mx-auto -mt-2 size-11 rounded-[14px] bg-primary-soft text-primary grid place-items-center">{s.icon}</span>
                  <h3 className="font-display font-bold text-[20px] mt-4">{s.title}</h3>
                  <p className="text-muted mt-2 text-[15px] leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="roles" className="scroll-mt-[68px] bg-surface border-y border-line" aria-labelledby="roles-title">
          <div className={`${wrap} py-24`}>
            <p className="micro text-gold-text">Who it’s for</p>
            <h2 id="roles-title" className="font-display font-extrabold text-[38px] leading-tight mt-2">One system, three views</h2>
            <p className="text-muted mt-3 text-[17px] max-w-[620px]">Each person gets one account. SAS approves it, and E-CFunds shows exactly what that role needs.</p>
            <div className="mt-12 grid grid-cols-3 gap-6">
              {ROLES.map((r) => (
                <div key={r.who} className="rounded-[22px] border border-line bg-surface p-6 flex flex-col">
                  {r.demo}
                  <div className="flex items-center gap-3 mt-6">
                    <span className="size-11 rounded-[14px] bg-gold-soft text-gold-text grid place-items-center">{r.icon}</span>
                    <h3 className="font-display font-bold text-[21px]">{r.who}</h3>
                  </div>
                  <p className="text-muted mt-2 text-[15px]">{r.line}</p>
                  <ul className="mt-4 space-y-2.5 text-[15px]">
                    {r.points.map((p) => <li key={p} className="flex items-start gap-2.5"><Check className="size-4 text-ok mt-1 shrink-0" aria-hidden />{p}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="report" className="scroll-mt-[68px] relative lux-ground text-white overflow-hidden" aria-labelledby="report-title">
          <div aria-hidden className="absolute inset-0 lux-grid" />
          <div className={`${wrap} relative py-24 grid grid-cols-[1fr_1fr] gap-16 items-center`}>
            <div>
              <p className="micro text-pocket-cash">Reports</p>
              <h2 id="report-title" className="font-display font-extrabold text-[38px] leading-tight mt-2">The SAS Financial Report, filled in for you</h2>
              <p className="text-hero-muted mt-4 text-[17px] leading-relaxed">Collections, every activity’s items and the totals come straight from the ledger. The treasurer counts the cash, and the PDF is ready to sign.</p>
              <ul className="mt-7 space-y-3 text-[15px]">
                {['Previous fund, collections and remaining fund worked out', 'Each activity with its receipt items and sub total', 'Signatories from the treasurer up to the SAS Coordinator'].map((t) => (
                  <li key={t} className="flex items-start gap-3"><span className="size-6 rounded-full bg-pocket-cash/20 text-pocket-cash grid place-items-center shrink-0 mt-px"><Check className="size-3.5" aria-hidden /></span>{t}</li>
                ))}
              </ul>
            </div>
            <ReportPreview className="max-w-[500px] justify-self-end w-full" />
          </div>
        </section>

        {!isNative && (
          <section id="app" className="scroll-mt-[68px] bg-bg" aria-labelledby="app-title">
            <div className={`${wrap} py-24 grid grid-cols-[1.1fr_1fr] gap-16 items-center`}>
              <div>
                <p className="micro text-gold-text">Mobile app</p>
                <h2 id="app-title" className="font-display font-extrabold text-[38px] leading-tight mt-2">E-CFunds on your phone</h2>
                <p className="text-muted mt-4 text-[17px] leading-relaxed">The Android app brings notifications and updates itself. On iPhone, add the website to your Home Screen.</p>
                <div className="mt-8 flex items-center gap-4">
                  <a href={APK_URL} rel="noopener" className={`${btn} h-[52px] px-6 text-[15px] bg-primary text-on-primary focus-visible:outline-primary`}>
                    <Download className="size-5" aria-hidden />Get the Android app
                  </a>
                  <span className="text-[13px] text-muted max-w-[220px]">Free. If your phone asks, allow installing from your browser.</span>
                </div>
                <div className="mt-8 rounded-[20px] border border-line bg-surface p-6">
                  <p className="font-semibold mb-4">On iPhone</p>
                  <IphoneSteps />
                </div>
              </div>
              <div className="justify-self-center relative">
                <div aria-hidden className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(29_63_175/.18),transparent)]" />
                <PhoneMini className="relative" />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="relative lux-ground text-white overflow-hidden">
        <div aria-hidden className="absolute inset-0 lux-grid" />
        <div className={`${wrap} relative py-16`}>
          <div className="flex items-end justify-between gap-10">
            <div>
              <h2 className="font-display font-extrabold text-[34px] leading-tight max-w-[560px]">Your organization’s funds, <span className="lux-gold-text">one tap away.</span></h2>
              <p className="text-hero-muted mt-3 text-[16px]">Sign in with your email, Google, or your Student ID once SAS approves you.</p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link to="/login" className={`${goldBtn} h-[54px] px-7 text-[16px]`}>Sign in<ArrowRight className="size-5" aria-hidden /></Link>
              <Link to="/register" className={`${glassBtn} h-[54px] px-7 text-[16px]`}>Create an account</Link>
            </div>
          </div>
          <div className="mt-14 pt-6 border-t border-white/10 flex items-center justify-between text-[13.5px] text-hero-muted">
            <span className="flex items-center gap-3"><Brand light /><span className="border-l border-white/15 pl-3">Office of Student Affairs and Services · OMSC Mamburao</span></span>
            <span className="flex gap-5">
              <Link to="/privacy" className="py-2 hover:text-white">Privacy</Link>
              <Link to="/terms" className="py-2 hover:text-white">Terms</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
