import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUp, Pencil, Plus } from 'lucide-react';
import { useEntities } from '../../lib/data';
import { supabase, errorText } from '../../lib/supabase';
import { peso } from '../../lib/format';
import type { Row } from '../../lib/database.types';
import { Alert, Button, Card, Chip, EntityLogo, Field, Input, PageHeader, Select, Sheet, Spinner } from '../../components/ui';

export function Orgs() {
  const entities = useEntities();
  const [edit, setEdit] = useState<Row<'entities'> | 'new' | null>(null);
  if (entities.isLoading) return <Spinner />;
  const groups: [string, Row<'entities'>[]][] = [
    ['Organizations', (entities.data ?? []).filter((e) => e.category === 'organization')],
    ['Clubs', (entities.data ?? []).filter((e) => e.category === 'club')],
  ];
  return (
    <>
      <PageHeader title="Orgs & clubs" sub="Names, logos and dues. Archived ones keep their history."
        action={<Button onClick={() => setEdit('new')}><Plus className="size-5" />Add</Button>} />
      {groups.map(([title, list]) => (
        <section key={title} className="mb-6">
          <h2 className="micro text-muted mb-3">{title} · {list.length}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((e) => (
              <Card key={e.id} className={`p-4 ${e.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <EntityLogo path={e.logo_path} name={e.name} size={52} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/orgs/${e.id}`} className="font-semibold block truncate hover:text-primary">{e.short_name}</Link>
                    <p className="text-[13px] text-muted truncate">{e.name}</p>
                  </div>
                  <button aria-label={`Edit ${e.short_name}`} onClick={() => setEdit(e)} className="size-10 grid place-items-center rounded-full hover:bg-surface2 text-muted cursor-pointer"><Pencil className="size-4" /></button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip tone="gold"><span className="money">{peso(e.dues_amount)}</span>&nbsp;/ {e.dues_period === 'semester' ? 'semester' : 'school year'}</Chip>
                  {e.is_school_wide && <Chip tone="primary">School-wide</Chip>}
                  {!e.is_active && <Chip>Archived</Chip>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
      {edit && <EntitySheet key={edit === 'new' ? 'new' : edit.id} entity={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function EntitySheet({ entity, onClose }: { entity: Row<'entities'> | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(entity?.name ?? '');
  const [short, setShort] = useState(entity?.short_name ?? '');
  const [category, setCategory] = useState<Row<'entities'>['category']>(entity?.category ?? 'organization');
  const [period, setPeriod] = useState<Row<'entities'>['dues_period']>(entity?.dues_period ?? 'school_year');
  const [amount, setAmount] = useState(String(entity?.dues_amount ?? '0'));
  const [active, setActive] = useState(entity?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) { setErr('Dues must be ₱0 or more.'); return; }
    if (file && file.size > 2 * 1024 * 1024) { setErr('Logo must be 2 MB or smaller.'); return; }
    setBusy(true); setErr('');
    try {
      let id = entity?.id;
      if (!entity) {
        const ins = await supabase.from('entities').insert({ name: name.trim(), short_name: short.trim(), category, dues_period: period, dues_amount: amt }).select().single();
        if (ins.error) throw ins.error;
        id = ins.data.id;
      } else {
        const up = await supabase.from('entities').update({ name: name.trim(), short_name: short.trim(), category, is_active: active }).eq('id', entity.id);
        if (up.error) throw up.error;
        if (period !== entity.dues_period || amt !== Number(entity.dues_amount)) {
          const d = await supabase.rpc('set_entity_dues', { p_entity_id: entity.id, p_period: period, p_amount: amt });
          if (d.error) throw d.error;
        }
      }
      if (file && id) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/svg+xml' ? 'svg' : 'jpg';
        const path = `${id}/logo-${Date.now()}.${ext}`;
        const upl = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: false });
        if (upl.error) throw upl.error;
        const lp = await supabase.from('entities').update({ logo_path: path }).eq('id', id);
        if (lp.error) throw lp.error;
      }
      void qc.invalidateQueries();
      onClose();
    } catch (x) { setErr(errorText(x)); } finally { setBusy(false); }
  }

  return (
    <Sheet open onClose={onClose} title={entity ? `Edit ${entity.short_name}` : 'Add org or club'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          {file ? <img src={URL.createObjectURL(file)} alt="" className="size-16 rounded-full object-contain bg-white border border-line" />
            : <EntityLogo path={entity?.logo_path ?? null} name={name || '?'} size={64} />}
          <label className="inline-flex items-center gap-2 h-11 px-4 rounded-[14px] border border-line font-semibold cursor-pointer hover:bg-surface2">
            <ImageUp className="size-5" />{entity?.logo_path || file ? 'Change logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <Field label="Full name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Short name"><Input required value={short} onChange={(e) => setShort(e.target.value)} /></Field>
          <Field label="Type">
            <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              <option value="organization">Organization</option><option value="club">Club</option>
            </Select>
          </Field>
          <Field label="Dues amount (₱)"><Input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className="money" /></Field>
          <Field label="Dues are paid">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
              <option value="school_year">Once a school year</option><option value="semester">Every semester</option>
            </Select>
          </Field>
        </div>
        {entity && (
          <label className="flex items-center gap-3 rounded-[14px] bg-surface2 p-4 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-[var(--primary)]" />
            <span><b>Active</b><span className="block text-[13px] text-muted">Turn off to archive. Its history and money records stay.</span></span>
          </label>
        )}
        {err && <Alert>{err}</Alert>}
        <Button type="submit" busy={busy} className="w-full h-[54px]">{entity ? 'Save changes' : 'Add'}</Button>
      </form>
    </Sheet>
  );
}
