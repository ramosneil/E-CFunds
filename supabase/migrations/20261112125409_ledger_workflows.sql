-- Ledger rules, balance reports and every money workflow (business-rules §2, §4).
-- All money writes go through these functions; users have no direct write access to the ledger.

-- ---------- Effect of one ledger row on each pocket (business-rules §2 table) ----------
create or replace function private.d_cash(k public.ledger_kind, amt numeric, p public.pocket, dir smallint)
returns numeric language sql immutable set search_path = '' as $$
  select case k when 'collection' then amt
                when 'remittance' then -amt
                when 'release'    then amt
                when 'expense'    then -amt
                when 'adjustment' then case when p = 'cash' then dir * amt else 0 end
                when 'reversal'   then case when p = 'cash' then dir * amt else 0 end
                else 0 end
$$;

create or replace function private.d_saved(k public.ledger_kind, amt numeric, p public.pocket, dir smallint)
returns numeric language sql immutable set search_path = '' as $$
  select case k when 'opening'    then amt
                when 'remittance' then amt
                when 'release'    then -amt
                when 'adjustment' then case when p = 'saved' then dir * amt else 0 end
                when 'reversal'   then case when p = 'saved' then dir * amt else 0 end
                else 0 end
$$;

-- Current pockets of one entity (all years; closed years always end with cash = 0).
create or replace function private.pockets(p_entity_id bigint, out cash numeric, out saved numeric)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(private.d_cash(l.kind, l.amount, l.pocket, l.direction)), 0),
         coalesce(sum(private.d_saved(l.kind, l.amount, l.pocket, l.direction)), 0)
  from public.ledger_entries l where l.entity_id = p_entity_id
$$;

create or replace function private.pending(p_entity_id bigint, p_kind public.request_kind, p_exclude bigint default null)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(r.amount), 0) from public.fund_requests r
  where r.entity_id = p_entity_id and r.kind = p_kind and r.status = 'pending'
    and r.id is distinct from p_exclude
$$;

create or replace function private.current_school_year_id()
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v bigint;
begin
  select id into v from public.school_years where is_current;
  if v is null then raise exception 'No current school year is set. SAS must set one first.'; end if;
  return v;
end $$;

create or replace function private.require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only the SAS admin can do this.' using errcode = '42501';
  end if;
end $$;

create or replace function private.require_staff_for(p_entity_id bigint)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not (coalesce((select private.is_admin()), false)
          or (select private.my_entity_id()) is not distinct from p_entity_id and p_entity_id is not null) then
    raise exception 'You can only do this for your own org/club.' using errcode = '42501';
  end if;
end $$;

-- Serialize all money changes for one entity (prevents two approvals racing past a limit).
create or replace function private.lock_entity(p_entity_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.entities where id = p_entity_id for update;
  if not found then raise exception 'Org/club % does not exist.', p_entity_id; end if;
end $$;

create or replace function private.assert_pockets_not_negative(p_entity_id bigint)
returns void language plpgsql stable security definer set search_path = '' as $$
declare c numeric; s numeric;
begin
  select cash, saved into c, s from private.pockets(p_entity_id);
  if c < 0 or s < 0 then
    raise exception 'This would make a pocket negative (cash %, saved %).', c, s;
  end if;
end $$;

-- ---------- Ledger guards ----------
create or replace function private.ledger_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Ledger entries can never be changed or deleted. Post a reversal or adjustment instead.';
end $$;

create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function private.ledger_append_only();
create trigger ledger_no_truncate before truncate on public.ledger_entries
  for each statement execute function private.ledger_append_only();

create or replace function private.ledger_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.year_closures c
             where c.entity_id = new.entity_id and c.school_year_id = new.school_year_id) then
    raise exception 'School year is already closed for this org/club.';
  end if;
  if new.semester_id is not null and not exists (
       select 1 from public.semesters s where s.id = new.semester_id and s.school_year_id = new.school_year_id) then
    raise exception 'Semester does not belong to that school year.';
  end if;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  new.created_at := now();
  return new;
end $$;

create trigger ledger_before_insert before insert on public.ledger_entries
  for each row execute function private.ledger_before_insert();

