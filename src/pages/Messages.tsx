import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Megaphone, MessagesSquare, SendHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useEntities } from '../lib/data';
import { supabase, errorText } from '../lib/supabase';
import { useBroadcastReads, useMessages, useSenderNames, useUnread, type Message } from '../lib/messages';
import { Alert, EntityLogo, Spinner } from '../components/ui';
import { AnnounceSheet } from '../components/AnnounceSheet';

const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const short = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });
function when(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? time.format(d) : short.format(d);
}

// Full-height chat area inside the app shell (phone: top bar 64 + bottom bar 76; desktop: top strip 56).
const FRAME = 'h-[calc(100dvh-176px)] lg:h-[calc(100dvh-104px)]';

/** Admin: conversation list + open conversation. Treasurer: their one conversation with SAS (+ broadcasts). */
export function Messages() {
  const { profile } = useAuth();
  if (profile?.role === 'treasurer') return <TreasurerMessages />;
  return <AdminMessages />;
}

function AdminMessages() {
  const { key } = useParams();
  const entities = useEntities();
  const msgs = useMessages();
  const unread = useUnread();
  const open = key === 'all' ? 'all' : key ? Number(key) : null;
  const [announcing, setAnnouncing] = useState(false);

  const rows = useMemo(() => {
    const last = new Map<number | 'all', Message>();
    for (const m of msgs.data ?? []) last.set(m.entity_id ?? 'all', m);
    return (entities.data ?? []).filter((e) => e.is_active).map((e) => ({ e, last: last.get(e.id) }))
      .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') || a.e.id - b.e.id)
      .map((r) => ({ ...r, unread: unread.byEntity.get(r.e.id) ?? 0 }));
  }, [entities.data, msgs.data, unread.byEntity]);
  const lastBroadcast = [...(msgs.data ?? [])].reverse().find((m) => m.entity_id === null);

  const list = (
    <nav aria-label="Conversations" className="flex flex-col min-h-0 h-full">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-[24px] font-extrabold">Messages</h1>
        <button type="button" onClick={() => setAnnouncing(true)} className="h-10 px-3 rounded-[12px] bg-primary-soft text-primary font-semibold text-[14px] inline-flex items-center gap-1.5 cursor-pointer hover:brightness-95">
          <Megaphone className="size-4" aria-hidden />Announcement
        </button>
      </div>
      <div className="overflow-y-auto min-h-0 flex-1 px-2 pb-2">
        <Link to="/messages/all" className={`flex items-center gap-3 p-3 rounded-[16px] ${open === 'all' ? 'bg-primary-soft' : 'hover:bg-surface2'}`}>
          <span className="size-11 rounded-full bg-gold-soft text-gold-text grid place-items-center shrink-0"><Megaphone className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold truncate">All treasurers</span>
            <span className="block text-[13px] text-muted truncate">{lastBroadcast ? lastBroadcast.body : 'Send one message to every treasurer'}</span>
          </span>
          {lastBroadcast && <span className="text-[12px] text-muted shrink-0">{when(lastBroadcast.created_at)}</span>}
        </Link>
        <p className="micro text-muted px-3 pt-4 pb-2">Orgs & clubs</p>
        {rows.map(({ e, last, unread: n }) => (
          <Link key={e.id} to={`/messages/${e.id}`} className={`flex items-center gap-3 p-3 rounded-[16px] ${open === e.id ? 'bg-primary-soft' : 'hover:bg-surface2'}`}>
            <EntityLogo path={e.logo_path} name={e.name} size={44} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${n ? 'font-bold' : 'font-semibold'}`}>{e.short_name}</span>
              <span className={`block text-[13px] truncate ${n ? 'text-ink' : 'text-muted'}`}>{last ? last.body : 'No messages yet'}</span>
            </span>
            <span className="flex flex-col items-end gap-1 shrink-0">
              {last && <span className="text-[12px] text-muted">{when(last.created_at)}</span>}
              {n > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold grid place-items-center" aria-label={`${n} unread`}>{n}</span>}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );

  const openEntity = typeof open === 'number' ? entities.data?.find((e) => e.id === open) : undefined;
  return (
    <div className={`${FRAME} bg-surface border border-line rounded-[20px] overflow-hidden lg:grid lg:grid-cols-[320px_1fr]`}>
      <div className={`${open === null ? 'flex' : 'hidden'} lg:flex flex-col min-h-0 h-full lg:border-r border-line`}>{list}</div>
      <section className={`${open === null ? 'hidden lg:flex' : 'flex'} flex-col min-h-0 h-full`}>
        {open === null ? (
          <div className="m-auto text-center text-muted px-6"><MessagesSquare className="size-10 mx-auto mb-2" />Pick a conversation.</div>
        ) : msgs.isLoading || entities.isLoading ? <Spinner /> : (
          <Thread key={String(open)} scope={open} title={open === 'all' ? 'All treasurers' : openEntity?.short_name ?? ''}
            subtitle={open === 'all' ? 'Broadcast — every treasurer sees this' : openEntity?.name}
            logo={openEntity ? <EntityLogo path={openEntity.logo_path} name={openEntity.name} size={40} /> : undefined} back />
        )}
      </section>
      {announcing && <AnnounceSheet onClose={() => setAnnouncing(false)} />}
    </div>
  );
}

function TreasurerMessages() {
  const { profile } = useAuth();
  const entities = useEntities();
  const org = entities.data?.find((e) => e.id === profile?.entity_id);
  if (!profile?.entity_id) return null;
  return (
    <div className={`${FRAME} bg-surface border border-line rounded-[20px] overflow-hidden flex flex-col`}>
      <Thread scope={profile.entity_id} title="SAS — Office of Student Affairs" subtitle={org ? `Conversation for ${org.short_name}` : undefined}
        logo={<span className="size-10 rounded-full bg-primary text-on-primary grid place-items-center font-display font-extrabold">₱</span>} includeBroadcasts />
    </div>
  );
}

function Thread({ scope, title, subtitle, logo, back, includeBroadcasts }: {
  scope: number | 'all'; title: string; subtitle?: string; logo?: React.ReactNode; back?: boolean; includeBroadcasts?: boolean;
}) {
  const { profile } = useAuth();
  const me = profile?.id;
  const admin = profile?.role === 'admin';
  const qc = useQueryClient();
  const nav = useNavigate();
  const msgs = useMessages();
  const names = useSenderNames(admin);
  const reads = useBroadcastReads(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const list = useMemo(() => (msgs.data ?? []).filter((m) =>
    scope === 'all' ? m.entity_id === null : m.entity_id === scope || (includeBroadcasts && m.entity_id === null)), [msgs.data, scope, includeBroadcasts]);

  // Mark as read when opened and whenever something new arrives from the other side.
  const unreadHere = list.some((m) => m.sender_id !== me && (m.entity_id === null
    ? includeBroadcasts && !(reads.data ?? []).some((r) => r.message_id === m.id)
    : !m.read_at));
  useEffect(() => {
    if (!unreadHere) return;
    (async () => {
      if (scope !== 'all') await supabase.rpc('mark_thread_read', { p_entity_id: scope });
      if (includeBroadcasts) await supabase.rpc('mark_broadcasts_read', {});
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: ['broadcast-reads'] });
    })();
  }, [unreadHere, scope, includeBroadcasts, qc]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [list.length]);

  async function send() {
    const text = body.trim();
    if (!text || !me) return;
    setBusy(true); setErr('');
    const { error } = await supabase.from('messages').insert({ body: text, sender_id: me, entity_id: scope === 'all' ? null : scope });
    setBusy(false);
    if (error) { setErr(errorText(error)); return; }
    setBody('');
    void qc.invalidateQueries({ queryKey: ['messages'] });
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }
  async function remove(m: Message) {
    if (!window.confirm(m.entity_id === null && admin ? 'Delete this broadcast for every treasurer?' : 'Delete this message?')) return;
    const { error } = await supabase.from('messages').delete().eq('id', m.id);
    if (error) setErr(errorText(error));
    void qc.invalidateQueries({ queryKey: ['messages'] });
  }
  async function removeThread() {
    if (scope === 'all' || !window.confirm(`Delete the whole ${title} conversation for both sides? This can't be undone.`)) return;
    const { error } = await supabase.from('messages').delete().eq('entity_id', scope);
    if (error) setErr(errorText(error));
    void qc.invalidateQueries({ queryKey: ['messages'] });
  }

  let lastDay = '';
  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
        {back && <button onClick={() => nav('/messages')} aria-label="Back to conversations" className="lg:hidden size-10 -ml-2 grid place-items-center rounded-full hover:bg-surface2 cursor-pointer"><ArrowLeft className="size-5" /></button>}
        {logo ?? <span className="size-10 rounded-full bg-gold-soft text-gold-text grid place-items-center"><Megaphone className="size-5" /></span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{title}</p>
          {subtitle && <p className="text-[13px] text-muted truncate">{subtitle}</p>}
        </div>
        {admin && scope !== 'all' && list.length > 0 && (
          <button onClick={removeThread} className="text-[13px] font-semibold text-bad px-3 h-9 rounded-full hover:bg-bad-soft cursor-pointer">Delete conversation</button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2" aria-live="polite">
        {!list.length && <p className="text-center text-muted text-[14px] mt-10">No messages yet. Say hello.</p>}
        {list.map((m) => {
          const mine = m.sender_id === me;
          const d = day.format(new Date(m.created_at));
          const sep = d !== lastDay ? (lastDay = d) : null;
          const readBy = admin && m.entity_id === null ? (reads.data ?? []).filter((r) => r.message_id === m.id).length : null;
          const who = mine ? 'You' : admin ? names.data?.names.get(m.sender_id) ?? 'Treasurer' : 'SAS';
          return (
            <div key={m.id}>
              {sep && <p className="text-center text-[12px] text-muted my-3">{sep}</p>}
              <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-[18px] px-4 py-2.5 ${mine ? 'bg-primary text-on-primary rounded-br-[6px]' : 'bg-surface2 rounded-bl-[6px]'}`}>
                  {m.entity_id === null && scope !== 'all' && <p className={`micro mb-1 ${mine ? 'opacity-80' : 'text-gold-text'}`}>To all treasurers</p>}
                  {!mine && <p className="text-[12px] font-semibold opacity-80 mb-0.5">{who}</p>}
                  <p className="whitespace-pre-wrap break-words text-[15px]">{m.body}</p>
                  <p className={`text-[11px] mt-1 flex items-center gap-2 ${mine ? 'opacity-75 justify-end' : 'text-muted'}`}>
                    {time.format(new Date(m.created_at))}
                    {mine && m.entity_id !== null && <span>· {m.read_at ? 'Seen' : 'Sent'}</span>}
                    {readBy !== null && <span>· Read by {readBy} of {names.data?.treasurers ?? '…'}</span>}
                    {(mine || (admin && m.entity_id === null)) && (
                      <button onClick={() => remove(m)} aria-label="Delete message" className="opacity-70 hover:opacity-100 cursor-pointer"><Trash2 className="size-3.5" /></button>
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      {err && <div className="px-4 pb-2"><Alert>{err}</Alert></div>}
      <div className="border-t border-line p-3 flex items-end gap-2">
        <label className="sr-only" htmlFor="composer">Message</label>
        <textarea id="composer" rows={1} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey}
          placeholder={scope === 'all' ? 'Message every treasurer…' : 'Write a message…'}
          className="flex-1 resize-none max-h-40 min-h-12 px-4 py-3 rounded-[16px] bg-surface2 border border-transparent focus:border-primary outline-none field-sizing-content" />
        <button onClick={() => void send()} disabled={busy || !body.trim()} aria-label="Send"
          className="size-12 shrink-0 rounded-full bg-primary text-on-primary grid place-items-center disabled:opacity-40 cursor-pointer hover:brightness-110">
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </>
  );
}
