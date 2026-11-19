-- Resolution requests + their liquidation (Neil, 2026-11-19). Replaces Release / Expense / Budgets for treasurers.
--  • Treasurer files a RESOLUTION: attaches the signed resolution file only (the amount is written in the file).
--  • SAS opens the file and APPROVES by typing the amount → ledger 'release' (Saved with SAS → Cash on hand), or REJECTS
--    with remarks.
--  • Each approved resolution can be LIQUIDATED: treasurer attaches files (receipts, report) and types the amount spent;
--    SAS approves → ledger 'expense' (spent, from cash) + 'remittance' (unspent back to savings, at most the cash on
--    hand), or RETURNS it with remarks (the treasurer fixes and sends again).
-- Old remittance / release / expense requests and budgets stay as they are (history and anything still pending).
alter table public.fund_requests alter column amount drop not null;
alter table public.fund_requests add constraint fund_requests_amount_needed
  check (amount is not null or (kind = 'resolution' and status in ('pending', 'rejected', 'cancelled')));
alter table public.fund_requests
  add column file_name text check (file_name is null or length(file_name) between 1 and 200),
  add column liquidation_status text check (liquidation_status in ('submitted', 'approved', 'returned')),
  add column liquidation_files text[] not null default '{}' check (cardinality(liquidation_files) <= 10),
  add column liquidation_spent numeric(12,2) check (liquidation_spent is null or liquidation_spent >= 0),
  add column liquidation_remarks text,
  add column liquidation_submitted_at timestamptz,
  add column liquidated_at timestamptz,
  add column liquidated_by uuid references auth.users(id);
create index fund_requests_liquidation on public.fund_requests (liquidation_status) where liquidation_status is not null;

-- a file in the private receipts bucket, inside this org/club's folder
create or replace function private.org_file_ok(p_entity_id bigint, p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_path is not null and p_path like p_entity_id::text || '/%'
     and exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = p_path)
$$;