-- ---------- Membership rules: max 1 organization + 1 club per school year (SSG exempt) ----------
create or replace function private.membership_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  select category, is_school_wide into e from public.entities where id = new.entity_id;
  if new.semester_id is not null and not exists (
       select 1 from public.semesters s where s.id = new.semester_id and s.school_year_id = new.school_year_id) then
    raise exception 'Semester does not belong to that school year.';
  end if;
  if not e.is_school_wide and exists (
       select 1 from public.memberships m join public.entities x on x.id = m.entity_id
       where m.student_id = new.student_id and m.school_year_id = new.school_year_id
         and m.entity_id <> new.entity_id and m.id is distinct from new.id
         and x.category = e.category and not x.is_school_wide) then
    raise exception 'This student already belongs to another % this school year.', e.category;
  end if;
  return new;
end $$;

create trigger memberships_rules before insert or update on public.memberships
  for each row execute function private.membership_rules();

-- ---------- Reports (aggregates only; the only money view students get) ----------
create or replace function public.get_entity_report(p_school_year_id bigint, p_semester_id bigint default null)
returns table (
  entity_id bigint, name text, short_name text, category public.entity_category, is_school_wide boolean,
  previous_funds numeric, openings numeric, collections numeric, expenses numeric, adjustments numeric,
  remittances numeric, releases numeric,
  cash_on_hand numeric, saved_with_sas numeric, total_fund numeric,
  pending_remittances numeric, pending_releases numeric, pending_expenses numeric,
  available_to_remit numeric, available_to_release numeric,
  members bigint, paid_members bigint, is_closed boolean)
language plpgsql stable security definer set search_path = '' as $$
declare y_start date;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Your account is not approved yet.' using errcode = '42501';
  end if;
  select starts_on into y_start from public.school_years where id = p_school_year_id;
  if y_start is null then raise exception 'Unknown school year.'; end if;

  return query
  with e as (
    select l.*, sy.starts_on,
           private.d_cash(l.kind, l.amount, l.pocket, l.direction)  as dc,
           private.d_saved(l.kind, l.amount, l.pocket, l.direction) as ds,
           orig.kind as reversed_kind
    from public.ledger_entries l
    join public.school_years sy on sy.id = l.school_year_id
    left join public.ledger_entries orig on orig.id = l.reverses_id
    where sy.starts_on <= y_start
  ), agg as (
    select e.entity_id,
      sum(e.dc + e.ds) filter (where e.starts_on < y_start) as prev,
      sum(e.amount) filter (where e.school_year_id = p_school_year_id and e.kind = 'opening') as opn,
      sum(case when e.kind = 'collection' then e.amount
               when e.kind = 'reversal' and e.reversed_kind = 'collection' then -e.amount end)
        filter (where e.school_year_id = p_school_year_id) as col,
      sum(case when e.kind = 'expense' then e.amount
               when e.kind = 'reversal' and e.reversed_kind = 'expense' then -e.amount end)
        filter (where e.school_year_id = p_school_year_id) as exp,
      sum(case when e.kind = 'adjustment' then e.direction * e.amount
               when e.kind = 'reversal' and e.reversed_kind in ('opening', 'adjustment') then e.direction * e.amount end)
        filter (where e.school_year_id = p_school_year_id) as adj,
      sum(e.amount) filter (where e.school_year_id = p_school_year_id and e.kind = 'remittance') as rem,
      sum(e.amount) filter (where e.school_year_id = p_school_year_id and e.kind = 'release') as rel,
      sum(e.dc) as cash, sum(e.ds) as saved
    from e group by e.entity_id
  ), pend as (
    select r.entity_id,
      sum(r.amount) filter (where r.kind = 'remittance') as p_rem,
      sum(r.amount) filter (where r.kind = 'release')    as p_rel,
      sum(r.amount) filter (where r.kind = 'expense')    as p_exp
    from public.fund_requests r
    where r.status = 'pending' and r.school_year_id = p_school_year_id
    group by r.entity_id
  ), mem as (
    select m.entity_id, count(*) as n, count(*) filter (where m.is_paid) as paid
    from public.memberships m
    where m.school_year_id = p_school_year_id
      and (p_semester_id is null or m.semester_id is null or m.semester_id = p_semester_id)
    group by m.entity_id
  )
  select en.id, en.name, en.short_name, en.category, en.is_school_wide,
    coalesce(a.prev, 0), coalesce(a.opn, 0), coalesce(a.col, 0), coalesce(a.exp, 0), coalesce(a.adj, 0),
    coalesce(a.rem, 0), coalesce(a.rel, 0),
    coalesce(a.cash, 0), coalesce(a.saved, 0), coalesce(a.cash, 0) + coalesce(a.saved, 0),
    coalesce(p.p_rem, 0), coalesce(p.p_rel, 0), coalesce(p.p_exp, 0),
    coalesce(a.cash, 0) - coalesce(p.p_rem, 0) - coalesce(p.p_exp, 0),
    coalesce(a.saved, 0) - coalesce(p.p_rel, 0),
    coalesce(mm.n, 0), coalesce(mm.paid, 0),
    exists (select 1 from public.year_closures c where c.entity_id = en.id and c.school_year_id = p_school_year_id)
  from public.entities en
  left join agg a on a.entity_id = en.id
  left join pend p on p.entity_id = en.id
  left join mem mm on mm.entity_id = en.id
  where en.is_active
  order by en.category, en.short_name;
