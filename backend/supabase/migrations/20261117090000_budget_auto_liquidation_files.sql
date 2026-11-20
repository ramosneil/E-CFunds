-- Budgets do the math by themselves + liquidation files (Neil, 2026-11-17).
--  • A liquidation carries files (photos/PDFs of receipts, attendance, report) — up to 10, stored in the private
--    'receipts' bucket under the org's folder (same rules as expense receipts).
--  • When SAS approves a liquidation, the released-but-unspent cash goes back to SAS savings automatically
--    (a 'remittance' ledger entry tagged to the budget), capped at the cash the org actually has on hand.
--  • budget_status gains: returned (unspent sent back), remaining (budget − spent).
alter table public.budgets add column liquidation_files text[] not null default '{}'
  check (cardinality(liquidation_files) <= 10);

-- ── Treasurer: submit the liquidation, with files ─────────────────────────────────────────────────────────────
drop function public.submit_liquidation(bigint, text);
drop function private.submit_liquidation(bigint, text);
create function private.submit_liquidation(p_budget_id bigint, p_note text, p_files text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare b record; f text; v_files text[] := coalesce(p_files, '{}');
begin
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if (select private.my_entity_id()) is distinct from b.entity_id then raise exception 'Only this org/club''s treasurer can liquidate it.' using errcode = '42501'; end if;
  if b.status <> 'approved' then raise exception 'Only an approved budget can be liquidated (this one is %).', replace(b.status, '_', ' '); end if;
  if exists (select 1 from public.fund_requests where budget_id = b.id and status = 'pending') then
    raise exception 'Wait for SAS to decide the pending requests under this budget first.';
  end if;
  if coalesce(length(trim(p_note)), 0) < 3 then raise exception 'Write a short report of the activity (what was bought, what was left).'; end if;
  if cardinality(v_files) > 10 then raise exception 'Attach up to 10 files.'; end if;
  foreach f in array v_files loop
    if f is null or f not like b.entity_id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = f) then
      raise exception 'One of the attached files didn''t upload. Remove it and attach it again.';
    end if;
  end loop;
  update public.budgets set status = 'liquidation_submitted', liquidation_note = trim(p_note), liquidation_submitted_at = now(),
         remarks = null, liquidation_files = v_files
   where id = b.id;
end $$;
create function public.submit_liquidation(p_budget_id bigint, p_note text, p_files text[] default '{}')
returns void language sql volatile security invoker set search_path = '' as $$ select private.submit_liquidation(p_budget_id, p_note, p_files) $$;

-- ── SAS: approving a liquidation returns the unspent cash to SAS savings ──────────────────────────────────────
create or replace function private.review_liquidation(p_budget_id bigint, p_approve boolean, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b record; c numeric; s numeric; v_back numeric;
begin
  perform private.require_admin();
  select * into b from public.budgets where id = p_budget_id for update;
  if b.id is null then raise exception 'Budget not found.'; end if;
  if b.status <> 'liquidation_submitted' then raise exception 'There is no liquidation waiting for this budget.'; end if;
  if not p_approve and coalesce(length(trim(p_remarks)), 0) < 3 then raise exception 'Say what to fix in the liquidation.'; end if;
  if p_approve then
    perform private.lock_entity(b.entity_id);
    select cash, saved into c, s from private.pockets(b.entity_id);
    v_back := least(greatest(private.budget_moved(b.id, 'release') - private.budget_moved(b.id, 'expense'), 0), greatest(c, 0));
    if v_back > 0 then
      insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, budget_id)
      values (b.entity_id, b.school_year_id, 'remittance', round(v_back, 2), 'Unspent cash from “' || b.title || '” returned to SAS (liquidation)', b.id);
    end if;
    update public.budgets set status = 'liquidated', liquidated_by = (select auth.uid()), liquidated_at = now(), remarks = nullif(trim(p_remarks), '')
     where id = b.id;
  else   -- returned: back to approved, the treasurer fixes and submits again (still due on the same date)
    update public.budgets set status = 'approved', remarks = trim(p_remarks) where id = b.id;
  end if;
end $$;

-- ── View: + returned, remaining ───────────────────────────────────────────────────────────────────────────────
drop view public.budget_status;
create view public.budget_status with (security_invoker = true) as
select b.*,
       private.budget_moved(b.id, 'release') as released,
       private.budget_moved(b.id, 'expense') as spent,
       coalesce((select sum(r.amount) from public.fund_requests r where r.budget_id = b.id and r.kind = 'release' and r.status = 'pending'), 0) as pending_release,
       (b.status = 'approved' and b.liquidation_due < private.manila_today()) as is_overdue,
       private.budget_moved(b.id, 'remittance') as returned,
       b.total - private.budget_moved(b.id, 'expense') as remaining
  from public.budgets b;
grant select on public.budget_status to authenticated;

revoke all on function private.submit_liquidation(bigint, text, text[]), public.submit_liquidation(bigint, text, text[]) from public, anon;
grant execute on function private.submit_liquidation(bigint, text, text[]), public.submit_liquidation(bigint, text, text[]) to authenticated;
