-- Account management (Neil, 2026-11-15): SAS can disable AND re-enable accounts from Approvals → Accounts.
-- Disabling also forgets the person's phones/browsers, so a disabled account gets no more push notifications.

create or replace function private.disable_account(p_profile_id uuid, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_profile_id = (select auth.uid()) then raise exception 'You cannot disable your own account.'; end if;
  update public.profiles set status = 'disabled', reviewed_by = (select auth.uid()), reviewed_at = now(),
         review_remarks = p_remarks
   where id = p_profile_id;
  delete from public.push_devices where profile_id = p_profile_id;
end $$;

create or replace function private.enable_account(p_profile_id uuid, p_remarks text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  perform private.require_admin();
  select * into p from public.profiles where id = p_profile_id;
  if p.id is null then raise exception 'Account not found.'; end if;
  if p.status <> 'disabled' then raise exception 'Only a disabled account can be enabled again.'; end if;
  -- One treasurer per org/club: refuse if someone else already holds that seat.
  if p.role = 'treasurer' and exists (select 1 from public.profiles x where x.role = 'treasurer' and x.status = 'approved'
       and x.entity_id = p.entity_id and x.id <> p.id) then
    raise exception 'This org/club already has an active treasurer. Disable that account first.';
  end if;
  update public.profiles set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(),
         review_remarks = coalesce(p_remarks, review_remarks)
   where id = p_profile_id;
end $$;

create or replace function public.enable_account(p_profile_id uuid, p_remarks text default null)
returns void language sql volatile security invoker set search_path = '' as $$ select private.enable_account(p_profile_id, p_remarks) $$;

revoke all on function private.enable_account(uuid, text), public.enable_account(uuid, text) from public, anon;
grant execute on function private.enable_account(uuid, text), public.enable_account(uuid, text) to authenticated;