-- ── Treasurer: file a resolution (file only) ─────────────────────────────────────────────────────────────────
create or replace function private.file_resolution(p_entity_id bigint, p_path text, p_file_name text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_year bigint := private.current_school_year_id(); v_name text := nullif(trim(p_file_name), '');
begin
  if (select private.my_entity_id()) is distinct from p_entity_id then
    raise exception 'Only this org/club''s treasurer can file its resolutions.' using errcode = '42501';
  end if;
  if v_year is null then raise exception 'SAS hasn''t opened the school year yet.'; end if;
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = v_year) then
    raise exception 'This school year is already closed for your org/club.';
  end if;
  if not private.org_file_ok(p_entity_id, p_path) then
    raise exception 'The resolution file didn''t upload. Attach it again.';
  end if;
  v_name := left(coalesce(v_name, 'resolution'), 200);
  insert into public.fund_requests (entity_id, school_year_id, kind, amount, description, attachment_path, file_name, filed_by)
  values (p_entity_id, v_year, 'resolution', null, left('Resolution · ' || v_name, 500), p_path, v_name, (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- ── SAS: approve (with the amount from the file) or reject (with remarks) ────────────────────────────────────
create or replace function private.review_resolution(p_request_id bigint, p_approve boolean, p_amount numeric default null, p_remarks text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare r record; c numeric; s numeric; v_entry bigint;
begin
  perform private.require_admin();
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found or r.kind <> 'resolution' then raise exception 'Resolution request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This resolution was already %.', r.status; end if;
  if not p_approve then
    if coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say why the resolution is rejected.'; end if;
    update public.fund_requests set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), remarks = trim(p_remarks)
     where id = r.id;
    return null;
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Type the amount written in the resolution.'; end if;
  perform private.lock_entity(r.entity_id);
  select cash, saved into c, s from private.pockets(r.entity_id);
  if round(p_amount, 2) > s then raise exception 'Not enough saved with SAS (₱%).', s; end if;
  insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path)
  values (r.entity_id, r.school_year_id, 'release', round(p_amount, 2), r.description, r.id, r.attachment_path)
  returning id into v_entry;
  update public.fund_requests
     set status = 'approved', amount = round(p_amount, 2), reviewed_by = (select auth.uid()), reviewed_at = now(),
         remarks = nullif(trim(p_remarks), '')
   where id = r.id;
  return v_entry;
end $$;

-- ── Treasurer: liquidate an approved resolution (files + amount spent) ───────────────────────────────────────
create or replace function private.submit_resolution_liquidation(p_request_id bigint, p_files text[], p_spent numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; f text; org text;
begin
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found or r.kind <> 'resolution' then raise exception 'Resolution not found.'; end if;
  if (select private.my_entity_id()) is distinct from r.entity_id then
    raise exception 'Only this org/club''s treasurer can liquidate it.' using errcode = '42501';
  end if;
  if r.status <> 'approved' then raise exception 'Only an approved resolution can be liquidated.'; end if;
  if r.liquidation_status in ('submitted', 'approved') then raise exception 'This resolution''s liquidation was already %.', r.liquidation_status; end if;
  if coalesce(cardinality(p_files), 0) = 0 then raise exception 'Attach the receipts or the liquidation report.'; end if;
  if cardinality(p_files) > 10 then raise exception 'Attach up to 10 files.'; end if;
  foreach f in array p_files loop
    if not private.org_file_ok(r.entity_id, f) then raise exception 'One of the files didn''t upload. Remove it and attach it again.'; end if;
  end loop;
  if p_spent is null or p_spent < 0 then raise exception 'Type the amount spent (₱0 or more).'; end if;
  if round(p_spent, 2) > r.amount then raise exception 'The amount spent is more than what was released (₱%).', r.amount; end if;
  update public.fund_requests
     set liquidation_status = 'submitted', liquidation_files = p_files, liquidation_spent = round(p_spent, 2),
         liquidation_submitted_at = now(), liquidation_remarks = null
   where id = r.id;
  select short_name into org from public.entities where id = r.entity_id;
  perform private.notify(private.admin_ids(), 'request', org || ' submitted a liquidation',
    coalesce(r.file_name, 'Resolution') || ' · spent ' || private.peso(round(p_spent, 2)) || ' of ' || private.peso(r.amount),
    '/approvals?request=' || r.id);
end $$;

-- ── SAS: approve the liquidation (money moves) or return it with remarks ─────────────────────────────────────
create or replace function private.review_resolution_liquidation(p_request_id bigint, p_approve boolean, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; c numeric; s numeric; v_back numeric;
begin
  perform private.require_admin();
  select * into r from public.fund_requests where id = p_request_id for update;
  if not found or r.kind <> 'resolution' then raise exception 'Resolution not found.'; end if;
  if r.liquidation_status is distinct from 'submitted' then raise exception 'There is no liquidation waiting for this resolution.'; end if;
  if not p_approve then
    if coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say what to fix in the liquidation.'; end if;
    update public.fund_requests set liquidation_status = 'returned', liquidation_remarks = trim(p_remarks) where id = r.id;
    perform private.notify(private.treasurer_ids(r.entity_id), 'request_decision', 'SAS returned your liquidation',
      coalesce(r.file_name, 'Resolution') || ' · ' || left(trim(p_remarks), 80), '/requests?id=' || r.id);
    return;
  end if;
  perform private.lock_entity(r.entity_id);
  select cash, saved into c, s from private.pockets(r.entity_id);
  if r.liquidation_spent > c then
    raise exception 'The org/club''s cash on hand (₱%) is less than the amount spent. Check the ledger first.', c;
  end if;
  if r.liquidation_spent > 0 then
    insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path, category)
    values (r.entity_id, r.school_year_id, 'expense', r.liquidation_spent, r.description, r.id, r.liquidation_files[1], 'other');
  end if;
  v_back := least(greatest(r.amount - r.liquidation_spent, 0), greatest(c - r.liquidation_spent, 0));
  if v_back > 0 then
    insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id)
    values (r.entity_id, r.school_year_id, 'remittance', round(v_back, 2),
            left('Unspent from ' || coalesce(r.file_name, 'resolution') || ' returned to SAS (liquidation)', 500), r.id);
  end if;
  update public.fund_requests
     set liquidation_status = 'approved', liquidated_at = now(), liquidated_by = (select auth.uid()),
         liquidation_remarks = nullif(trim(p_remarks), '')
   where id = r.id;
  perform private.notify(private.treasurer_ids(r.entity_id), 'request_decision', 'Liquidation approved',
    coalesce(r.file_name, 'Resolution') || ' · spent ' || private.peso(r.liquidation_spent)
      || case when v_back > 0 then ' · ' || private.peso(v_back) || ' back to savings' else '' end,
    '/requests?id=' || r.id);
end $$;

-- ── Notifications for filing and deciding a resolution (amount may still be empty) ───────────────────────────
create or replace function private.notify_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org text; what text;
begin
  select short_name into org from public.entities where id = new.entity_id;
  what := case new.kind when 'remittance' then 'remittance' when 'release' then 'release request'
                        when 'resolution' then 'resolution request' else 'expense' end;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.notify(private.admin_ids(), 'request', org || ' filed a ' || what,
      case when new.kind = 'resolution' then coalesce(new.file_name, 'Resolution file')
           else private.peso(new.amount) || coalesce(' · ' || left(new.description, 80), '') end,
      '/approvals?request=' || new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform private.notify(private.treasurer_ids(new.entity_id), 'request_decision',
      'SAS ' || new.status::text || ' your ' || what,
      concat_ws(' · ', case when new.amount is not null then private.peso(new.amount) end,
                case when new.kind = 'resolution' then new.file_name end, left(new.remarks, 80)),
      '/requests?id=' || new.id);
  end if;
  return null;
end $$;

-- ── Public wrappers + grants ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.file_resolution(p_entity_id bigint, p_path text, p_file_name text)
returns bigint language sql volatile security invoker set search_path = '' as $$ select private.file_resolution(p_entity_id, p_path, p_file_name) $$;
create or replace function public.review_resolution(p_request_id bigint, p_approve boolean, p_amount numeric default null, p_remarks text default null)
returns bigint language sql volatile security invoker set search_path = '' as $$ select private.review_resolution(p_request_id, p_approve, p_amount, p_remarks) $$;
create or replace function public.submit_resolution_liquidation(p_request_id bigint, p_files text[], p_spent numeric)
returns void language sql volatile security invoker set search_path = '' as $$ select private.submit_resolution_liquidation(p_request_id, p_files, p_spent) $$;
create or replace function public.review_resolution_liquidation(p_request_id bigint, p_approve boolean, p_remarks text default null)
returns void language sql volatile security invoker set search_path = '' as $$ select private.review_resolution_liquidation(p_request_id, p_approve, p_remarks) $$;
revoke all on function
  private.file_resolution(bigint, text, text), public.file_resolution(bigint, text, text),
  private.review_resolution(bigint, boolean, numeric, text), public.review_resolution(bigint, boolean, numeric, text),
  private.submit_resolution_liquidation(bigint, text[], numeric), public.submit_resolution_liquidation(bigint, text[], numeric),
  private.review_resolution_liquidation(bigint, boolean, text), public.review_resolution_liquidation(bigint, boolean, text)
from public, anon;
grant execute on function
  private.file_resolution(bigint, text, text), public.file_resolution(bigint, text, text),
  private.review_resolution(bigint, boolean, numeric, text), public.review_resolution(bigint, boolean, numeric, text),
  private.submit_resolution_liquidation(bigint, text[], numeric), public.submit_resolution_liquidation(bigint, text[], numeric),
  private.review_resolution_liquidation(bigint, boolean, text), public.review_resolution_liquidation(bigint, boolean, text)
to authenticated;
revoke all on function private.org_file_ok(bigint, text) from public, anon;
grant execute on function private.org_file_ok(bigint, text) to authenticated;
