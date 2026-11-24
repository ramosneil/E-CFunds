-- Neil, 2026-11-25: section boxes per course go up to E (1A…4E), and each person can clear items from their own
-- Home lists and Activity log (one by one or all). Clearing only hides an item for that person: the request, ledger
-- entry or audit row itself is never changed or deleted (ledger stays append-only, audit log stays complete).

-- 1. Sections A–E (was A–D). The two checking functions are patched in place (only the A–D test and its message),
--    so nothing else in them changes.
alter table public.students drop constraint students_section_check;
alter table public.students add constraint students_section_check check (section ~ '^[A-E]$');

do $$
declare f text; def text;
begin
  foreach f in array array['private.add_member', 'private.roster_row_errors'] loop
    select pg_get_functiondef(p.oid) into def from pg_proc p
      where p.oid = (select oid from pg_proc where proname = split_part(f, '.', 2)
                       and pronamespace = 'private'::regnamespace limit 1);
    if def is null or position('[A-D]' in def) = 0 then raise exception 'section check not found in %', f; end if;
    def := replace(def, '[A-D]', '[A-E]');
    def := replace(def, 'Section must be A, B, C or D', 'Section must be A to E');
    execute def;
  end loop;
end $$;

-- 2. What each person cleared from their own lists. item_id '*' = "everything up to cleared_at" (Clear all);
--    newer items still show. Rows are private to their owner.
create table public.cleared_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list text not null check (list in ('home_requests', 'home_activity', 'activity_log')),
  item_id text not null check (length(item_id) between 1 and 40),
  cleared_at timestamptz not null default now(),
  primary key (user_id, list, item_id)
);
alter table public.cleared_items enable row level security;
create policy "own cleared items" on public.cleared_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.cleared_items to authenticated;

-- 3. The Activity log as the signed-in person sees it: the audit log minus what they cleared. security_invoker, so
--    audit_log's own rule (SAS only) still applies.
create view public.audit_log_visible with (security_invoker = true) as
  select a.* from public.audit_log a
  where not exists (
    select 1 from public.cleared_items c
    where c.user_id = (select auth.uid()) and c.list = 'activity_log'
      and (c.item_id = a.id::text or (c.item_id = '*' and a.at <= c.cleared_at)));
grant select on public.audit_log_visible to authenticated;
