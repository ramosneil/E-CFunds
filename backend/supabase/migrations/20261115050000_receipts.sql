-- Digital receipts (Neil, 2026-11-15): every recorded dues payment gets a receipt number per org/club and school
-- year — e.g. SSG-2026-0001 — that the student can open and download. Undoing a payment VOIDS its receipt; the
-- number is kept and never reused. Issued by a trigger on memberships, so record_payment/undo_payment stay as they
-- are. Students read their own receipts, treasurers their org's, SAS all.

create table public.receipts (
  id bigint generated always as identity primary key,
  receipt_no text not null unique,
  membership_id bigint not null references public.memberships(id) on delete restrict,
  student_id bigint not null references public.students(id) on delete restrict,
  entity_id bigint not null references public.entities(id) on delete restrict,
  school_year_id bigint not null references public.school_years(id) on delete restrict,
  semester_id bigint references public.semesters(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  voided_at timestamptz,
  void_reason text
);
create index receipts_membership on public.receipts (membership_id);
create index receipts_student on public.receipts (student_id);
create index receipts_entity on public.receipts (entity_id, school_year_id);
alter table public.receipts enable row level security;
create policy "read own, own org's, or all (SAS) receipts" on public.receipts for select to authenticated using (
  (select private.is_admin()) or entity_id = (select private.my_entity_id()) or student_id = (select private.my_student_id()));
grant select on public.receipts to authenticated;

create table private.receipt_counters (
  entity_id bigint not null, school_year_id bigint not null, last_no int not null default 0,
  primary key (entity_id, school_year_id));
alter table private.receipt_counters enable row level security;

create trigger audit_receipts after insert or update or delete on public.receipts
  for each row execute function private.audit_row();

-- Next number for an org/club + school year, e.g. SSG-2026-0001 (the row lock keeps numbers unique and gap-free).
create or replace function private.next_receipt_no(p_entity_id bigint, p_school_year_id bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v int; v_code text; v_year text;
begin
  insert into private.receipt_counters (entity_id, school_year_id, last_no) values (p_entity_id, p_school_year_id, 1)
  on conflict (entity_id, school_year_id) do update set last_no = private.receipt_counters.last_no + 1
  returning last_no into v;
  select upper(regexp_replace(short_name, '[^A-Za-z0-9]+', '', 'g')) into v_code from public.entities where id = p_entity_id;
  select left(label, 4) into v_year from public.school_years where id = p_school_year_id;
  return v_code || '-' || v_year || '-' || lpad(v::text, 4, '0');
end $$;

create or replace function private.receipt_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_paid and not coalesce(old.is_paid, false) then
    insert into public.receipts (receipt_no, membership_id, student_id, entity_id, school_year_id, semester_id, amount, issued_at, issued_by)
    values (private.next_receipt_no(new.entity_id, new.school_year_id), new.id, new.student_id, new.entity_id,
            new.school_year_id, new.semester_id, new.amount_due, coalesce(new.paid_at, now()), (select auth.uid()));
  elsif not new.is_paid and coalesce(old.is_paid, false) then
    update public.receipts set voided_at = now(), void_reason = 'Payment undone'
     where membership_id = new.id and voided_at is null;
  end if;
  return null;
end $$;
create trigger receipt_on_payment after update of is_paid on public.memberships
  for each row execute function private.receipt_on_payment();

revoke all on function private.next_receipt_no(bigint, bigint), private.receipt_on_payment() from public, anon, authenticated;

-- Receipts for payments recorded before today, in the order they were paid.
do $$
declare m record;
begin
  for m in select * from public.memberships where is_paid order by paid_at, id loop
    insert into public.receipts (receipt_no, membership_id, student_id, entity_id, school_year_id, semester_id, amount, issued_at, issued_by)
    values (private.next_receipt_no(m.entity_id, m.school_year_id), m.id, m.student_id, m.entity_id, m.school_year_id,
            m.semester_id, m.amount_due, coalesce(m.paid_at, now()), m.recorded_by);
  end loop;
end $$;
