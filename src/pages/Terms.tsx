import { Link } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { ThemeToggle } from '../components/ui';
import { Brand } from './auth/AuthLayout';
import { List, Section } from './Privacy';

/** Public Terms and Conditions (no sign-in needed). Accepted on sign-up; draft for SAS to review. */
export function Terms() {
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
          <span className="size-12 rounded-2xl bg-primary-soft text-primary grid place-items-center shrink-0"><FileText className="size-6" aria-hidden /></span>
          <div>
            <h1 className="font-display text-[30px] sm:text-[36px] font-extrabold leading-tight">Terms and Conditions</h1>
            <p className="text-muted mt-1">Last updated 13 November 2026</p>
          </div>
        </div>

        <p className="mt-8 text-[16px] leading-relaxed">
          E-CFunds is run by the <b>Office of Student Affairs and Services (SAS), Occidental Mindoro State College –
          Mamburao Campus</b> to keep the funds of student organizations and clubs honest and open. By creating an account
          or signing in, you agree to these terms.
        </p>

        <Section title="Who can use E-CFunds">
          <List items={[
            'Students, officers and SAS staff of OMSC Mamburao Campus.',
            'Every account is checked and approved by SAS before it can see any money records. SAS may refuse, limit or close an account.',
          ]} />
        </Section>

        <Section title="Your account">
          <List items={[
            <>Use your <b>real name</b> and your own email or Student ID. One person, one account.</>,
            <>Keep your password secret and strong. <b>Never share your account</b>; you are responsible for what is done with it.</>,
            'Tell SAS right away if you think someone else used your account.',
          ]} />
        </Section>

        <Section title="Treasurers and officers">
          <List items={[
            <>Record only <b>true and complete</b> transactions: dues you actually received, real expenses with real receipts.</>,
            <>Record a payment <b>when the money is received</b>, and keep the official receipts.</>,
            'Mistakes are fixed with a correction (reversal), never by deleting; every change is logged with your name and the time.',
            'Remittances, releases and expenses take effect only after SAS approves them.',
          ]} />
        </Section>

        <Section title="Not allowed">
          <List items={[
            'Entering false records, hiding money, or changing records to mislead.',
            'Trying to see records you are not allowed to see, or to get around the app’s security.',
            'Using the app or the assistant (Ask E-CFunds) to harass anyone or for anything unrelated to organization funds.',
          ]} />
          <p>Breaking these terms may lead to your account being closed and to action under the college’s student and staff rules.</p>
        </Section>

        <Section title="Records and accuracy">
          <p>E-CFunds shows what officers record and what SAS approves. The assistant (Ask E-CFunds) only explains those
            records and can make mistakes — check important figures on the actual screens and reports. Official decisions
            remain with SAS.</p>
        </Section>

        <Section title="Your data">
          <p>How your information is kept and who can see it is explained in the <Link to="/privacy" className="text-primary font-semibold">Privacy Notice</Link>,
            which is part of these terms.</p>
        </Section>

        <Section title="Changes">
          <p>SAS may update these terms. The date at the top shows the latest version; continuing to use E-CFunds means you
            accept the update. Questions: the Office of Student Affairs and Services.</p>
        </Section>
      </main>
    </div>
  );
}
