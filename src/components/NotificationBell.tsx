import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Banknote, Bell, CalendarRange, CheckCheck, FileText, Megaphone, MessageSquare, Receipt, RefreshCw, Tag, UserPlus, Users, Volume2, VolumeX, Wallet, X } from 'lucide-react';
import { ago, display, markAllRead, markRead, useNotifications, type Note } from '../lib/notifications';
import { isMuted, setMuted, chime } from '../lib/chime';

const ICON = {
  request: FileText, request_decision: CheckCheck, payment: Banknote, account: UserPlus, message: MessageSquare,
  receipt: Receipt, fees: Wallet, account_decision: BadgeCheck, announcement: Megaphone, members: Users,
  semester: CalendarRange, fee_change: Tag, app_update: RefreshCw,
};

/** Bell with unread count; opens the list (dropdown on desktop, sheet on phones). */
export function NotificationBell({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const notes = useNotifications(uid);
  const unread = (notes.data ?? []).filter((n) => !n.read_at).length;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}
        className="relative size-11 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface2 cursor-pointer">
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[11px] font-bold grid place-items-center leading-none">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && <Panel notes={notes.data ?? []} uid={uid} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Panel({ notes, uid, onClose }: { notes: Note[]; uid: string; onClose: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [muted, setM] = useState(isMuted);
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications', uid] });
  const open = async (n: Note) => {
    onClose();
    if (!n.read_at) { await markRead(n.id); void refresh(); }
    if (n.link) nav(n.link);
  };
  return (
    <div role="dialog" aria-label="Notifications"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+68px)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 z-50 sm:w-[400px] max-h-[min(70vh,560px)] flex flex-col bg-surface border border-line rounded-[20px] shadow-2xl overflow-hidden">
      <div className="flex items-center gap-1 px-4 h-14 border-b border-line">
        <p className="font-display font-extrabold text-[17px] flex-1">Notifications</p>
        <button type="button" onClick={() => { setMuted(!muted); setM(!muted); if (muted) chime(); }}
          aria-label={muted ? 'Turn sound on' : 'Mute sound'} title={muted ? 'Sound off' : 'Sound on'}
          className="size-9 grid place-items-center rounded-full text-muted hover:text-ink hover:bg-surface2 cursor-pointer">
          {muted ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
        </button>
        <button type="button" onClick={async () => { await markAllRead(); void refresh(); }} disabled={!notes.some((n) => !n.read_at)}
          className="h-9 px-3 rounded-[10px] text-[13px] font-semibold text-primary hover:bg-primary-soft disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer">Mark all read</button>
        <button type="button" onClick={onClose} aria-label="Close" className="sm:hidden size-9 grid place-items-center rounded-full text-muted hover:bg-surface2"><X className="size-[18px]" /></button>
      </div>
      {notes.length === 0 ? (
        <div className="p-8 text-center text-muted text-[14px]"><Bell className="size-7 mx-auto mb-2 opacity-60" aria-hidden />You're all caught up.</div>
      ) : (
        <ul className="overflow-y-auto divide-y divide-line">
          {notes.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            const d = display(n);
            return (
              <li key={n.id}>
                <button type="button" onClick={() => void open(n)} className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-surface2 cursor-pointer ${n.read_at ? '' : 'bg-primary-soft/40'}`}>
                  <span className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0"><Icon className="size-[18px]" aria-hidden /></span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[14px] leading-snug ${n.read_at ? '' : 'font-semibold'}`}>{d.title}</span>
                    {d.body && <span className="block text-[13px] text-muted truncate">{d.body}</span>}
                    <span className="block text-[12px] text-muted mt-0.5">{ago(n.updated_at)}</span>
                  </span>
                  {!n.read_at && <span className="size-2.5 rounded-full bg-primary mt-1.5 shrink-0" aria-label="Unread" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
