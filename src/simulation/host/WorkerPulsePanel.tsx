import { useEffect, useState } from 'react';
import type {
  SimulationConversationRead, SimulationMessengerRead, SimulationPresenceRead,
  SimulationPulseContact,
} from '../../engine/kernel/SimulationPublication';
import { BuddyItem } from '../../apps/pulse/components/BuddyItem';
import { PulseLoginSplash, type PulseLoginSession } from '../../apps/pulse/components/PulseLoginSplash';
import { findPulseAccount, loadPulseAccounts, loadPulseCredentials, savePulseCredentials } from '../../apps/pulse/persistence';
import { formatSimulationMinutes } from '../../apps/pulse/utils/timeFormat';
import { useWindowStore } from '../../store/useWindowStore';
import type { WorkerGameSession } from './WorkerGameSession';
import type { SimulationPulseNarrativeResult } from './SimulationHostProtocol';

/**
 * The real BuddyItem UI with canonical, player-known only Messenger rows.
 * No direct SocialEngine methods, chat map, or Zustand state cross this view.
 */
export function WorkerPulsePanel({
  session, revision, windowId,
}: {
  session: WorkerGameSession;
  revision: number;
  windowId: string;
}) {
  const [account, setAccount] = useState<PulseLoginSession | null>(() => {
    const saved = loadPulseCredentials();
    if (!saved?.autoSign || !saved.password) return null;
    const existing = findPulseAccount(loadPulseAccounts(), saved.id);
    return existing?.password === saved.password
      ? { username: existing.id, status: 'online', awayMessage: 'back online :)', signedInAt: Date.now() }
      : null;
  });
  const updateWindowCustomState = useWindowStore(s => s.updateWindowCustomState);
  // Signed-in Pulse remains resident when its window is closed. This is
  // UI-only session state, not an alternative Social or simulation owner.
  useEffect(() => {
    updateWindowCustomState(windowId, { pulseSignedIn: account !== null });
  }, [account, windowId, updateWindowCustomState]);
  const [messenger, setMessenger] = useState<SimulationMessengerRead | null>(null);
  const [presence, setPresence] = useState<SimulationPresenceRead | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [page, setPage] = useState<SimulationConversationRead | null>(null);
  const [choices, setChoices] = useState<SimulationPulseNarrativeResult['choices']>([]);
  const [conversationPhase, setConversationPhase] = useState<SimulationPulseNarrativeResult['phase']>('first');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!account) {
      setMessenger(null);
      setPresence(null);
      setSelected(null);
      return () => { active = false; };
    }
    void Promise.all([
      session.read({ kind: 'messenger', maxContacts: 32 }),
      session.read({ kind: 'presence' }),
    ]).then(([next, nextPresence]) => {
      // The revision prop belongs to an independently refreshed HUD read.
      // This effect's cleanup, not exact numeric equality across separate
      // Worker queries, prevents stale requests from updating this view.
      if (!active) return;
      setMessenger(next);
      setPresence(nextPresence);
      setSelected(current =>
        current && next.contacts.some(row => row.actorId === current)
          ? current : (next.contacts[0]?.actorId ?? null));
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, revision, account]);

  useEffect(() => {
    let active = true;
    setPage(null);
    if (!selected) return () => { active = false; };
    void session.read({
      kind: 'conversation', actorId: selected, offset: pageOffset, limit: 30,
    }).then(result => {
      if (active) setPage(result);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, selected, pageOffset, revision]);

  useEffect(() => {
    let active = true;
    setChoices([]);
    setConversationPhase('first');
    if (!account || !selected) return () => { active = false; };
    void session.pulseNarrative({ kind: 'choices', actorId: selected })
      .then(result => {
        if (active && result.actorId === selected) {
          setChoices(result.choices);
          setConversationPhase(result.phase);
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, [session, selected, revision, account]);

  const select = (id: string) => {
    if (selected === id) return;
    setSelected(id);
    setPageOffset(0);
    setChoices([]);
    setConversationPhase('first');
    setError(null);
  };

  const choose = async (index: number) => {
    if (!selected || !choices[index] || sending) return;
    const chosen = choices[index]!;
    setSending(true);
    setError(null);
    try {
      const result = await session.pulseNarrative({
        kind: 'choose', actorId: selected, choiceIndex: index,
        expectedText: chosen.text,
      });
      if (result.actorId === selected) {
        setChoices(result.choices);
        setConversationPhase(result.phase);
        setPageOffset(0);
      }
      // A real Social revision refreshes the canonical transcript.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setChoices([]);
    } finally {
      setSending(false);
    }
  };

  const activeContact = messenger?.contacts.find(item => item.actorId === selected);
  if (!account) {
    return <section className="flex h-full min-h-80 flex-col bg-[#ece7f5]"
      data-testid="worker-pulse-panel" data-pulse-phase="sign-in">
      <PulseLoginSplash onLogin={setAccount} />
    </section>;
  }
  return (
    <section className="flex h-full min-h-72 flex-col overflow-hidden border border-[#735396] bg-[#f0eaf8] text-[#2f194c] shadow-inner"
      data-testid="worker-pulse-panel" data-pulse-phase="signed-in">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#4c2669] bg-gradient-to-b from-[#7743b4] to-[#3b1a5e] px-3 py-2 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 bg-[#ffd443] text-xl font-bold text-[#49226f]">P</span>
          <div><h2 className="font-bold tracking-wide">Pulse Messenger</h2>
            <p className="text-[11px] text-[#eee0ff]">{account.username} · {account.status} · {messenger?.contacts.length ?? 0} contacts</p></div>
        </div>
        <button type="button" className="rounded border border-white/60 bg-white/15 px-2 py-1 text-xs hover:bg-white/25"
          onClick={() => { savePulseCredentials(null); setAccount(null); setSelected(null); setChoices([]); }}>
          Sign out
        </button>
      </div>
      <div className="grid min-h-48 flex-1 grid-cols-1 gap-2 p-2 md:grid-cols-[170px_minmax(0,1fr)]">
        <div className="max-h-96 overflow-auto rounded border border-[#ad9bc7] bg-[#fff9f0] p-2"
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
        <div className="flex min-h-48 min-w-0 flex-col rounded border border-[#ad9bc7] bg-white p-2">
          <h3 className="mb-2 border-b border-[#ded0ee] pb-2 text-sm font-semibold">
            {activeContact ? activeContact.displayName + ' @' + activeContact.handle : 'Select a contact'}
          </h3>
          <div className="max-h-64 min-h-28 flex-1 overflow-auto text-sm"
            data-testid="worker-pulse-messages">
            {(page?.messages ?? []).map(message => (
              <p key={message.id} className={message.senderId === 'player'
                ? 'mb-1 rounded border-l-2 border-[#8350b5] bg-[#f1eafb] px-2 py-1'
                : 'mb-1 rounded border-l-2 border-[#e3bb47] bg-[#fff8e3] px-2 py-1'}>
                <span className="mr-2 text-xs text-[#79698a]">
                  {formatSimulationMinutes(message.timestampMinute)}
                </span>
                <strong>{message.senderId === 'player' ? 'You' : activeContact?.displayName}: </strong>
                {message.text}
              </p>
            ))}
            {page && page.messages.length === 0 && (
              <p className="text-xs text-[#776886]">No messages yet. Pick a message below to start talking.</p>
            )}
          </div>
          {page?.hasOlder && (
            <button className="my-2 self-start rounded border border-[#9f80c1] px-2 text-xs"
              onClick={() => setPageOffset(current => current + 30)}>
              Older messages
            </button>
          )}
          {selected && (
            <div className="mt-2 border-t border-[#ded0ee] pt-2"
              data-testid="worker-pulse-choices">
              <p className="mb-2 text-xs font-semibold text-[#6a4788]">
                Choose your message
              </p>
              {choices.map((choice, index) => (
                <button key={choice.id} type="button" disabled={sending}
                  onClick={() => { void choose(index); }}
                  className="mb-1 block w-full rounded border border-[#ac8fca] bg-gradient-to-b from-[#faf4ff] to-[#ece0f6] px-3 py-2 text-left text-sm text-[#342047] hover:from-white hover:to-[#dfccee] disabled:opacity-50">
                  {choice.text}
                </button>
              ))}
              {choices.length === 0 && !error && (
                <p className="text-xs text-[#776886]" data-testid="worker-pulse-conversation-state">
                  {conversationPhase === 'waiting_first' || conversationPhase === 'waiting_second'
                    ? 'Message sent. They will answer when they can get online.'
                    : conversationPhase === 'complete'
                      ? 'You have caught up for today. Check back tomorrow.'
                      : 'Checking available messages...'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {error && <p role="alert" className="m-2 border border-red-300 bg-red-50 p-2 text-xs text-red-800">{error}</p>}
    </section>
  );
}
