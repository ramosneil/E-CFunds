-- Phase 5 messaging (business-rules §4.8; Neil 2026-11-13: per-treasurer broadcast reads + instant updates).
-- messages.read_at already tracks org conversations (one reader on each side). Broadcasts go to every treasurer,
-- so who has seen which broadcast is kept here, one row per treasurer per broadcast.

create table public.broadcast_reads (
  message_id bigint not null references public.messages (id) on delete cascade,
  profile_id uuid   not null references public.profiles (id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index broadcast_reads_profile_id_idx on public.broadcast_reads (profile_id);
alter table public.broadcast_reads enable row level security;

revoke all on public.broadcast_reads from anon, authenticated;
grant select on public.broadcast_reads to authenticated;            -- writes only via mark_broadcasts_read()
create policy "treasurer reads own broadcast reads, admin reads all" on public.broadcast_reads
  for select to authenticated using ((select private.is_admin()) or profile_id = (select auth.uid()));

-- An approved treasurer marks every broadcast as read (idempotent). Returns how many were newly marked.
create or replace function private.mark_broadcasts_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if (select private.my_entity_id()) is null then
    raise exception 'Only treasurers have broadcasts to read.' using errcode = '42501';
  end if;
  insert into public.broadcast_reads (message_id, profile_id)
  select m.id, (select auth.uid()) from public.messages m
   where m.entity_id is null and m.sender_id <> (select auth.uid())
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.mark_broadcasts_read()
returns integer
language sql volatile security invoker set search_path = '' as $$
  select private.mark_broadcasts_read()
$$;

revoke all on function private.mark_broadcasts_read() from public, anon;
revoke all on function public.mark_broadcasts_read() from public, anon;
grant execute on function private.mark_broadcasts_read() to authenticated;
grant execute on function public.mark_broadcasts_read() to authenticated;

-- Audit like every other table.
create trigger audit_broadcast_reads after insert or update or delete on public.broadcast_reads
  for each row execute function private.audit_row();

-- Instant updates: Supabase Realtime delivers a new message only to users whose RLS lets them read it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  else
    raise notice 'supabase_realtime publication not present: skipping (local self-check)';
  end if;
end $$;
