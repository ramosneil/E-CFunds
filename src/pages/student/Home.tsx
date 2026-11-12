import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCurrentYear, useSchoolSummary } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { date, peso } from '../../lib/format';
import { Card, Chip, Empty, EntityLogo, HeroCard, PageHeader, SectionTitle, Spinner } from '../../components/ui';
import { NoYear } from '../../components/common';

export function StudentHome() {
  const { profile } = useAuth();
  const year = useCurrentYear();
  const summary = useSchoolSummary(year.data?.id);
  const dues = useQuery({
    queryKey: ['my-dues', profile?.student_id, year.data?.id],
    enabled: !!profile?.student_id && !!year.data,
    queryFn: async () => {
      // RLS: a student reads only their own memberships.
      const { data, error } = await supabase.from('memberships')
        .select('id, amount_due, is_paid, paid_at, entity:entities(id, name, short_name, logo_path)')
        .eq('school_year_id', year.data!.id);
      if (error) throw error;
      return data;
    },
  });

  if (year.isLoading) return <Spinner />;
  const first = profile?.full_name?.split(' ')[0];
  if (!year.data) return <><PageHeader title={`Hi${first ? `, ${first}` : ''}`} /><NoYear /></>;
  const owed = (dues.data ?? []).filter((d) => !d.is_paid).reduce((s, d) => s + Number(d.amount_due), 0);
  const s = summary.data;

  return (
    <>
      <PageHeader title={`Hi${first ? `, ${first}` : ''}`} sub={`School year ${year.data.label}`} />
      <div className="grid gap-4 lg:grid-cols-2 items-start">
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
                {dues.data.map((d) => (
                  <li key={d.id} className="py-3 flex items-center gap-3">
                    <EntityLogo path={d.entity?.logo_path ?? null} name={d.entity?.name ?? ''} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{d.entity?.short_name}</p>
                      <p className="text-[13px] text-muted">{d.is_paid ? `Paid ${date(d.paid_at)}` : 'Pay your treasurer in cash'}</p>
                    </div>
                    <span className="money font-semibold">{peso(d.amount_due)}</span>
                    <Chip tone={d.is_paid ? 'ok' : 'bad'}>{d.is_paid ? 'Paid' : 'Unpaid'}</Chip>
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
            See every org & club report <ChevronRight className="size-5 text-muted" />
          </Link>
        </div>
      </div>
    </>
  );
}
