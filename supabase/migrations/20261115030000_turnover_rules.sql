-- Turnover (Neil, 2026-11-15): when SAS closes the school year for an org/club, the outgoing treasurer's account is
-- disabled automatically (they get a note in their bell first). The new officer signs up and SAS approves them.
-- Still required before closing: no pending requests, all cash remitted (₱0 on hand). A clear message if already closed.
-- (Migration 32 adds: every activity budget liquidated.)

create or replace function private.close_school_year(p_entity_id bigint, p_school_year_id bigint)
returns numeric language plpgsql security definer set search_path = '' as $$
declare c numeric; s numeric; t uuid[];
begin
  perform private.require_admin();
  perform private.lock_entity(p_entity_id);
  if exists (select 1 from public.year_closures where entity_id = p_entity_id and school_year_id = p_school_year_id) then
    raise exception 'This school year is already closed for this org/club.';
  end if;
  if exists (select 1 from public.fund_requests
             where entity_id = p_entity_id and status = 'pending') then
    raise exception 'Resolve all pending requests first.';
  end if;
  select cash, saved into c, s from private.pockets(p_entity_id);
  if c <> 0 then raise exception 'All cash must be remitted before turnover (₱% still on hand).', c; end if;
  insert into public.year_closures (entity_id, school_year_id, closed_by, closing_total)
  values (p_entity_id, p_school_year_id, (select auth.uid()), c + s);

  -- Hand over: tell the outgoing treasurer, then disable their account and forget their devices.
  select array_agg(id) into t from public.profiles where role = 'treasurer' and status = 'approved' and entity_id = p_entity_id;
  if t is not null then
    perform private.notify(t, 'account_decision', 'Your term as treasurer has ended',
      'SAS closed the school year. Thank you! The saved funds carry over to the next officers.', '/');
    update public.profiles set status = 'disabled', reviewed_by = (select auth.uid()), reviewed_at = now(),
           review_remarks = 'Term ended — school year closed'
     where id = any(t);
    delete from public.push_devices where profile_id = any(t);
  end if;
  return c + s;
end $$;
