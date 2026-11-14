import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useSchoolFinance, useSchoolSummary, useSemesters } from '../../lib/data';
import { FinancePanel } from '../../components/finance/FinancePanel';
import { supabase } from '../../lib/supabase';
import { date, peso } from '../../lib/format';
import { Card, Chip, Empty, EntityLogo, HeroCard, PageHeader, SectionTitle, Spinner } from '../../components/ui';
import { NoYear } from '../../components/common';

export function StudentHome() {
  const { profile } = useAuth();
  const year = useCurrentYear();
  const summary = useSchoolSummary(year.data?.id);
  const sems = useSemesters(year.data?.id);
  const school = useSchoolFinance(year.data?.id);
  const dues = useQuery({
    queryKey: ['my-dues', profile?.student_id, year.data?.id],
    enabled: !!profile?.student_id && !!year.data,
    queryFn: async () => {
      // RLS: a student reads only their own memberships.
      const { data, error } = await supabase.from('memberships')
        .select('id, amount_due, is_paid, paid_at, semester_id, entity:entities(id, name, short_name, logo_path)')
        .eq('school_year_id', year.data!.id);
      if (error) throw error;
      return data;
    },
  });

  // My receipts (RLS: a student reads only their own), keyed by membership.
  const receipts = useQuery({
    queryKey: ['my-receipts', profile?.student_id, year.data?.id],
    enabled: !!profile?.student_id && !!year.data,
    queryFn: async () => {
      const { data, error } = await supabase.from('receipts').select('membership_id, receipt_no')
        .eq('school_year_id', year.data!.id).is('voided_at', null);
      if (error) throw error;
      return new Map(data.map((x) => [x.membership_id, x.receipt_no]));
    },
  });

  if (year.isLoading) return <Spinner />;
  const first = profile?.full_name?.split(' ')[0];
  if (!year.data) return <><PageHeader title={`Hi${first ? `, ${first}` : ''}`} /><NoYear /></>;
  const owed = (dues.data ?? []).filter((d) => !d.is_paid).reduce((s, d) => s + Number(d.amount_due), 0);
  const s = summary.data;
  // Fees are per semester: label each due with its semester, current semester first, then unpaid before paid.
  const semOf = new Map((sems.data ?? []).map((x) => [x.id, x]));
  const semLabel = (id: number | null) => {
    const x = id ? semOf.get(id) : undefined;
    return x ? `${x.term === 1 ? '1st' : '2nd'} semester` : 'School year';
  };
  const rank = (id: number | null) => (id && semOf.get(id)?.is_current ? 0 : 1);
  const list = [...(dues.data ?? [])].sort((a, b) => rank(a.semester_id) - rank(b.semester_id)
    || (semOf.get(b.semester_id ?? 0)?.term ?? 0) - (semOf.get(a.semester_id ?? 0)?.term ?? 0)
    || Number(a.is_paid) - Number(b.is_paid));

  return (
    <>
      <PageHeader title={`Hi${first ? `, ${first}` : ''}`} sub={`School year ${year.data.label}`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
        <Card>
          <SectionTitle>My dues</SectionTitle>
          {dues.isLoading ? <Spinner /> : !dues.data?.length ? (
            <Empty icon={<Wallet className="size-6" />} title="No dues yet">Once your org or club adds you as a member, your dues show here.</Empty>
          ) : (
            <>
              <div className={`rounded-[16px] p-4 mb-3 ${owed > 0 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>
                <p className="micro">{owed > 0 ? 'Still to pay' : 'All paid'}</p>
                <p className="money font-display font-extrabold text-[28px]">{peso(owed)}</p>
              </div>
              <ul className="divide-y divide-line">
                {list.map((d) => (
                  <li key={d.id} className="py-3 flex items-center gap-3">
                    <EntityLogo path={d.entity?.logo_path ?? null} name={d.entity?.name ?? ''} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{d.entity?.short_name}</p>
                      <p className="text-[13px] text-muted truncate">{semLabel(d.semester_id)} · {d.is_paid ? `paid ${date(d.paid_at)}` : 'pay your treasurer'}</p>
                      {d.is_paid && receipts.data?.get(d.id) && (
                        <Link to={`/receipt/${receipts.data.get(d.id)}`} className="inline-flex items-center min-h-8 text-[13px] font-semibold text-primary hover:underline">
                          View receipt
                        </Link>
                      )}
                    </div>
                    {/* Amount above the chip, so the text on the left has room (no 3-line wrap). */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="money font-semibold">{peso(d.amount_due)}</span>
                      <Chip tone={d.is_paid ? 'ok' : 'bad'}>{d.is_paid ? 'Paid' : 'Unpaid'}</Chip>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <div className="space-y-4">
          <HeroCard label="All student funds, school-wide" total={s?.total_fund ?? 0} cash={s?.cash_on_hand ?? 0} saved={s?.saved_with_sas ?? 0}
            foot={<>{s?.organizations ?? 0} organizations · {s?.clubs ?? 0} clubs</>} />
          <Link to="/reports" className="flex items-center justify-between rounded-[20px] bg-surface border border-line p-5 font-semibold hover:bg-surface2">
            Where each org & club's money went <ChevronRight className="size-5 text-muted" />
          </Link>
        </div>
      </div>
      <div className="mt-4">
        <FinancePanel finance={school.data} loading={school.isLoading} title="Where all student funds went this year"
          note="Every org and club together. Open Reports to see each one's approved expenses." />
      </div>
    </>
  );
}
