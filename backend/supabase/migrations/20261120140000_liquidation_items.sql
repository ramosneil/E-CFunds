-- Liquidation with item lines (Neil, 2026-11-20): the treasurer types the activity name (e.g. "SimuLIT") and each
-- receipt item (Particular · Unit · Qty · Unit price) next to the receipt files. The amount spent is the items' total,
-- worked out here. The Financial Report prints them under the activity name, like the SAS spreadsheet form.
-- Old app versions that still send only an amount keep working (items are optional).
alter table public.fund_requests
  add column activity_title text check (activity_title is null or length(activity_title) between 1 and 120);

drop function public.submit_resolution_liquidation(bigint, text[], numeric);
drop function private.submit_resolution_liquidation(bigint, text[], numeric);

create function private.submit_resolution_liquidation(p_request_id bigint, p_files text[], p_spent numeric default null,
                                                     p_title text default null, p_items jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; f text; org text; it jsonb; n int := 0; v_spent numeric; v_title text := nullif(trim(p_title), '');
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

  if p_items is not null then
    -- Item lines: 1–30, each with a name, a quantity above 0 and a unit price of ₱0 or more.
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'List the items on the receipts.'; end if;
    if jsonb_array_length(p_items) > 30 then raise exception 'Up to 30 items per activity.'; end if;
    if v_title is null or length(v_title) > 120 then raise exception 'Type the activity name (e.g. Intramurals).'; end if;
    for it in select * from jsonb_array_elements(p_items) loop
      if coalesce(length(trim(it->>'particular')), 0) not between 1 and 120
         or coalesce((it->>'qty')::numeric, 0) <= 0 or coalesce((it->>'unit_price')::numeric, -1) < 0
         or length(coalesce(nullif(trim(it->>'unit'), ''), 'pc')) > 20 then
        raise exception 'Check the item “%”: it needs a name, a quantity and a unit price.', coalesce(it->>'particular', '');
      end if;
    end loop;
    select round(sum(round((x->>'qty')::numeric * (x->>'unit_price')::numeric, 2)), 2) into v_spent from jsonb_array_elements(p_items) x;
  else
    v_spent := round(p_spent, 2);
  end if;
  if v_spent is null or v_spent < 0 then raise exception 'Type the amount spent (₱0 or more).'; end if;
  if v_spent > r.amount then raise exception 'The amount spent (₱%) is more than what was released (₱%).', v_spent, r.amount; end if;

  -- A resend after SAS returned it replaces the earlier lines.
  delete from public.expense_items where request_id = r.id;
  if p_items is not null then
    for it in select * from jsonb_array_elements(p_items) loop
      n := n + 1;
      insert into public.expense_items (request_id, line_no, particular, unit, qty, unit_price)
      values (r.id, n, trim(it->>'particular'), coalesce(nullif(trim(it->>'unit'), ''), 'pc'), (it->>'qty')::numeric, (it->>'unit_price')::numeric);
    end loop;
  end if;
  update public.fund_requests
     set liquidation_status = 'submitted', liquidation_files = p_files, liquidation_spent = v_spent,
         activity_title = coalesce(v_title, activity_title), liquidation_submitted_at = now(), liquidation_remarks = null
   where id = r.id;
  select short_name into org from public.entities where id = r.entity_id;
  perform private.notify(private.admin_ids(), 'request', org || ' submitted a liquidation',
    coalesce(v_title, r.file_name, 'Resolution') || ' · spent ' || private.peso(v_spent) || ' of ' || private.peso(r.amount),
    '/approvals?request=' || r.id);
end $$;

create function public.submit_resolution_liquidation(p_request_id bigint, p_files text[], p_spent numeric default null,
                                                    p_title text default null, p_items jsonb default null)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.submit_resolution_liquidation(p_request_id, p_files, p_spent, p_title, p_items) $$;

revoke all on function private.submit_resolution_liquidation(bigint, text[], numeric, text, jsonb),
  public.submit_resolution_liquidation(bigint, text[], numeric, text, jsonb) from public, anon;
grant execute on function private.submit_resolution_liquidation(bigint, text[], numeric, text, jsonb),
  public.submit_resolution_liquidation(bigint, text[], numeric, text, jsonb) to authenticated;

-- Approval: the expense carries the activity name, so the Financial Report groups it under "SimuLIT" etc.
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
      coalesce(r.activity_title, r.file_name, 'Resolution') || ' · ' || left(trim(p_remarks), 80), '/requests?id=' || r.id);
    return;
  end if;
  perform private.lock_entity(r.entity_id);
  select cash, saved into c, s from private.pockets(r.entity_id);
  if r.liquidation_spent > c then
    raise exception 'The org/club''s cash on hand (₱%) is less than the amount spent. Check the ledger first.', c;
  end if;
  if r.liquidation_spent > 0 then
    insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id, attachment_path, category)
    values (r.entity_id, r.school_year_id, 'expense', r.liquidation_spent, left(coalesce(r.activity_title, r.description), 500),
            r.id, r.liquidation_files[1], 'other');
  end if;
  v_back := least(greatest(r.amount - r.liquidation_spent, 0), greatest(c - r.liquidation_spent, 0));
  if v_back > 0 then
    insert into public.ledger_entries (entity_id, school_year_id, kind, amount, description, request_id)
    values (r.entity_id, r.school_year_id, 'remittance', round(v_back, 2),
            left('Unspent from ' || coalesce(r.activity_title, r.file_name, 'resolution') || ' returned to SAS (liquidation)', 500), r.id);
  end if;
  update public.fund_requests
     set liquidation_status = 'approved', liquidated_at = now(), liquidated_by = (select auth.uid()),
         liquidation_remarks = nullif(trim(p_remarks), '')
   where id = r.id;
  perform private.notify(private.treasurer_ids(r.entity_id), 'request_decision', 'Liquidation approved',
    coalesce(r.activity_title, r.file_name, 'Resolution') || ' · spent ' || private.peso(r.liquidation_spent)
      || case when v_back > 0 then ' · ' || private.peso(v_back) || ' back to savings' else '' end,
    '/requests?id=' || r.id);
end $$;
