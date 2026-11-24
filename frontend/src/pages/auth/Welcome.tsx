// Signed-out welcome page — v3 (Neil, 2026-11-24): dark all the way, bold, in the style of his reference site
// (corefitness-site.vercel.app) but with E-CFunds' own navy and gold, own words and own screens. Patterns borrowed:
// device hero, big rounded stages with role tabs, a statement that lights up on scroll, a timeline with Pause, a
// searchable feature list, a reading-progress line. Nothing here signs anyone in: Sign in (/login) and Create account
// (/register) are the existing screens. The Android app keeps a short one-screen welcome.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowRight, Check, ChevronDown, Download, Pause, Play, Search } from 'lucide-react';
import { APK_URL } from '../../components/AndroidAppLink';
import { IphoneSteps } from '../../components/IphoneInstall';
import { isNative } from '../../lib/native';
import { Brand, SampleFundCard } from './AuthLayout';
import { AppWindow, DeviceFrame, GlassStat, PhoneMini, ReportPreview, StepLiquidate, StepPay, StepRemit, StepResolution, StudentDues } from './landing';
import { FEATURE_GROUPS, ROLES, STEPS, type RoleKey } from './welcomeContent';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrap = 'max-w-[1240px] mx-auto px-5 sm:px-8 lg:px-10';
const btn = 'lux-press inline-flex items-center justify-center gap-2 rounded-[16px] font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2';
const goldBtn = `${btn} lux-gold-btn`;
const blueBtn = `${btn} lux-royal`;
const display = 'font-display font-extrabold uppercase tracking-[-0.015em] leading-[0.98]';
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

/** The entrance plays once; after 1.2 s everything is shown whatever happened to the animation (hidden tab). */
export function useEntered() {
  const [done, setDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDone(true), 1200); return () => clearTimeout(t); }, []);
  return done ? 'lux-entered' : '';
}

export function Welcome() {
  const entered = useEntered();
  return <div className={entered}>{isNative ? <AppWelcome /> : <Landing />}</div>;
}

/** Android app: one screen, sign in fast. */
function AppWelcome() {
  return (
    <div className="lux-night min-h-dvh flex flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="lux-enter"><Brand light /></header>
      <main className="flex-1 flex flex-col justify-center py-6">
        <p className="lux-enter text-[12.5px] font-semibold text-[#A9B5DA]" style={d(60)}>Fund monitoring · OMSU Mamburao</p>
        <h1 className={`lux-enter ${display} text-[38px] mt-3`} style={d(120)}>Every peso of every club, <span className="lux-gold-text">out in the open.</span></h1>
        <div className="lux-enter mt-6 [@media(max-height:700px)]:hidden" style={d(220)}><SampleFundCard compact /></div>
      </main>
      <div className="space-y-3 lux-enter" style={d(300)}>
        <Link to="/login" className={`${goldBtn} w-full h-[56px] text-[16px]`}>Sign in</Link>
        <Link to="/register" className={`${blueBtn} w-full h-[56px] text-[16px]`}>Create an account</Link>
        <p className="text-center text-[12.5px] text-[#A9B5DA]">
          <Link to="/privacy" className="inline-block py-2 hover:text-white">Privacy</Link><span aria-hidden> · </span>
          <Link to="/terms" className="inline-block py-2 hover:text-white">Terms</Link>
        </p>
      </div>
    </div>
  );
}

