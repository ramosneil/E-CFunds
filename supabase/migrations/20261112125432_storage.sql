-- Storage: receipts/budgets (private) and org/club logos (public read).
-- Paths: receipts/<entity_id>/<file>, logos/<entity_id>/<file>.
-- Skipped automatically on a plain Postgres without Supabase Storage (local self-check).

do $do$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present: skipping storage migration';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
         ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
  on conflict (id) do nothing;

  -- Receipts: SAS reads all; a treasurer reads/uploads only in their own org/club folder.
  -- No update/delete: receipts are evidence for approved ledger entries.
  execute $p$
    create policy "staff read receipts" on storage.objects for select to authenticated
    using (bucket_id = 'receipts' and (
      (select private.is_admin())
      or (storage.foldername(name))[1] = (select private.my_entity_id())::text))$p$;
  execute $p$
    create policy "staff upload receipts" on storage.objects for insert to authenticated
    with check (bucket_id = 'receipts' and (
      (select private.is_admin())
      or (storage.foldername(name))[1] = (select private.my_entity_id())::text))$p$;

  -- Logos: public bucket (anyone can view a logo URL); only SAS manages them.
  execute $p$
    create policy "admin uploads logos" on storage.objects for insert to authenticated
    with check (bucket_id = 'logos' and (select private.is_admin()))$p$;
  execute $p$
    create policy "admin updates logos" on storage.objects for update to authenticated
    using (bucket_id = 'logos' and (select private.is_admin()))
    with check (bucket_id = 'logos' and (select private.is_admin()))$p$;
  execute $p$
    create policy "admin deletes logos" on storage.objects for delete to authenticated
    using (bucket_id = 'logos' and (select private.is_admin()))$p$;
end
$do$;
