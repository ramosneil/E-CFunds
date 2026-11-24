// Product visuals for the welcome and sign-in screens (Neil, 2026-11-24). They are E-CFunds' own screens drawn in
// HTML with example numbers (marked "Example"), not pictures: they stay sharp, follow the theme and never go stale.
import { BadgeCheck, Bell, Check, FileText, Home, LayoutDashboard, Landmark, ListChecks, Receipt, Send, Users, Wallet } from 'lucide-react';

const Pocket = ({ cash, saved, h = 'h-2' }: { cash: number; saved: number; h?: string }) => (
  <div className={`${h} rounded-full overflow-hidden flex bg-white/15`} aria-hidden>
    <span className="bg-pocket-cash" style={{ width: `${(cash / (cash + saved)) * 100}%` }} />
    <span className="bg-pocket-saved flex-1" />
  </div>
);

/** The SAS dashboard in a browser window: fund card, a request waiting, every org at a glance. */
export function AppWindow({ className = '' }: { className?: string }) {
  const orgs: [string, string, number][] = [['Sports Club', '₱8,470.00', 93], ['LSC', '₱320.00', 97], ['JOES', '₱40.00', 100]];
  return (
    <div className={`rounded-[18px] bg-[#0C1A4D] border border-white/15 shadow-[0_40px_80px_-30px_rgb(5_10_40/.8)] overflow-hidden text-white ${className}`} role="img"
      aria-label="E-CFunds SAS dashboard with example numbers: cash on hand, saved with SAS, a resolution request waiting, and each organization's funds">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-white/10 bg-white/[0.04]">
        <span className="size-2.5 rounded-full bg-white/25" /><span className="size-2.5 rounded-full bg-white/25" /><span className="size-2.5 rounded-full bg-white/25" />
        <span className="ml-3 min-w-0 truncate whitespace-nowrap rounded-full bg-white/10 px-3 py-0.5 text-[11px] text-hero-muted">e-cfunds.vercel.app</span>
        <span className="ml-auto rounded-full bg-pocket-cash/20 px-2 py-0.5 text-[10.5px] font-semibold text-pocket-cash">Example</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr]">
        <nav className="hidden sm:block border-r border-white/10 p-3 space-y-1 text-[11.5px] text-hero-muted whitespace-nowrap" aria-hidden>
          {[[LayoutDashboard, 'Dashboard', true], [ListChecks, 'Approvals', false], [Landmark, 'Orgs & clubs', false], [FileText, 'Reports', false]].map(([I, t, on]) => {
            const Icon = I as typeof Home;
            return (
              <span key={t as string} className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 ${on ? 'bg-white/12 text-white font-semibold' : ''}`}>
                <Icon className="size-3.5" />{t as string}{t === 'Approvals' && <b className="ml-auto rounded-full bg-pocket-cash text-[#1A1300] px-1.5 text-[10px]">1</b>}
              </span>
            );
          })}
        </nav>
        <div className="p-4 space-y-3">
          <div className="rounded-[14px] p-3.5 bg-gradient-to-br from-[#1D3FAF] to-[#13297A] border border-white/10">
            <p className="text-[10px] tracking-[0.08em] uppercase font-semibold text-hero-muted">Funds · all orgs and clubs</p>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <div><p className="text-[10.5px] text-hero-muted flex items-center gap-1"><i className="size-1.5 rounded-full bg-pocket-cash" />Cash on hand</p><p className="money font-display font-extrabold text-[15px] min-[400px]:text-[19px]">₱1,250.00</p></div>
              <div><p className="text-[10.5px] text-hero-muted flex items-center gap-1"><i className="size-1.5 rounded-full bg-pocket-saved" />Saved with SAS</p><p className="money font-display font-extrabold text-[15px] min-[400px]:text-[19px]">₱8,830.00</p></div>
            </div>
            <div className="mt-2.5"><Pocket cash={1250} saved={8830} h="h-1.5" /></div>
          </div>
          <div className="rounded-[12px] border border-pocket-cash/30 bg-pocket-cash/[0.08] p-2.5 flex items-center gap-2.5">
            <span className="size-7 rounded-[8px] bg-pocket-cash/20 text-pocket-cash grid place-items-center shrink-0"><Send className="size-3.5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold">Resolution request · Intramurals</span><span className="block text-[10.5px] text-hero-muted">Sports Club · waiting for SAS</span></span>
            <span className="rounded-[8px] lux-gold-btn px-2.5 py-1 text-[10.5px] font-bold">Approve</span>
          </div>
          <div className="rounded-[12px] border border-white/10 divide-y divide-white/10 text-[11px]">
            {orgs.map(([n, amt, pct]) => (
              <div key={n} className="flex items-center gap-3 px-3 py-2">
                <span className="w-[74px] font-semibold">{n}</span>
                <span className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden"><span className="block h-full bg-[#4ADE80]" style={{ width: `${pct}%` }} /></span>
                <span className="money w-[70px] text-right text-hero-muted">{amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A payment receipt chip (floats over the app window). */
export function ReceiptChip({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-surface text-ink border border-line shadow-[0_24px_48px_-20px_rgb(5_10_40/.55)] p-3.5 flex items-center gap-3 ${className}`} aria-hidden>
      <span className="size-10 rounded-full bg-ok-soft text-ok grid place-items-center shrink-0"><Receipt className="size-5" /></span>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold">Payment receipt</span>
        <span className="block text-[11.5px] text-muted money">SPORTSCLUB-2026-0012</span>
      </span>
      <span className="ml-2 text-right"><span className="block money font-bold text-[14px]">₱20.00</span><span className="block text-[11px] font-semibold text-ok">Paid</span></span>
    </div>
  );
}

/** The SAS Financial Report form (blue bars, a salmon activity heading, items, totals), as the PDF prints it. */
export function ReportPreview({ className = '' }: { className?: string }) {
  const bar = 'flex justify-between px-3 py-1.5 font-semibold';
  const items: [string, string, string, string][] = [['Folder long', 'pcs', '10', '₱90.00'], ['Laminating film', 'pc', '1', '₱950.00'], ['Styro board', 'pcs', '3', '₱435.00']];
  return (
    <div className={`rounded-[18px] bg-white text-[#0D1530] shadow-[0_40px_80px_-30px_rgb(5_10_40/.8)] p-5 ${className}`} role="img"
      aria-label="Financial Report in the SAS form with example numbers: previous fund, collections, one activity with its items, totals">
      <div className="flex items-center justify-between">
        <div><p className="text-[10px] font-semibold text-[#566080] tracking-[0.06em] uppercase">Financial report · 1st semester</p><p className="font-display font-extrabold text-[15px]">Programmers’ Clan</p></div>
        <span className="rounded-full bg-[#FBF2DC] px-2 py-0.5 text-[10.5px] font-semibold text-[#875F0B]">Example</span>
      </div>
      <div className="mt-3 text-[11px] border border-[#BFBFBF] rounded-[6px] overflow-hidden" aria-hidden>
        <div className={`${bar} bg-[#1F6E8C] text-white`}><span>Previous Fund</span><span className="money">₱13,716.00</span></div>
        <div className={`${bar} bg-[#1F6E8C] text-white border-t border-white/30`}><span>Total Collection</span><span className="money">₱24,815.00</span></div>
        <div className="px-3 py-1.5 font-semibold bg-[#F4B183]">SimuLIT</div>
        {items.map(([p, u, q, t], i) => (
          <div key={p} className="grid grid-cols-[18px_1fr_34px_26px_64px] gap-1 px-3 py-1 border-t border-[#E3E3E3]">
            <span className="text-[#566080]">{i + 1}</span><span>{p}</span><span className="text-[#566080]">{u}</span><span className="text-right">{q}</span><span className="text-right money">{t}</span>
          </div>
        ))}
        <div className={`${bar} border-t border-[#BFBFBF]`}><span>Sub Total</span><span className="money">₱1,475.00</span></div>
        <div className={`${bar} bg-[#F4B183]`}><span>Grand Total (Expenses)</span><span className="money">₱1,475.00</span></div>
        <div className="flex"><span className="flex-1 bg-[#A6A6A6] px-3 py-1.5 font-semibold">Total Remain Fund</span><span className="bg-[#9DC3E6] px-3 py-1.5 font-semibold money">₱37,056.00</span></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-[#566080]" aria-hidden>
        {['Treasurer', 'Auditor', 'SSG Governor', 'SAS Coordinator'].map((r) => <div key={r}><div className="h-px bg-[#0D1530] mb-1" />{r}</div>)}
      </div>
    </div>
  );
}

/** The treasurer's Home on a phone: fund card and the quick actions. */
export function PhoneMini({ className = '' }: { className?: string }) {
  return (
    <div className={`w-[250px] rounded-[38px] bg-[#0A1230] p-2.5 shadow-[0_40px_80px_-30px_rgb(5_10_40/.7)] ${className}`} role="img"
      aria-label="E-CFunds Android app: a treasurer's home screen with example numbers">
      <div className="rounded-[30px] bg-[#F4F6FB] overflow-hidden h-[470px] text-[#0D1530]">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="flex items-center gap-1.5"><span className="size-6 rounded-[7px] bg-[#1D3FAF] text-white grid place-items-center font-display font-extrabold text-[11px]">₱</span><span className="font-display font-extrabold text-[12.5px]">E-CFunds</span></span>
          <Bell className="size-4 text-[#566080]" aria-hidden />
        </div>
        <div className="px-3">
          <p className="font-display font-extrabold text-[16px] px-1">Sports Club</p>
          <div className="mt-2 rounded-[18px] lux-ground p-3.5 text-white">
            <p className="text-[9px] tracking-[0.08em] uppercase font-semibold text-hero-muted">Funds · 2026–2027</p>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div><p className="text-[9.5px] text-hero-muted">Cash on hand</p><p className="money font-display font-extrabold text-[15px]">₱1,250.00</p></div>
              <div><p className="text-[9.5px] text-hero-muted">Saved with SAS</p><p className="money font-display font-extrabold text-[15px]">₱8,470.00</p></div>
            </div>
            <div className="mt-2"><Pocket cash={1250} saved={8470} h="h-1.5" /></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[10.5px] font-semibold">
            {[[Wallet, 'Record payment', true], [Landmark, 'Remit to SAS', false], [Send, 'Resolution request', false], [BadgeCheck, 'Liquidate', false]].map(([I, t, gold]) => {
              const Icon = I as typeof Home;
              return (
                <span key={t as string} className={`rounded-[14px] p-2.5 flex flex-col gap-1.5 ${gold ? 'bg-[#F0C14B] text-[#1A1300]' : 'bg-white border border-[#DDE2EE]'}`}>
                  <Icon className="size-4" />{t as string}
                </span>
              );
            })}
          </div>
          <div className="mt-3 rounded-[14px] bg-white border border-[#DDE2EE] p-2.5">
            <p className="text-[10.5px] font-semibold flex items-center gap-1.5"><Users className="size-3.5 text-[#1D3FAF]" />Dues this semester</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#E6EAF3] overflow-hidden"><span className="block h-full w-[93%] bg-[#13774A]" /></div>
            <p className="mt-1 text-[9.5px] text-[#566080] flex items-center gap-1"><Check className="size-3" />28 of 30 paid</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Welcome v3 visuals (2026-11-24) ────────────────────────────────────────────────────────────────────────────────

/** A royal-blue tablet frame around a screen (the hero's SAS dashboard). */
export function DeviceFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[30px] p-3 bg-gradient-to-b from-[#3358DE] to-[#1D3FAF] shadow-[0_50px_100px_-40px_rgb(29_63_175/.9),inset_0_1px_0_rgb(255_255_255/.3)] ${className}`}>
      <div className="rounded-[20px] overflow-hidden bg-[#0C1A4D]">{children}</div>
      <p className="text-center text-[9.5px] tracking-[0.25em] font-bold text-white/55 mt-2 mb-0.5">E-CFUNDS</p>
    </div>
  );
}

/** A frosted stat card that sits over a demo (roles stage). */
export function GlassStat({ title, rows, className = '' }: { title: string; rows: [string, string, string?][]; className?: string }) {
  return (
    <div className={`rounded-[20px] bg-[#0B1336]/75 backdrop-blur-md border border-white/15 shadow-[0_30px_60px_-24px_rgb(0_0_0/.8)] p-5 text-white ${className}`} aria-hidden>
      <p className="font-display font-extrabold text-[17px]">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <p className="text-[12px] text-[#A9B5DA]">{label}</p>
            <p className={`money font-display font-extrabold text-[24px] leading-tight ${tone === 'gold' ? 'text-pocket-cash' : tone === 'ok' ? 'text-[#86EFAC]' : ''}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A student's dues for the semester (roles stage, student tab). */
export function StudentDues({ className = '' }: { className?: string }) {
  const rows: [string, string, boolean][] = [['SSG', 'Supreme Student Government', true], ['Sports Club', 'Club, 1st semester', true], ['LSC', 'Local Student Council', false]];
  return (
    <div className={`rounded-[22px] bg-[#F4F6FB] text-[#0D1530] p-4 shadow-[0_40px_80px_-30px_rgb(0_0_0/.7)] ${className}`} role="img" aria-label="A student's dues with example numbers: two paid, one to collect">
      <div className="flex items-center justify-between">
        <p className="font-display font-extrabold text-[16px]">My dues · 1st semester</p>
        <span className="rounded-full bg-[#FBF2DC] px-2 py-0.5 text-[10.5px] font-semibold text-[#875F0B]">Example</span>
      </div>
      <ul className="mt-3 space-y-2" aria-hidden>
        {rows.map(([org, sub, paid]) => (
          <li key={org} className="rounded-[14px] bg-white border border-[#DDE2EE] px-3 py-2.5 flex items-center gap-3">
            <span className="size-9 rounded-full bg-[#E6ECFB] text-[#1D3FAF] grid place-items-center text-[11px] font-bold shrink-0">{org.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><b className="block text-[13px]">{org}</b><span className="block text-[11.5px] text-[#566080] truncate">{sub}</span></span>
            <span className="text-right"><b className="block money text-[13px]">₱20.00</b>
              <span className={`text-[11px] font-semibold ${paid ? 'text-[#13774A]' : 'text-[#9A5B00]'}`}>{paid ? 'Paid' : 'To collect'}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const lightCard = 'rounded-[22px] bg-[#F4F6FB] text-[#0D1530] p-5 shadow-[0_40px_80px_-30px_rgb(0_0_0/.7)] w-full max-w-[420px]';

/** Timeline step visuals: recording a payment, remitting, a resolution request, a liquidation. */
export function StepPay() {
  const people: [string, boolean][] = [['Dela Cruz, Juan', true], ['Reyes, Ana', false], ['Santos, Lea', false]];
  return (
    <div className={lightCard} role="img" aria-label="Recording a 20 peso payment; a numbered receipt is issued">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#566080]">Members · Section 3A</p>
      <div className="mt-3 space-y-2" aria-hidden>
        {people.map(([n, done]) => (
          <div key={n} className="rounded-[14px] bg-white border border-[#DDE2EE] px-3 py-2.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold">{n}</span>
            {done ? <span className="text-[12px] font-semibold text-[#13774A] flex items-center gap-1"><Check className="size-3.5" />Paid</span>
              : <span className="rounded-[10px] bg-[#F0C14B] text-[#1A1300] text-[12px] font-bold px-3 py-1">Record ₱20</span>}
          </div>
        ))}
      </div>
      <div className="mt-3"><ReceiptChip /></div>
    </div>
  );
}

export function StepRemit() {
  return (
    <div className={lightCard} role="img" aria-label="Remitting 460 pesos to SAS: cash on hand goes down, savings go up">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#566080]">Remit to SAS</p>
      <p className="money font-display font-extrabold text-[34px] mt-1">₱460.00</p>
      <div className="mt-3 rounded-[16px] bg-white border border-[#DDE2EE] p-3.5 text-[12.5px] space-y-2" aria-hidden>
        <p className="font-semibold">If approved</p>
        <div className="flex justify-between"><span className="text-[#566080]">Cash on hand</span><span className="money">₱560.00 → <b>₱100.00</b></span></div>
        <div className="flex justify-between"><span className="text-[#566080]">Saved with SAS</span><span className="money">₱0.00 → <b>₱460.00</b></span></div>
      </div>
      <div className="mt-3 flex items-center justify-between" aria-hidden>
        <span className="text-[12px] text-[#566080]">Waiting for SAS</span>
        <span className="rounded-[10px] bg-[#1D3FAF] text-white text-[12px] font-bold px-3 py-1.5">Approve</span>
      </div>
    </div>
  );
}

export function StepResolution() {
  return (
    <div className={lightCard} role="img" aria-label="A resolution request: SAS opens the file and types the amount written in it">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#566080]">Resolution request · Sports Club</p>
      <div className="mt-3 rounded-[14px] bg-white border border-[#DDE2EE] px-3 py-2.5 flex items-center gap-2.5" aria-hidden>
        <FileText className="size-5 text-[#1D3FAF]" /><span className="text-[13px] font-semibold flex-1 truncate">Resolution No. 7 - Intramurals.pdf</span>
      </div>
      <p className="text-[12px] text-[#566080] mt-3">Amount in the resolution</p>
      <p className="money font-display font-extrabold text-[30px] rounded-[14px] bg-white border-2 border-[#1D3FAF] px-3 py-1.5 mt-1">₱1,500.00</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] font-bold" aria-hidden>
        <span className="rounded-[12px] bg-[#FDE8E6] text-[#B42318] text-center py-2">Reject</span>
        <span className="rounded-[12px] bg-[#1D3FAF] text-white text-center py-2">Approve</span>
      </div>
    </div>
  );
}

export function StepLiquidate() {
  const items: [string, string][] = [['Trophies', '₱900.00'], ['Tarpaulin', '₱350.00'], ['Snacks for players', '₱180.00']];
  return (
    <div className={lightCard} role="img" aria-label="A liquidation: receipt items add up to the amount spent and the rest goes back to savings">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[#566080]">Liquidate · Intramurals</p>
      <div className="mt-3 rounded-[14px] bg-white border border-[#DDE2EE] divide-y divide-[#E6EAF3] text-[13px]" aria-hidden>
        {items.map(([n, v], i) => <div key={n} className="flex justify-between px-3 py-2"><span><span className="text-[#566080] mr-2">{i + 1}</span>{n}</span><span className="money">{v}</span></div>)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]" aria-hidden>
        <div className="rounded-[12px] bg-white border border-[#DDE2EE] p-2"><p className="text-[#566080]">Released</p><b className="money text-[13px]">₱1,500.00</b></div>
        <div className="rounded-[12px] bg-white border border-[#DDE2EE] p-2"><p className="text-[#566080]">Spent</p><b className="money text-[13px]">₱1,430.00</b></div>
        <div className="rounded-[12px] bg-[#E2F4EA] border border-[#B7E4CB] p-2"><p className="text-[#13774A]">Back to SAS</p><b className="money text-[13px] text-[#13774A]">₱70.00</b></div>
      </div>
    </div>
  );
}