function Landing() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = () => { const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); bar.current?.style.setProperty('--p', String(p)); };
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <div className="lux-night min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[10px] focus:bg-white focus:text-[#0D1530] focus:px-4 focus:py-2 focus:font-semibold">Skip to content</a>
      <header className="sticky top-0 z-40 bg-[#0E1640]/80 backdrop-blur-md border-b border-white/10">
        <div className={`${wrap} h-[68px] flex items-center gap-3 whitespace-nowrap`}>
          <Link to="/welcome" aria-label="E-CFunds home" className="shrink-0 rounded-xl"><Brand light /></Link>
          <nav aria-label="On this page" className="hidden lg:flex mx-auto items-center gap-1 text-[14px] font-semibold text-[#C9D4F7]">
            {[['#roles', 'Roles'], ['#semester', 'A semester'], ['#features', 'Features'], ['#app', 'Mobile app']].map(([h, t]) => (
              <a key={h} href={h} className="px-3 py-2 rounded-[10px] hover:text-white hover:bg-white/10">{t}</a>
            ))}
          </nav>
          <span className="ml-auto lg:ml-0 flex items-center gap-2">
            <Link to="/login" className={`${btn} max-sm:hidden h-11 px-4 text-[14px] text-[#C9D4F7] hover:text-white hover:bg-white/10`}>Sign in</Link>
            <Link to="/register" className={`${goldBtn} max-sm:hidden h-11 px-5 text-[14px]`}>Create account</Link>
            <Link to="/login" className={`${goldBtn} sm:hidden h-11 px-5 text-[14px]`}>Sign in</Link>
          </span>
        </div>
        <div ref={bar} aria-hidden className="lux-progress absolute left-0 right-0 -bottom-px h-[2px] bg-gradient-to-r from-pocket-cash via-pocket-cash to-[#8AA4FF]" />
      </header>

      <main id="main">
        <Hero />
        <RolesStage />
        <Statement />
        <SemesterStage />
        <Features />
        <AppStage />
        <Closing />
      </main>
      <footer className="border-t border-white/10">
        <div className={`${wrap} py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13.5px] text-[#A9B5DA]`}>
          <span className="flex items-center gap-3"><Brand light /><span className="hidden md:inline border-l border-white/15 pl-3">Office of Student Affairs and Services · OMSU Mamburao</span></span>
          <span className="flex gap-5"><Link to="/privacy" className="py-2 hover:text-white">Privacy</Link><Link to="/terms" className="py-2 hover:text-white">Terms</Link></span>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className={`${wrap} min-h-[calc(100dvh-68px)] flex flex-col pt-10 lg:pt-14 pb-8`}>
        <div className="flex-1 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-6 items-center">
          <div>
            <p className="lux-enter text-[13px] font-semibold text-[#A9B5DA]">Fund monitoring for OMSU Mamburao student organizations</p>
            <h1 id="hero-title" className={`lux-enter ${display} text-[clamp(40px,5.4vw,74px)] mt-4`} style={d(80)}>
              Every peso of every club, <span className="lux-gold-text">out in the open.</span>
            </h1>
            <p className="lux-enter text-[17px] sm:text-[19px] leading-relaxed text-[#C9D4F7] mt-6 max-w-[520px]" style={d(160)}>
              Dues, remittances and resolution requests in one ledger, approved by the Office of Student Affairs and Services.
            </p>
            <div className="lux-enter lg:hidden mt-7 flex flex-col sm:flex-row gap-3" style={d(220)}>
              <Link to="/login" className={`${goldBtn} h-[56px] px-8 text-[16px]`}><ArrowRight className="size-5" aria-hidden />Sign in</Link>
              <Link to="/register" className={`${blueBtn} h-[56px] px-8 text-[16px]`}>Create an account</Link>
            </div>
          </div>
          <div className="lux-enter relative pb-10 lg:pb-0" style={d(200)}>
            <div aria-hidden className="absolute -inset-10 bg-[radial-gradient(55%_55%_at_55%_45%,rgb(40_56_145/.55),transparent_70%)]" />
            <DeviceFrame className="relative"><AppWindow className="rounded-none border-0 shadow-none" /></DeviceFrame>
            <PhoneMini className="absolute -right-2 sm:right-2 -bottom-6 lg:-bottom-10 scale-[.62] sm:scale-[.75] origin-bottom-right" />
          </div>
        </div>
        <div className="lux-enter mt-10 hidden lg:flex justify-center gap-4" style={d(300)}>
          <Link to="/login" className={`${goldBtn} h-[58px] px-10 text-[17px]`}><ArrowRight className="size-5" aria-hidden />Sign in</Link>
          <Link to="/register" className={`${blueBtn} h-[58px] px-10 text-[17px]`}>Create an account</Link>
        </div>
        <div className="lux-enter mt-8 flex flex-col md:flex-row items-center justify-between gap-3 text-[13px] text-[#A9B5DA]" style={d(360)}>
          <p className="text-center">Dues, remittances and resolution requests <span aria-hidden>•</span> Android app and iPhone <span aria-hidden>•</span> Approved by SAS</p>
          <a href="#roles" className="inline-flex items-center gap-1.5 font-semibold text-[#C9D4F7] hover:text-white py-2">See how it works<ArrowDown className="size-4" aria-hidden /></a>
        </div>
      </div>
    </section>
  );
}

