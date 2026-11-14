// Turns one audit_log row (table, action, before/after) into a short sentence for SAS's Activity log.
// Unknown changes fall back to "Changed a <thing>".
import { categoryLabel, kindLabel, peso } from './format';

type Row = Record<string, unknown> | null;
export type AuditRow = { id: number; table_name: string; action: string; before_row: Row; after_row: Row; actor: string | null; at: string };
type Names = { entity: (id: unknown) => string; person: (id: unknown) => string };

const THING: Record<string, string> = {
  entities: 'org/club', profiles: 'account', memberships: 'membership', ledger_entries: 'ledger entry',
  fund_requests: 'request', messages: 'message', students: 'student', semesters: 'semester', school_years: 'school year',
  accredited_entries: 'accredited-list entry', notifications: 'notification', year_closures: 'school-year closing',
  receipts: 'receipt', budgets: 'budget', budget_items: 'budget item', courses: 'course', course_orgs: 'course rule',
};
export const thingLabel = (t: string) => THING[t] ?? t.replace(/_/g, ' ');
const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => String(v ?? '');

export function describe(r: AuditRow, names: Names): string {
  const a = r.after_row ?? {}, b = r.before_row ?? {};
  const org = names.entity(a.entity_id ?? b.entity_id);
  switch (r.table_name) {
    case 'fund_requests': {
      const what = `${org}'s ${peso(n(a.amount ?? b.amount))} ${s(kindLabel[s(a.kind ?? b.kind)] ?? a.kind).toLowerCase()}`;
      if (r.action === 'insert') return `Filed ${what}${a.category ? ` (${categoryLabel[s(a.category)]})` : ''}`;
      if (a.status !== b.status) return `${s(a.status) === 'approved' ? 'Approved' : s(a.status) === 'rejected' ? 'Rejected' : s(a.status) === 'cancelled' ? 'Cancelled' : `Set to ${s(a.status)}`} ${what}`;
      return `Updated ${what}`;
    }
    case 'ledger_entries': {
      const k = s(kindLabel[s(a.kind)] ?? a.kind);
      return `${k} for ${org}: ${peso(n(a.amount))} — ${s(a.description)}`;
    }
    case 'memberships':
      if (r.action === 'insert') return `Listed a student in ${org} (${peso(n(a.amount_due))} to collect)`;
      if (r.action === 'delete') return `Removed a student's listing from ${org}`;
      if (a.is_paid && !b.is_paid) return `Recorded a ${peso(n(a.amount_due))} payment for ${org}`;
      if (!a.is_paid && b.is_paid) return `Undid a ${peso(n(a.amount_due))} payment for ${org}`;
      return `Updated a membership in ${org}`;
    case 'profiles': {
      const who = s(a.full_name || b.full_name || a.email || b.email) || 'an account';
      if (r.action === 'insert') return `${who} signed up`;
      if (a.status !== b.status) return `${s(a.status) === 'approved' ? 'Approved' : s(a.status) === 'disabled' ? 'Disabled' : s(a.status) === 'rejected' ? 'Rejected' : `Set ${s(a.status)} for`} ${who}${a.review_remarks ? ` — “${s(a.review_remarks)}”` : ''}`;
      return `Updated ${who}'s account`;
    }
    case 'students':
      return r.action === 'insert' ? `Added student ${s(a.full_name)} (${s(a.student_no)})` : r.action === 'delete' ? `Removed student ${s(b.full_name)}` : `Updated student ${s(a.full_name)}`;
    case 'entities':
      return r.action === 'insert' ? `Added ${s(a.short_name)}` : a.dues_amount !== b.dues_amount ? `Changed ${s(a.short_name)}'s fee: ${peso(n(b.dues_amount))} → ${peso(n(a.dues_amount))}` : `Updated ${s(a.short_name ?? b.short_name)}`;
    case 'messages':
      return r.action === 'insert' ? `Sent a message ${a.entity_id ? `in ${org}'s chat` : 'to all treasurers'}` : r.action === 'delete' ? `Deleted a message ${b.entity_id ? `in ${names.entity(b.entity_id)}'s chat` : 'to all treasurers'}` : 'Message read';
    case 'year_closures': return `Closed the school year for ${org} (${peso(n(a.closing_total))} carried over)`;
    case 'receipts': return a.voided_at && !b.voided_at ? `Voided receipt ${s(a.receipt_no)}` : `Issued receipt ${s(a.receipt_no)} (${peso(n(a.amount))})`;
    case 'budgets': return r.action === 'insert' ? `Filed budget “${s(a.title)}” for ${org}` : a.status !== b.status ? `Budget “${s(a.title)}” → ${s(a.status).replace(/_/g, ' ')}` : `Updated budget “${s(a.title)}”`;
    default:
      return `${r.action === 'insert' ? 'Added' : r.action === 'delete' ? 'Deleted' : 'Changed'} a ${thingLabel(r.table_name)}`;
  }
}
