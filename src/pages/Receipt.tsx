import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ReceiptText } from 'lucide-react';
import { supabase, errorText } from '../lib/supabase';
import { date, peso } from '../lib/format';
import { Alert, Button, Card, Chip, Empty, EntityLogo, Spinner } from '../components/ui';

/** One payment receipt (e.g. SSG-2026-0001). RLS decides who may open it: the student it belongs to, that org/club's
 *  treasurer, or SAS. A voided receipt (payment undone) stays readable, clearly marked, and its number is never reused. */
export function Receipt() {
  const { no = '' } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const r = useQuery({
    queryKey: ['receipt', no],
    queryFn: async () => {
      const { data, error } = await supabase.from('receipts')
        .select('*, student:students(student_no, full_name, course, year_level), entity:entities(name, short_name, logo_path), school_year:school_years(label), semester:semesters(term)')
        .eq('receipt_no', no).maybeSingle();
      if (error) throw error;
      if (!data?.voided_at) return { rec: data, replacedBy: null as string | null };
      // If the payment was recorded again later, point to the receipt that replaced this one.
      const next = await supabase.from('receipts').select('receipt_no').eq('membership_id', data.membership_id)
        .is('voided_at', null).maybeSingle();
      return { rec: data, replacedBy: next.data?.receipt_no ?? null };
    },
  });

  const back = (
    <button onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}
      className="inline-flex items-center gap-1 h-11 text-primary font-semibold mb-2 cursor-pointer">
      <ArrowLeft className="size-4" aria-hidden />Back
    </button>
  );
  if (r.isLoading) return <Spinner />;
  const rec = r.data?.rec;
  if (!rec) return <>{back}<Card><Empty icon={<ReceiptText className="size-6" />} title="Receipt not found">
    {r.error ? errorText(r.error) : 'This receipt doesn’t exist, or it isn’t yours to open.'}</Empty></Card></>;

  const term = rec.semester ? `${rec.semester.term === 1 ? '1st' : '2nd'} semester · ` : '';
  const forWhat = `${rec.entity?.short_name ?? ''} membership fee · ${term}SY ${rec.school_year?.label ?? ''}`;
  const student = rec.student;
  const studentLine = [student?.student_no, [student?.course, student?.year_level].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  async function pdf() {
    if (!rec) return;
    setBusy(true); setErr('');
    try {
      const { newDoc, text, finish, PAGE, MUTED, LINE, HERO } = await import('../lib/export/pdf');
      const { doc, top } = await newDoc({ title: 'Payment receipt', subtitle: `Receipt no. ${rec.receipt_no}`, orgLogoPath: rec.entity?.logo_path });
      const W = doc.internal.pageSize.getWidth(), m = PAGE.m;
      let y = top + 4;
      const row = (label: string, value: string, bold = false) => {
        text(doc, label, m, y, { size: 9, color: MUTED });
        text(doc, value, m + 42, y, { size: 10.5, bold, maxWidth: W - 2 * m - 42 });
        y += 8;
      };
      row('Received from', student?.full_name ?? '—', true);
      if (studentLine) row('Student', studentLine);
      row('Paid to', rec.entity?.name ?? '—');
      row('For', forWhat);
      row('Date paid', date(rec.issued_at));
      doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(m, y - 2, W - m, y - 2);
      y += 6;
      text(doc, 'Amount paid', m, y, { size: 9, color: MUTED });
      text(doc, peso(rec.amount), W - m, y + 1, { size: 20, bold: true, color: HERO, align: 'right' });
      y += 14;
      if (rec.voided_at) {
        text(doc, 'VOID', W / 2, y + 14, { size: 40, bold: true, color: '#C0392B', align: 'center' });
        text(doc, `This receipt was voided on ${date(rec.voided_at)}${rec.void_reason ? ` — ${rec.void_reason}` : ''}.`, W / 2, y + 24, { size: 9, color: '#C0392B', align: 'center' });
        y += 32;
      }
      text(doc, 'Issued by E-CFunds when the treasurer recorded this payment. Receipt numbers are never reused.', m, y + 4, { size: 8, color: MUTED, maxWidth: W - 2 * m });
      await finish(doc, `Receipt ${rec.receipt_no}.pdf`);
    } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <>
      {back}
      <div className="max-w-xl">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center gap-4 p-5 border-b border-line">
            <EntityLogo path={rec.entity?.logo_path ?? null} name={rec.entity?.name ?? ''} size={48} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2"><span className="micro text-muted">Payment receipt</span>
                {rec.voided_at ? <Chip tone="bad">Void</Chip> : <Chip tone="ok">Paid</Chip>}</p>
              <h1 className="font-display text-[19px] sm:text-[22px] font-extrabold leading-tight money mt-0.5 whitespace-nowrap">{rec.receipt_no}</h1>
            </div>
          </div>
          {rec.voided_at && (
            <div className="px-5 pt-4">
              <Alert>
                Voided {date(rec.voided_at)}{rec.void_reason ? ` · ${rec.void_reason}` : ''}. This number is kept on record and never reused.
                {r.data?.replacedBy && <> The payment was recorded again: <Link className="underline font-semibold whitespace-nowrap" to={`/receipt/${r.data.replacedBy}`}>{r.data.replacedBy}</Link>.</>}
              </Alert>
            </div>
          )}
          <dl className="p-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-[15px]">
            <dt className="text-muted">Received from</dt><dd className="font-semibold min-w-0 break-words">{student?.full_name ?? '—'}</dd>
            {studentLine && <><dt className="text-muted">Student</dt><dd className="min-w-0 break-words">{studentLine}</dd></>}
            <dt className="text-muted">Paid to</dt><dd className="min-w-0 break-words">{rec.entity?.name}</dd>
            <dt className="text-muted">For</dt><dd className="min-w-0 break-words">{forWhat}</dd>
            <dt className="text-muted">Date paid</dt><dd>{date(rec.issued_at)}</dd>
          </dl>
          <div className={`mx-5 mb-5 rounded-[16px] p-4 flex items-center justify-between ${rec.voided_at ? 'bg-surface2 text-muted' : 'bg-ok-soft text-ok'}`}>
            <span className="micro">Amount paid</span>
            <span className={`money font-display font-extrabold text-[28px] ${rec.voided_at ? 'line-through' : ''}`}>{peso(rec.amount)}</span>
          </div>
        </Card>
        {err && <div className="mt-3"><Alert>{err}</Alert></div>}
        <Button variant="soft" className="mt-4 w-full sm:w-auto" busy={busy} onClick={pdf}>
          <Download className="size-4" aria-hidden />Download PDF
        </Button>
        <p className="text-[13px] text-muted mt-3">Issued automatically when the treasurer recorded this payment. Open the PDF to print or share it.</p>
      </div>
    </>
  );
}