/** Tabs that work with the keyboard: arrows move, Home/End jump. */
function useTabKeys(count: number, index: number, set: (i: number) => void) {
  return (e: KeyboardEvent) => {
    const k = e.key;
    const next = k === 'ArrowRight' || k === 'ArrowDown' ? (index + 1) % count : k === 'ArrowLeft' || k === 'ArrowUp' ? (index - 1 + count) % count : k === 'Home' ? 0 : k === 'End' ? count - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); set(next);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };
}

function RolesStage() {
  const [i, setI] = useState(0);
  const role = ROLES[i];
  const keys = useTabKeys(ROLES.length, i, setI);
  const demo: Record<RoleKey, ReactNode> = {
    sas: <div className="relative w-full"><AppWindow /><GlassStat title="Waiting for you" rows={[['Resolution requests', '1', 'gold'], ['Accounts to approve', '1']]} className="absolute -bottom-6 left-4 right-4 sm:left-8 sm:right-auto sm:w-[340px]" /></div>,
    treasurer: <div className="relative flex justify-center w-full"><PhoneMini /><GlassStat title="This semester" rows={[['Collected', '₱560.00', 'ok'], ['Paid', '28 of 30']]} className="absolute -bottom-6 left-0 right-0 sm:right-auto sm:w-[320px]" /></div>,
    student: <div className="w-full max-w-[420px] mx-auto"><StudentDues /></div>,
  };
  return (
    <section id="roles" className="scroll-mt-[68px] py-16 lg:py-24" aria-labelledby="roles-title">
      <div className={wrap}>
        <div className="lux-stage p-2.5 sm:p-6 lg:p-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-12 items-center">
          <div className="lux-inset min-h-[380px] lg:min-h-[520px] p-3 sm:p-10 pb-12 flex items-center" id={`role-panel-${role.key}`} role="tabpanel" aria-labelledby={`role-tab-${role.key}`}>
            <div key={role.key} className="lux-swap w-full">{demo[role.key]}</div>
          </div>
          <div className="px-2 sm:px-4 pb-4 lg:pb-0">
            <h2 id="roles-title" className={`${display} text-[clamp(34px,4.2vw,54px)]`}>Three roles.<br />One ledger.<br /><span className="lux-gold-text">Every peso.</span></h2>
            <p className="mt-5 text-[17px] text-[#C9D4F7] leading-relaxed">SAS, the treasurers and every member. Their own screens, one record of the money.</p>
            <div role="tablist" aria-label="Roles" className="mt-7 grid grid-cols-3 gap-2" onKeyDown={keys}>
              {ROLES.map((r, j) => (
                <button key={r.key} id={`role-tab-${r.key}`} role="tab" aria-selected={j === i} aria-controls={`role-panel-${r.key}`} tabIndex={j === i ? 0 : -1}
                  onClick={() => setI(j)}
                  className={`lux-press h-12 rounded-[14px] text-[14.5px] font-bold cursor-pointer border ${j === i ? 'lux-gold-btn border-transparent' : 'border-white/15 bg-white/[0.04] text-[#C9D4F7] hover:bg-white/[0.08]'}`}>
                  {r.tab}
                </button>
              ))}
            </div>
            <div key={role.key} className="lux-swap mt-7">
              <h3 className="font-display font-extrabold text-[21px]">{role.title}</h3>
              <p className="text-[13.5px] text-[#A9B5DA] mt-1">{role.device}</p>
              <ul className="mt-4 space-y-2.5 text-[16px]">
                {role.points.map((p) => <li key={p} className="flex items-start gap-3"><span className="mt-2 size-2 rounded-full bg-pocket-cash shrink-0" aria-hidden />{p}</li>)}
              </ul>
              <p className="mt-5 text-[14.5px] text-[#A9B5DA] border-l-2 border-pocket-cash/60 pl-3">{role.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The statement: words light up as the section scrolls by (all lit under reduced motion). */
function Statement() {
  const box = useRef<HTMLParagraphElement>(null);
  const parts: [string, '' | 'gold' | 'blue'][] = [
    ['E-CFunds follows every peso from the moment a member pays: the', ''], ['receipt,', 'gold'], ['the treasurer’s', ''],
    ['remittance,', 'blue'], ['the club’s', ''], ['resolution request,', 'gold'], ['and the', ''], ['report', 'blue'], ['SAS signs.', ''],
  ];
  const words = parts.flatMap(([t, tone]) => t.split(' ').map((w) => [w, tone] as const));
  useEffect(() => {
    const el = box.current; if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('.lux-word'));
    if (reduced()) { spans.forEach((s) => s.setAttribute('data-lit', '')); return; }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect(), vh = window.innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.3)));
        const lit = Math.round(p * spans.length);
        spans.forEach((s, k) => (k < lit ? s.setAttribute('data-lit', '') : s.removeAttribute('data-lit')));
      });
    };
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return (
    <section className="py-20 lg:py-32" aria-label="What E-CFunds follows">
      <div className={wrap}>
        <p ref={box} className="font-display font-extrabold text-[clamp(30px,4.4vw,58px)] leading-[1.12] tracking-[-0.01em] max-w-[1050px]">
          {words.map(([w, tone], k) => <span key={k} className={`lux-word ${tone}`}>{w}{' '}</span>)}
        </p>
      </div>
    </section>
  );
}