end $$;

create or replace function public.get_school_summary(p_school_year_id bigint)
returns table (cash_on_hand numeric, saved_with_sas numeric, total_fund numeric, expenses numeric,
               organizations bigint, clubs bigint, students bigint, pending_requests bigint)
language sql stable security definer set search_path = '' as $$
  select sum(r.cash_on_hand), sum(r.saved_with_sas), sum(r.total_fund), sum(r.expenses),
         count(*) filter (where r.category = 'organization'), count(*) filter (where r.category = 'club'),
         (select count(*) from public.students s where s.is_active),
         (select count(*) from public.fund_requests f where f.status = 'pending' and f.school_year_id = p_school_year_id)
  from public.get_entity_report(p_school_year_id) r
$$;

-- ---------- Dues ----------
create or replace function public.record_payment(p_membership_id bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare m record; v_entry bigint; v_student_no text;
begin
  select * into m from public.memberships where id = p_membership_id for update;
  if not found then raise exception 'Membership not found.'; end if;
  perform private.require_staff_for(m.entity_id);
  if m.is_paid then raise exception 'Already marked paid.'; end if;
  if m.amount_due <= 0 then raise exception 'Nothing is due on this membership.'; end if;
  perform private.lock_entity(m.entity_id);
  select student_no into v_student_no from public.students where id = m.student_id;

  insert into public.ledger_entries (entity_id, school_year_id, semester_id, kind, amount, description, membership_id)
  values (m.entity_id, m.school_year_id, m.semester_id, 'collection', m.amount_due, 'Dues · ' || v_student_no, m.id)
  returning id into v_entry;

  update public.memberships
     set is_paid = true, paid_at = now(), collection_entry_id = v_entry, recorded_by = (select auth.uid())
   where id = m.id;
  return v_entry;
end $$;

create or replace function public.undo_payment(p_membership_id bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare m record; v_entry bigint; v_amount numeric;
begin
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Give a reason for undoing the payment.'; end if;
  select * into m from public.memberships where id = p_membership_id for update;
  if not found then raise exception 'Membership not found.'; end if;
  perform private.require_staff_for(m.entity_id);
  if not m.is_paid then raise exception 'This membership is not marked paid.'; end if;
  perform private.lock_entity(m.entity_id);
  select amount into v_amount from public.ledger_entries where id = m.collection_entry_id;

  insert into public.ledger_entries (entity_id, school_year_id, semester_id, kind, amount, pocket, direction,
                                     description, membership_id, reverses_id)
  values (m.entity_id, private.current_school_year_id(), null, 'reversal', v_amount, 'cash', -1,
          'Undo paid: ' || trim(p_reason), m.id, m.collection_entry_id)
  returning id into v_entry;

  update public.memberships set is_paid = false, paid_at = null, collection_entry_id = null where id = m.id;
  perform private.assert_pockets_not_negative(m.entity_id);
  return v_entry;
end $$;

create or replace function public.set_entity_dues(p_entity_id bigint, p_period public.dues_period, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff_for(p_entity_id);
  if p_amount is null or p_amount < 0 then raise exception 'Dues amount must be zero or more.'; end if;
  update public.entities set dues_period = p_period, dues_amount = round(p_amount, 2) where id = p_entity_id;
end $$;

-- ---------- Requests: treasurer files, SAS reviews ----------
create or replace function public.file_request(p_entity_id bigint, p_kind public.request_kind, p_amount numeric,
                                               p_description text, p_attachment_path text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; v_id bigint; v_year bigint := private.current_school_year_id();
begin
  if (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer can file its requests.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than ₱0.'; end if;
  if p_kind = 'expense' and p_attachment_path is null then raise exception 'Attach the receipt for an expense.'; end if;
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = v_year) then
    raise exception 'This school year is already closed for your org/club.';
  end if;
  perform private.lock_entity(p_entity_id);
  select cash, saved into c, s from private.pockets(p_entity_id);

  if p_kind in ('remittance', 'expense')
     and p_amount > c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense') then
    raise exception 'Amount is more than the cash available (₱%).',
      c - private.pending(p_entity_id, 'remittance') - private.pending(p_entity_id, 'expense');
  end if;
  if p_kind = 'release' and p_amount > s - private.pending(p_entity_id, 'release') then
    raise exception 'Amount is more than the saved funds available (₱%).', s - private.pending(p_entity_id, 'release');
  end if;

  insert into public.fund_requests (entity_id, school_year_id, kind, amount, description, attachment_path, filed_by)
  values (p_entity_id, v_year, p_kind, round(p_amount, 2), trim(p_description), p_attachment_path, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_request(p_request_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if (select private.my_entity_id()) is distinct from r.entity_id then
    raise exception 'You can only cancel your own org/club''s requests.' using errcode = '42501';
  end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be cancelled.'; end if;
  update public.fund_requests set status = 'cancelled', reviewed_at = now() where id = r.id;
end $$;

create or replace function public.review_request(p_request_id bigint, p_approve boolean, p_remarks text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r record; c numeric; s numeric; v_entry bigint;
begin
  perform private.require_admin();
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already %.', r.status; end if;
  perform private.lock_entity(r.entity_id);

  if not p_approve then
    if coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say why the request is rejected.'; end if;
    update public.fund_requests
       set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = trim(p_remarks)
     where id = r.id;
    return null;
  end if;

  select cash, saved into c, s from private.pockets(r.entity_id);
  if r.kind in ('remittance', 'expense') and r.amount > c then
    raise exception 'Not enough cash on hand (₱%).', c;
  end if;
  if r.kind = 'release' and r.amount > s then
    raise exception 'Not enough saved with SAS (₱%).', s;
  end if;

  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path)
  values (r.entity_id, r.school_year_id, r.kind::text::public.ledger_kind, r.amount, r.description, r.id, r.attachment_path)
  returning id into v_entry;

  update public.fund_requests
     set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = nullif(trim(p_remarks), '')
   where id = r.id;
  return v_entry;
end $$;

-- SAS releases saved money directly (no request), budget-based, no fixed cap.
create or replace function public.admin_release(p_entity_id bigint, p_amount numeric, p_description text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare s numeric; v_entry bigint;
begin
  perform private.require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than ₱0.'; end if;
  if coalesce(length(trim(p_description)), 0) < 3 then raise exception 'Describe what the release is for.'; end if;
  perform private.lock_entity(p_entity_id);
  select saved into s from private.pockets(p_entity_id);
  if p_amount > s - private.pending(p_entity_id, 'release') then
    raise exception 'Amount is more than the saved funds available (₱%).', s - private.pending(p_entity_id, 'release');
  end if;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description)
  values (p_entity_id, private.current_school_year_id(), 'release', round(p_amount, 2), trim(p_description))
  returning id into v_entry;
  return v_entry;
end $$;

-- Corrections: never edit, always post a new row with a reason.
create or replace function public.admin_adjust(p_entity_id bigint, p_pocket public.pocket, p_direction smallint,
                                               p_amount numeric, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_entry bigint;
begin
  perform private.require_admin();
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than ₱0.'; end if;
  if p_direction not in (-1, 1) then raise exception 'Direction must be +1 or -1.'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Give a reason for the adjustment.'; end if;
  perform private.lock_entity(p_entity_id);
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, pocket, direction, description)
  values (p_entity_id, private.current_school_year_id(), 'adjustment', round(p_amount, 2), p_pocket, p_direction, trim(p_reason))
  returning id into v_entry;
  perform private.assert_pockets_not_negative(p_entity_id);
  return v_entry;
end $$;

-- Reverse a single-pocket entry (opening, expense, adjustment). Dues use undo_payment;
-- a wrong remittance/release is fixed with two adjustments.
create or replace function public.reverse_entry(p_entry_id bigint, p_reason text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare l record; v_pocket public.pocket; v_dir smallint; v_entry bigint;
begin
  perform private.require_admin();
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'Give a reason for the reversal.'; end if;
  select * into l from public.ledger_entries where id = p_entry_id;
  if not found then raise exception 'Entry not found.'; end if;
  if l.kind not in ('opening', 'expense', 'adjustment') then
    raise exception 'A % entry cannot be reversed here.', l.kind;
  end if;
  if exists (select 1 from public.ledger_entries where reverses_id = l.id) then
    raise exception 'This entry was already reversed.';
  end if;
  perform private.lock_entity(l.entity_id);
  v_pocket := case l.kind when 'opening' then 'saved' when 'expense' then 'cash' else l.pocket end;
  v_dir    := case l.kind when 'opening' then -1 when 'expense' then 1 else -l.direction end;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, pocket, direction, description, reverses_id)
  values (l.entity_id, private.current_school_year_id(), 'reversal', l.amount, v_pocket, v_dir,
          'Reversal: ' || trim(p_reason), l.id)
  returning id into v_entry;
  perform private.assert_pockets_not_negative(l.entity_id);
  return v_entry;
end $$;

-- ---------- Turnover ----------
create or replace function public.close_school_year(p_entity_id bigint, p_school_year_id bigint)
returns numeric language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric;
begin
  perform private.require_admin();
  perform private.lock_entity(p_entity_id);
  if exists (select 1 from public.fund_requests
             where entity_id = p_entity_id and status = 'pending') then
    raise exception 'Resolve all pending requests first.';
  end if;
  select cash, saved into c, s from private.pockets(p_entity_id);
  if c <> 0 then raise exception 'All cash must be remitted before turnover (₱% still on hand).', c; end if;
  insert into public.year_closures (entity_id, school_year_id, closed_by, closing_total)
  values (p_entity_id, p_school_year_id, (select auth.uid()), c + s);
  return c + s;
end $$;

-- ---------- Accounts ----------
create or replace function public.review_account(p_profile_id uuid, p_approve boolean,
  p_role public.app_role default null, p_entity_id bigint default null, p_student_id bigint default null,
  p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_profile_id = (select auth.uid()) then raise exception 'You cannot review your own account.'; end if;
  if not p_approve then
    update public.profiles set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(),
           review_remarks = p_remarks
     where id = p_profile_id;
    return;
  end if;
  if p_role is null then raise exception 'Choose the role to approve.'; end if;
  update public.profiles
     set status = 'approved', role = p_role,
         entity_id  = case when p_role = 'treasurer' then p_entity_id end,
         student_id = case when p_role = 'student' then p_student_id end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_remarks = p_remarks
   where id = p_profile_id;
  if not found then raise exception 'Account not found.'; end if;
end $$;

create or replace function public.disable_account(p_profile_id uuid, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_profile_id = (select auth.uid()) then raise exception 'You cannot disable your own account.'; end if;
  update public.profiles set status = 'disabled', reviewed_by = (select auth.uid()), reviewed_at = now(),
         review_remarks = p_remarks
   where id = p_profile_id;
end $$;

-- ---------- Messages ----------
create or replace function public.mark_thread_read(p_entity_id bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform private.require_staff_for(p_entity_id);
  update public.messages set read_at = now()
   where entity_id = p_entity_id and read_at is null and sender_id <> (select auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Function privileges: signed-in users only (each function checks the role itself) ----------
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role(), private.is_admin(), private.is_approved(),
  private.my_entity_id(), private.my_student_id() to authenticated;

revoke all on function
  public.get_entity_report(bigint, bigint), public.get_school_summary(bigint),
  public.record_payment(bigint), public.undo_payment(bigint, text), public.set_entity_dues(bigint, public.dues_period, numeric),
  public.file_request(bigint, public.request_kind, numeric, text, text), public.cancel_request(bigint),
  public.review_request(bigint, boolean, text), public.admin_release(bigint, numeric, text),
  public.admin_adjust(bigint, public.pocket, smallint, numeric, text), public.reverse_entry(bigint, text),
  public.close_school_year(bigint, bigint),
  public.review_account(uuid, boolean, public.app_role, bigint, bigint, text), public.disable_account(uuid, text),
  public.mark_thread_read(bigint)
from public, anon;

grant execute on function
  public.get_entity_report(bigint, bigint), public.get_school_summary(bigint),
  public.record_payment(bigint), public.undo_payment(bigint, text), public.set_entity_dues(bigint, public.dues_period, numeric),
  public.file_request(bigint, public.request_kind, numeric, text, text), public.cancel_request(bigint),
  public.review_request(bigint, boolean, text), public.admin_release(bigint, numeric, text),
  public.admin_adjust(bigint, public.pocket, smallint, numeric, text), public.reverse_entry(bigint, text),
  public.close_school_year(bigint, bigint),
  public.review_account(uuid, boolean, public.app_role, bigint, bigint, text), public.disable_account(uuid, text),
  public.mark_thread_read(bigint)
to authenticated;
