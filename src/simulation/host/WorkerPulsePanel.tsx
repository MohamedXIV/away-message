import { useEffect, useState } from 'react';
import type {
  SimulationConversationRead, SimulationMessengerRead, SimulationPresenceRead,
  SimulationPulseContact,
} from '../../engine/kernel/SimulationPublication';
import { BuddyItem } from '../../apps/pulse/components/BuddyItem';
import { formatSimulationMinutes } from '../../apps/pulse/utils/timeFormat';
import type { WorkerGameSession } from './WorkerGameSession';

/**
 * The real BuddyItem UI with canonical, player-known only Messenger rows.
 * No direct SocialEngine methods, chat map, or Zustand state cross this view.
 */
export function WorkerPulsePanel({
  session, revision,
}: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [messenger, setMessenger] = useState<SimulationMessengerRead | null>(null);
  const [presence, setPresence] = useState<SimulationPresenceRead | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [page, setPage] = useState<SimulationConversationRead | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      session.read({ kind: 'messenger', maxContacts: 32 }),
      session.read({ kind: 'presence' }),
    ]).then(([next, nextPresence]) => {
      if (!active || next.revision !== revision || nextPresence.revision !== revision) return;
      setMessenger(next);
      setPresence(nextPresence);
      setSelected(current =>
        current && next.contacts.some(row => row.actorId === current)
          ? current : (next.contacts[0]?.actorId ?? null));
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, revision]);

  useEffect(() => {
    let active = true;
    setPage(null);
    if (!selected) return () => { active = false; };
    void session.read({
      kind: 'conversation', actorId: selected, offset: pageOffset, limit: 30,
    }).then(result => {
      if (active && result.revision === revision) setPage(result);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, selected, pageOffset, revision]);

  const select = (id: string) => {
    if (selected === id) return;
    setSelected(id);
    setPageOffset(0);
    setText('');
    setError(null);
  };

  const send = async () => {
    if (!selected || !text.trim()) return;
    const message = text.trim().slice(0, 1000);
    setError(null);
    try {
      const result = await session.dispatch({
        type: 'SOCIAL_SEND_MESSAGE', buddyId: selected, text: message,
      });
      if (!result.success) throw new Error(result.error || 'Message rejected');
      setText('');
      setPageOffset(0);
      // A real Social revision invalidates the bounded page and messenger
      // read through the session subscription; no duplicate UI transcript.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const activeContact = messenger?.contacts.find(item => item.actorId === selected);
  return (
    <section className="rounded border border-slate-700 bg-slate-900 p-3 text-slate-100"
      data-testid="worker-pulse-panel">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Pulse · known contacts</h2>
        <span className="text-xs text-slate-400">
          {messenger?.contacts.length ?? 0} player-known
        </span>
      </div>
      <div className="grid min-h-48 grid-cols-1 gap-3 md:grid-cols-[200px_1fr]">
        <div className="max-h-72 overflow-auto rounded bg-[#ece9d8] p-2"
          data-testid="worker-pulse-contacts">
          {(messenger?.contacts ?? []).map(item => {
            const buddy: SimulationPulseContact = {
              id: item.actorId, displayName: item.displayName, handle: item.handle,
            };
            return (
              <BuddyItem key={item.actorId} buddy={buddy}
                presence={presence?.presence[item.actorId] ?? {
                  status: item.onlineStatus, awayMessage: '',
                }}
                unreadCount={item.unread}
                onInspect={select} onOpenChat={select} />
            );
          })}
          {messenger?.contacts.length === 0 && (
            <p className="text-xs text-slate-500">No learned contacts yet.</p>
          )}
        </div>
        <div className="flex min-h-48 flex-col rounded border border-slate-700 p-2">
          <h3 className="mb-2 text-sm font-semibold">
            {activeContact ? activeContact.displayName + ' @' + activeContact.handle : 'Select a contact'}
          </h3>
          <div className="max-h-48 min-h-28 flex-1 overflow-auto text-sm"
            data-testid="worker-pulse-messages">
            {(page?.messages ?? []).map(message => (
              <p key={message.id} className="mb-1 rounded bg-slate-800 px-2 py-1">
                <span className="mr-2 text-xs text-slate-400">
                  {formatSimulationMinutes(message.timestampMinute)}
                </span>
                <strong>{message.senderId === 'player' ? 'You' : activeContact?.displayName}: </strong>
                {message.text}
              </p>
            ))}
            {page && page.messages.length === 0 && (
              <p className="text-xs text-slate-400">No messages in this page.</p>
            )}
          </div>
          {page?.hasOlder && (
            <button className="my-2 self-start rounded border border-slate-600 px-2 text-xs"
              onClick={() => setPageOffset(current => current + 30)}>
              Older messages
            </button>
          )}
          {selected && (
            <form className="mt-2 flex gap-2" onSubmit={event => {
              event.preventDefault(); void send();
            }}>
              <input aria-label="Pulse message" value={text}
                onChange={event => setText(event.target.value)} maxLength={1000}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm" />
              <button type="submit" disabled={!text.trim()}
                className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-40">Send</button>
            </form>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