function SemesterStage() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(() => !reduced());
  const [inView, setInView] = useState(false);
  const sec = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sec.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !inView) return;
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 5000);
    return () => clearInterval(t);
  }, [playing, inView]);
  const step = STEPS[i];
  const visual = [<StepPay key={0} />, <StepRemit key={1} />, <StepResolution key={2} />, <StepLiquidate key={3} />, <ReportPreview key={4} className="w-full max-w-[460px]" />][i];
  return (
    <section ref={sec} id="semester" className="scroll-mt-[68px] py-16 lg:py-24" aria-labelledby="semester-title">
      <div className={wrap}>
        <div className="lux-stage p-2.5 sm:p-6 lg:p-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-center">
          <div className="lux-inset relative min-h-[420px] lg:min-h-[540px] p-3 sm:p-10 pb-16 flex items-center justify-center">
            <div key={i} className="lux-swap w-full flex justify-center">{visual}</div>
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause the steps' : 'Play the steps'}
              className="lux-press absolute bottom-4 right-4 h-11 px-4 rounded-[12px] border border-white/25 bg-[#0E1640]/60 text-[13px] font-semibold text-white flex items-center gap-1.5 cursor-pointer">
              {playing ? <><Pause className="size-4" aria-hidden />Pause</> : <><Play className="size-4" aria-hidden />Play</>}
            </button>
          </div>
          <div className="px-2 sm:px-4 pb-4 lg:pb-0">
            <h2 id="semester-title" className="text-[15px] font-semibold text-[#A9B5DA]">One semester at a club</h2>
            <div key={i} className="lux-swap" aria-live="polite">
              <p className="font-display font-extrabold text-[clamp(40px,5vw,68px)] leading-none mt-3">{String(i + 1).padStart(2, '0')}<span className="text-[0.4em] text-pocket-cash ml-3 align-middle">{step.when}</span></p>
              <h3 className={`${display} text-[clamp(26px,3vw,40px)] mt-5`}>{step.title}</h3>
              <p className="mt-4 text-[16.5px] leading-relaxed text-[#C9D4F7]">{step.body}</p>
            </div>
            <ol className="mt-9 grid grid-cols-5 gap-2" aria-label="Steps">
              {STEPS.map((s, j) => (
                <li key={s.when}>
                  <button type="button" onClick={() => { setI(j); setPlaying(false); }} aria-current={j === i ? 'step' : undefined}
                    className="w-full min-h-11 text-left cursor-pointer group py-2">
                    <span className={`block h-1 rounded-full transition-colors ${j === i ? 'bg-pocket-cash' : 'bg-white/15 group-hover:bg-white/30'}`} />
                    <span className={`block mt-2 text-[12px] font-semibold leading-tight ${j === i ? 'text-white' : 'text-[#A9B5DA]'}`}>{s.when}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const [g, setG] = useState(0);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const total = FEATURE_GROUPS.reduce((t, x) => t + x.items.length, 0);
  const query = q.trim().toLowerCase();
  const rows = useMemo(() => (query
    ? FEATURE_GROUPS.flatMap((x) => x.items.filter((f) => `${f.title} ${f.line} ${f.who}`.toLowerCase().includes(query)))
    : FEATURE_GROUPS[g].items), [g, query]);
  const keys = useTabKeys(FEATURE_GROUPS.length, g, (n) => { setG(n); setOpen(null); });
  return (
    <section id="features" className="scroll-mt-[68px] py-16 lg:py-24" aria-labelledby="features-title">
      <div className={wrap}>
        <h2 id="features-title" className={`${display} text-[clamp(34px,4.2vw,54px)]`}>{total} things it does,<br /><span className="lux-gold-text">all live today.</span></h2>
        <p className="mt-5 text-[17px] text-[#C9D4F7] max-w-[640px]">For SAS, the treasurers and every member. Search it, or read it by who it serves. Open a feature to see how it works.</p>
        <label className="mt-8 relative block max-w-[520px]">
          <span className="sr-only">Find a feature</span>
          <Search className="size-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#A9B5DA]" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(null); }} placeholder="Find a feature, like receipts"
            className="w-full h-13 pl-12 pr-4 rounded-[16px] bg-white/[0.06] border border-white/15 text-white placeholder:text-[#7F8BB3] outline-none focus:border-pocket-cash" />
        </label>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[280px_1fr] gap-8">
          <div role="tablist" aria-label="Feature groups" aria-orientation="vertical" onKeyDown={keys} className={`flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-5 px-5 lg:mx-0 lg:px-0 pb-1 ${query ? 'opacity-40 pointer-events-none' : ''}`}>
            {FEATURE_GROUPS.map((x, j) => (
              <button key={x.name} role="tab" aria-selected={!query && j === g} tabIndex={j === g ? 0 : -1} onClick={() => { setG(j); setOpen(null); }}
                className={`shrink-0 text-left rounded-[14px] px-4 py-3 border cursor-pointer transition ${!query && j === g ? 'bg-white/[0.08] border-pocket-cash/50' : 'border-white/10 hover:bg-white/[0.05]'}`}>
                <span className="flex items-center gap-2 font-bold text-[15px]"><span className="text-[12px] text-pocket-cash money">{String(j + 1).padStart(2, '0')}</span>{x.name}</span>
                <span className="hidden lg:block text-[13px] text-[#A9B5DA] mt-0.5">{x.blurb}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-[13.5px] text-[#A9B5DA] mb-3">{query ? `${rows.length} found for “${q.trim()}”` : `${rows.length} features · open one to see how it works`}</p>
            <ul className="border-t border-white/10">
              {rows.map((f) => {
                const isOpen = open === f.title;
                return (
                  <li key={f.title} className="border-b border-white/10">
                    <button type="button" onClick={() => setOpen(isOpen ? null : f.title)} aria-expanded={isOpen}
                      className="w-full text-left flex items-start gap-4 py-4 cursor-pointer group">
                      <Check className="size-5 text-pocket-cash mt-0.5 shrink-0" aria-hidden />
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-[16.5px] group-hover:text-pocket-cash transition-colors">{f.title}</span>
                        <span className="block text-[14.5px] text-[#A9B5DA] mt-0.5">{f.line}</span>
                      </span>
                      <ChevronDown className={`size-5 text-[#A9B5DA] mt-0.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {isOpen && (
                      <div className="lux-swap pl-9 pb-5 grid sm:grid-cols-[200px_1fr] gap-4 text-[14.5px]">
                        <div><p className="text-[12px] font-bold tracking-[0.06em] uppercase text-[#A9B5DA]">Who uses it</p><p className="mt-1">{f.who}</p></div>
                        <ol className="space-y-2">
                          {f.steps.map((s, k) => <li key={s} className="flex gap-3"><span className="size-6 rounded-full bg-pocket-cash/15 text-pocket-cash grid place-items-center text-[12px] font-bold shrink-0">{k + 1}</span><span className="pt-0.5">{s}</span></li>)}
                        </ol>
                      </div>
                    )}
                  </li>
                );
              })}
              {!rows.length && <li className="py-6 text-[#A9B5DA]">Nothing matches. Try another word, like “report”.</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppStage() {
  return (
    <section id="app" className="scroll-mt-[68px] py-16 lg:py-24" aria-labelledby="app-title">
      <div className={wrap}>
        <div className="lux-stage p-2.5 sm:p-6 lg:p-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr_1fr] gap-8 lg:gap-12 items-center">
          <div className="lux-inset min-h-[420px] lg:min-h-[560px] p-3 sm:p-6 flex items-center justify-center"><PhoneMini /></div>
          <div className="px-2 sm:px-4 pb-4 lg:pb-0">
            <h2 id="app-title" className={`${display} text-[clamp(32px,4vw,52px)]`}>On every phone.<br /><span className="lux-gold-text">Always up to date.</span></h2>
            <p className="mt-5 text-[17px] text-[#C9D4F7] leading-relaxed">The Android app brings notifications, even when it is closed, and updates itself. On iPhone, add the website to your Home Screen.</p>
            <a href={APK_URL} rel="noopener" className={`${goldBtn} mt-8 h-[56px] px-7 text-[16px]`}><Download className="size-5" aria-hidden />Get the Android app</a>
            <p className="text-[13px] text-[#A9B5DA] mt-2">Free. If your phone asks, allow installing from your browser.</p>
            <div className="mt-8 rounded-[20px] bg-white text-[#0D1530] p-5"><p className="font-bold mb-3">On iPhone</p><IphoneSteps /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="py-20 lg:py-28" aria-labelledby="close-title">
      <div className={`${wrap} text-center`}>
        <h2 id="close-title" className={`${display} text-[clamp(36px,5.2vw,72px)] max-w-[1000px] mx-auto`}>Your club’s funds, <span className="lux-gold-text">one tap away.</span></h2>
        <p className="mt-5 text-[17px] text-[#C9D4F7]">Sign in with your email, Google, or your Student ID once SAS approves you.</p>
        <div className="mt-9 flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link to="/login" className={`${goldBtn} h-[58px] px-10 text-[17px]`}><ArrowRight className="size-5" aria-hidden />Sign in</Link>
          <Link to="/register" className={`${blueBtn} h-[58px] px-10 text-[17px]`}>Create an account</Link>
        </div>
      </div>
    </section>
  );
}
