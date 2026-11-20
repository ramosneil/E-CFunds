-- Only CLUBS add students (Neil, 2026-11-14). Organizations (SSG, PADC, LSC, YMO, JOES, JFMS) get their members
-- automatically from each student's course when a club adds the student; their treasurers see the list and
-- record/undo payments, but cannot add students. Students who don't join a club aren't tracked (Neil's choice).
-- Enforced in add_member and in the RLS insert rules (so it can't be bypassed with a direct API call).
-- Automatic course/SSG enrolment runs as SECURITY DEFINER and is unaffected.

create or replace function private.is_club_treasurer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entities e
                  where e.id = (select private.my_entity_id()) and e.category = 'club')
$$;
revoke all on function private.is_club_treasurer() from public, anon;
grant execute on function private.is_club_treasurer() to authenticated;

-- Direct inserts: SAS, or a club treasurer for their own club only.
drop policy "staff add unpaid memberships" on public.memberships;
create policy "admin or club treasurer adds unpaid memberships" on public.memberships
  for insert to authenticated with check (
    not is_paid and collection_entry_id is null
    and ((select private.is_admin())
         or (entity_id = (select private.my_entity_id()) and (select private.is_club_treasurer()))));

drop policy "staff add roster students" on public.students;
create policy "admin or club treasurer adds roster students" on public.students
  for insert to authenticated with check ((select private.is_admin()) or (select private.is_club_treasurer()));

-- add_member: refuse organization treasurers with a clear message (the rest of the function is unchanged).
create or replace function private.add_member_guard()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select private.my_entity_id()) is not null and not (select private.is_club_treasurer()) then
    raise exception 'Organizations get their members automatically from each student''s course. Only clubs add students.'
      using errcode = '42501';
  end if;
end $$;
revoke all on function private.add_member_guard() from public, anon;

do $$
declare src text;
begin
  select pg_get_functiondef('private.add_member(text,text,text,smallint)'::regprocedure) into src;
  if position('add_member_guard' in src) = 0 then
    src := replace(src,
      'if v_entity is null then raise exception ''Only a treasurer can add members.'' using errcode = ''42501''; end if;',
      'if v_entity is null then raise exception ''Only a treasurer can add members.'' using errcode = ''42501''; end if;
  perform private.add_member_guard();');
    if position('add_member_guard' in src) = 0 then raise exception 'add_member: guard not inserted'; end if;
    execute src;
  end if;
end $$;
