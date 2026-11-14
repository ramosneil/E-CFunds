import { Link } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, CalendarX2, Receipt } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Row } from '../lib/database.types';
import { date, kindLabel, peso } from '../lib/format';
import { Button, Card, Empty, StatusChip } from './ui';

export function NoYear({ admin }: { admin?: boolean }) {
  return (
    <Card className="mt-2">
      <Empty icon={<CalendarX2 className="size-6" />} title="No school year is open yet">
        {admin
          ? <>Open the school year first. Dues, requests and reports all belong to one.<div className="mt-4"><Link to="/calendar"><Button>Open a school year</Button></Link></div></>
          : 'The Office of Student Affairs has not opened this school year yet. Check back soon.'}
      </Empty>
    </Card>
  );
}

const kindIcon: Record<string, ReactNode> = {
  remittance: <ArrowUpRight className="size-5" />, release: <ArrowDownLeft className="size-5" />, expense: <Receipt className="size-5" />,
};
const kindTile: Record<string, string> = {
  remittance: 'bg-primary-soft text-primary', release: 'bg-gold-soft text-gold-text', expense: 'bg-bad-soft text-bad',
};

/** Icon tile · title · sub · amount · chip (design-system §5, "request row"). */
export function RequestRow({ r, entityName, action }: { r: Row<'fund_requests'>; entityName?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`size-11 rounded-[14px] grid place-items-center shrink-0 ${kindTile[r.kind]}`}>{kindIcon[r.kind]}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{kindLabel[r.kind]}{entityName ? ` · ${entityName}` : ''}</p>
        <p className="text-[13px] text-muted truncate">{r.description} · {date(r.filed_at)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="money font-semibold">{peso(r.amount)}</p>
        <div className="mt-1"><StatusChip status={r.status} /></div>
      </div>
      {action}
    </div>
  );
}

/** "If approved" preview: each pocket before → after, plus the total. */
export function IfApproved({ kind, amount, cash, saved }: { kind: Row<'fund_requests'>['kind']; amount: number; cash: number; saved: number }) {
  const a = Number.isFinite(amount) ? amount : 0;
  const after = kind === 'remittance' ? { cash: cash - a, saved: saved + a }
    : kind === 'release' ? { cash: cash + a, saved: saved - a }
    : { cash: cash - a, saved };
  const rows: [string, number, number, string][] = [
    ['Cash on hand', cash, after.cash, 'bg-pocket-cash'],
    ['Saved with SAS', saved, after.saved, 'bg-primary'],
    ['Total fund', cash + saved, after.cash + after.saved, ''],
  ];
  return (
    <div className="rounded-[16px] bg-surface2 p-4">
      <p className="micro text-muted mb-2">If approved</p>
      <dl className="space-y-1.5 text-[14px]">
        {rows.map(([k, b, n, dot]) => (
          <div key={k} className={`flex items-center justify-between gap-3 ${dot ? '' : 'pt-1.5 border-t border-line font-semibold'}`}>
            <dt className="flex items-center gap-2">{dot && <i className={`size-2 rounded-full ${dot}`} />}{k}</dt>
            <dd className="money">
              <span className="text-muted">{peso(b)}</span> → <b className={n < 0 ? 'text-bad' : n === b ? '' : n > b ? 'text-ok' : 'text-ink'}>{peso(n)}</b>
            </dd>
          </div>
        ))}
      </dl>
      {kind !== 'expense' && <p className="text-[12px] text-muted mt-2">Moves money between pockets; the total stays the same.</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="grid bg-surface2 rounded-[14px] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`h-10 rounded-[11px] font-semibold text-[14px] transition cursor-pointer ${value === v ? 'bg-primary text-on-primary shadow-sm' : 'text-muted hover:text-ink'}`}>{label}</button>
      ))}
    </div>
  );
}
