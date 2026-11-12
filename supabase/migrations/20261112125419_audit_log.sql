-- Audit trail (business-rules §5): every insert/update/delete on every table → who, when, before, after.

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  action     text not null check (action in ('insert', 'update', 'delete')),
  row_pk     text,
  before_row jsonb,
  after_row  jsonb,
  actor      uuid,
  at         timestamptz not null default now()
);
create index audit_log_table_at_idx on public.audit_log (table_name, at desc);
create index audit_log_actor_idx on public.audit_log (actor);

alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;
create policy "admin reads audit log" on public.audit_log
  for select to authenticated using ((select private.is_admin()));

create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare b jsonb; a jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then b := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then a := to_jsonb(new); end if;
  insert into public.audit_log (table_name, action, row_pk, before_row, after_row, actor)
  values (tg_table_name, lower(tg_op), coalesce(a ->> 'id', b ->> 'id', a ->> 'entity_id', b ->> 'entity_id'),
          b, a, (select auth.uid()));
  return null;
end $$;

-- The audit log itself is append-only.
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function private.ledger_append_only();

do $$
declare t text;
begin
  foreach t in array array['school_years', 'semesters', 'entities', 'students', 'profiles', 'memberships',
                           'ledger_entries', 'fund_requests', 'year_closures', 'messages',
                           'accredited_entries'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function private.audit_row()', t);
  end loop;
end $$;

-- Accredited list history keeps the FULL before/after record (old system logged only id + name).
create or replace function private.accredited_history_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.accredited_history (entry_id, action, before_row, after_row, changed_by)
  values (coalesce(new.id, old.id), lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          (select auth.uid()));
  return null;
end $$;

create trigger accredited_history after insert or update or delete on public.accredited_entries
  for each row execute function private.accredited_history_row();

revoke all on function private.audit_row(), private.accredited_history_row() from public, anon, authenticated;
