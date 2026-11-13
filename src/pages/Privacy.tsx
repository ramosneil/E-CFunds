import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '../components/ui';
import { Brand } from './auth/AuthLayout';

/** Public privacy notice (no sign-in needed). Linked from sign-in, My account and Google's consent screen. */
export function Privacy() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-line">
        <div className="max-w-[760px] mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" aria-label="E-CFunds home"><Brand /></Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-5 py-10 sm:py-14">
        <Link to="/" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary"><ArrowLeft className="size-4" aria-hidden />Back to E-CFunds</Link>
        <div className="mt-6 flex items-start gap-4">
          <span className="size-12 rounded-2xl bg-primary-soft text-primary grid place-items-center shrink-0"><ShieldCheck className="size-6" aria-hidden /></span>
          <div>
            <h1 className="font-display text-[30px] sm:text-[36px] font-extrabold leading-tight">Privacy notice</h1>
            <p className="text-muted mt-1">Last updated 13 November 2026</p>
          </div>
        </div>

        <p className="mt-8 text-[16px] leading-relaxed">
          E-CFunds is the fund-monitoring app of the <b>Office of Student Affairs and Services (SAS), Occidental Mindoro State
          College – Mamburao Campus</b>. It keeps the records of student organizations' and clubs' money: dues, remittances,
          releases and expenses. This notice explains, in plain words, what we keep, why, and who can see it, following the
          Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>

        <Section title="What we keep">
          <List items={[
            <>Your <b>name</b> and <b>email address</b>, and your Google account name if you sign in with Google.</>,
            <>For students: your <b>Student ID</b>, the organization or club you belong to, and whether your <b>dues</b> are paid.</>,
            <>For treasurers: the <b>money records</b> of your organization or club, including <b>receipt photos</b> for expenses.</>,
            <><b>Messages</b> between treasurers and SAS inside the app.</>,
            <>Basic <b>security records</b>: sign-in attempts (to stop password guessing) and a log of who changed what.</>,
            <>Questions you type into <b>Ask E-CFunds</b> (the assistant) and how many you asked today.</>,
          ]} />
          <p>We never ask for passwords to other services, bank details or government IDs. Your password is stored only as a
            one-way scrambled code that nobody, including SAS, can read.</p>
        </Section>

        <Section title="Why we keep it">
          <List items={[
            'To show each organization and club an honest, complete record of its funds.',
            'So SAS can approve accounts, remittances, releases and expenses.',
            'So students can check their own dues and every organization’s totals.',
            'To keep accounts safe and to trace mistakes or misuse.',
          ]} />
        </Section>

        <Section title="Who can see it">
          <List items={[
            <><b>SAS administrators</b>: all records, to do their job.</>,
            <><b>Treasurers</b>: their own organization's or club's members, dues and money records, and totals only for the others.</>,
            <><b>Students</b>: their own dues, and totals and counts for every organization and club, never other students' names or payments.</>,
          ]} />
          <p>These limits are enforced by the database itself, not only by the screens.</p>
        </Section>

        <Section title="Services that help run E-CFunds">
          <List items={[
            <><b>Supabase</b> stores the data and handles sign-in (servers in Singapore).</>,
            <><b>Vercel</b> delivers the website.</>,
            <><b>Google</b> handles “Continue with Google” sign-in, and its Gemini AI writes the assistant's answers. When you ask
              a question, the question and the figures you are already allowed to see are sent to Gemini to write the reply.</>,
          ]} />
          <p>We do not sell your data or use it for advertising.</p>
        </Section>

        <Section title="How long we keep it">
          <p>Fund records are school financial records and are kept for as long as SAS needs them for accountability and
            audits. If you leave the college or no longer need your account, SAS can deactivate it. Money records stay, because
            they cannot be erased without breaking the organization's history.</p>
        </Section>

        <Section title="Your rights">
          <p>Under the Data Privacy Act you may ask what we hold about you, ask us to correct it, object to its use, or ask for
            it to be removed where the law allows. You may also complain to the National Privacy Commission (privacy.gov.ph).</p>
        </Section>

        <Section title="Contact">
          <p>For any privacy question or request, contact the <b>Office of Student Affairs and Services</b>, Occidental Mindoro
            State College – Mamburao Campus, in person or through your organization's treasurer.</p>
        </Section>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[20px] font-extrabold">{title}</h2>
      <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3"><span aria-hidden className="mt-[9px] size-1.5 rounded-full bg-primary shrink-0" /><span>{it}</span></li>
      ))}
    </ul>
  );
}
