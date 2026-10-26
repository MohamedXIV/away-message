import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  SimulationConversationRead,
  SimulationMessengerRead,
  SimulationPresenceRead,
} from '../../engine/kernel/SimulationPublication';
import { PulseBuddyList, PulseContactRail, buildPulseContactViews, partitionPulseContacts } from '../../apps/pulse/components/PulseBuddyList';
import { PulseChatPane } from '../../apps/pulse/components/PulseChatPane';
import { PULSE_STATUS_LABEL } from '../../apps/pulse/components/PulseAvatar';
import { PulseLoginSplash, type PulseLoginSession } from '../../apps/pulse/components/PulseLoginSplash';
import { findPulseAccount, loadPulseAccounts, loadPulseCredentials, savePulseCredentials } from '../../apps/pulse/persistence';
import { restorePulseUiSession, shouldAcknowledgePulseConversation } from '../../apps/pulse/utils/workerPulseUi';
import { useWindowStore } from '../../store/useWindowStore';
import type { WorkerGameSession } from './WorkerGameSession';
import type { SimulationPulseNarrativeResult } from './SimulationHostProtocol';

const SPLIT_LAYOUT_MIN_WIDTH = 560;

function storedSnapshot(windowId: string) {
  return (useWindowStore.getState().windows[windowId]?.customState ?? {}) as Record<string, unknown>;
}

/**
 * The real Worker-playable Messenger. Every contact, transcript, presence row
 * and authored reply comes from bounded canonical reads/commands. This view
 * owns presentation and UI-session state only; it cannot send arbitrary social
 * text, invent replies or keep a second conversation store.
 */
export function WorkerPulsePanel({
  session, revision, windowId, slotId,
}: {
  session: WorkerGameSession;
  revision: number;
  windowId: string;
  /** The save slot that currently owns canonical state and Pulse identities. */
  slotId: string;
}) {
  const remembered = storedSnapshot(windowId);
  const [bootstrap] = useState<{ account: PulseLoginSession | null; selected: string | null }>(() => {
    const saved = loadPulseCredentials(slotId);
    const accounts = loadPulseAccounts(slotId);
    if (saved?.autoSign && saved.password) {
      const existing = findPulseAccount(accounts, saved.id);
      if (existing?.password === saved.password) {
        return {
          account: { username: existing.id, status: 'online', awayMessage: 'back online :)', signedInAt: Date.now() },
          selected: remembered.pulseSessionSlotId === slotId
            && typeof remembered.pulseSelectedActorId === 'string'
            ? remembered.pulseSelectedActorId : null,
        };
      }
    }
    const restored = restorePulseUiSession({
      storedSession: remembered.pulseSession,
      storedSlotId: remembered.pulseSessionSlotId,
      storedSelectedActorId: remembered.pulseSelectedActorId,
      slotId,
      accounts,
    });
    return restored
      ? { account: restored.session, selected: restored.selectedActorId }
      : { account: null, selected: null };
  });
  const [account, setAccount] = useState<PulseLoginSession | null>(bootstrap.account);
  const [accountSlotId, setAccountSlotId] = useState<string | null>(
    bootstrap.account ? slotId : null,
  );
  const [selected, setSelected] = useState<string | null>(bootstrap.selected);
  const [messenger, setMessenger] = useState<SimulationMessengerRead | null>(null);
  const [presence, setPresence] = useState<SimulationPresenceRead | null>(null);
  const [page, setPage] = useState<SimulationConversationRead | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [choices, setChoices] = useState<SimulationPulseNarrativeResult['choices']>([]);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<SimulationPulseNarrativeResult['phase']>('first');
  const [sending, setSending] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ actorId: string; name: string; count: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState<boolean>(() => {
    const width = useWindowStore.getState().windows[windowId]?.size.width;
    return typeof width !== 'number' || width < SPLIT_LAYOUT_MIN_WIDTH;
  });
  const panelRef = useRef<HTMLElement>(null);
  const unreadBaseline = useRef<Record<string, number> | null>(null);
  const acknowledgedMessages = useRef(new Set<string>());
  const updateWindowCustomState = useWindowStore(s => s.updateWindowCustomState);
  const windowActive = useWindowStore(s => s.activeWindowId === windowId);
  const windowVisible = useWindowStore(s => {
    const win = s.windows[windowId];
    return Boolean(win?.isOpen) && !win?.isMinimized;
  });
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  // A stale UI session must never authenticate against a different slot.
  const currentAccount = account && accountSlotId === slotId ? account : null;

  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const element = panelRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      setCompact(width < SPLIT_LAYOUT_MIN_WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    updateWindowCustomState(windowId, {
      pulseSignedIn: currentAccount !== null,
      pulseSession: currentAccount,
      pulseSessionSlotId: currentAccount ? accountSlotId : null,
      pulseSelectedActorId: currentAccount ? selected : null,
    });
  }, [currentAccount, accountSlotId, selected, windowId, updateWindowCustomState]);

  useEffect(() => {
    if (!account || !accountSlotId || accountSlotId === slotId) return;
    // Save As / slot switch invalidates the UI-only session immediately. The
    // player must authenticate against the new slot's own account store.
    setAccount(null);
    setAccountSlotId(null);
    setSelected(null);
    setMessenger(null);
    setPresence(null);
    setPage(null);
    setPageOffset(0);
    setChoices([]);
    setConversationPhase('first');
    setPendingChoiceIndex(null);
    setNotice(null);
    setDrawerOpen(false);
    setError(null);
    unreadBaseline.current = null;
    acknowledgedMessages.current.clear();
  }, [account, accountSlotId, slotId]);

  useEffect(() => {
    let active = true;
    if (!currentAccount) {
      setMessenger(null);
      setPresence(null);
      setSelected(null);
      setPage(null);
      setChoices([]);
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
      setError(null);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, revision, currentAccount]);

  useEffect(() => {
    let active = true;
    if (!currentAccount || !selected) {
      setPage(null);
      setPageLoading(false);
      return () => { active = false; };
    }
    setPageLoading(true);
    void session.read({
      kind: 'conversation', actorId: selected, offset: pageOffset, limit: 30,
    }).then(result => {
      if (!active) return;
      setPage(result);
      setPageLoading(false);
    }).catch(cause => {
      if (active) {
        setPageLoading(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
    return () => { active = false; };
  }, [session, selected, pageOffset, revision, currentAccount]);

  useEffect(() => {
    let active = true;
    setChoices([]);
    setConversationPhase('first');
    setChoicesLoading(Boolean(currentAccount && selected));
    if (!currentAccount || !selected) {
      setChoicesLoading(false);
      return () => { active = false; };
    }
    void session.pulseNarrative({ kind: 'choices', actorId: selected })
      .then(result => {
        if (active && result.actorId === selected) {
          setChoices(result.choices);
          setConversationPhase(result.phase);
          setError(null);
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (active) setChoicesLoading(false); });
    return () => { active = false; };
  }, [session, selected, revision, currentAccount]);

  useEffect(() => {
    if (!messenger) return;
    const next: Record<string, number> = {};
    for (const contact of messenger.contacts) next[contact.actorId] = contact.unread;
    const previous = unreadBaseline.current;
    unreadBaseline.current = next;
    if (!previous) return;
    let candidate: { actorId: string; name: string; count: number } | null = null;
    for (const contact of messenger.contacts) {
      if (contact.actorId === selected) continue;
      const before = previous[contact.actorId] ?? 0;
      if (contact.unread > before) {
        candidate = { actorId: contact.actorId, name: contact.displayName, count: contact.unread };
      }
    }
    if (candidate) setNotice(candidate);
  }, [messenger, selected]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!currentAccount || !selected || !page) return;
    const latest = page.messages.at(-1);
    if (!latest) return;
    const key = `${selected}:${latest.id}`;
    const allowed = shouldAcknowledgePulseConversation({
      signedIn: true,
      selectedActorId: selected,
      pageOffset,
      latestMessageId: latest.id,
      alreadyAcknowledged: acknowledgedMessages.current.has(key),
      windowActive,
      windowVisible,
      documentVisible,
      conversationObscured: compact && drawerOpen,
    });
    if (!allowed) return;
    acknowledgedMessages.current.add(key);
    void session.markConversationRead(selected).catch(() => {
      acknowledgedMessages.current.delete(key);
    });
  }, [session, currentAccount, selected, page, pageOffset, windowActive, windowVisible,
    documentVisible, compact, drawerOpen]);

  const contacts = useMemo(
    () => messenger ? buildPulseContactViews(messenger.contacts, presence?.presence ?? {}) : [],
    [messenger, presence],
  );
  const activeContact = contacts.find(contact => contact.actorId === selected) ?? null;
  const totals = partitionPulseContacts(contacts);
  const totalUnread = contacts.reduce((sum, contact) => sum + contact.unread, 0);

  const selectContact = (actorId: string) => {
    setDrawerOpen(false);
    setNotice(current => current?.actorId === actorId ? null : current);
    if (selected === actorId) return;
    setSelected(actorId);
    setPageOffset(0);
    setPage(null);
    setChoices([]);
    setConversationPhase('first');
    setPendingChoiceIndex(null);
    setError(null);
  };

  const signOut = () => {
    savePulseCredentials(null);
    setDrawerOpen(false);
    setNotice(null);
    setAccount(null);
    setAccountSlotId(null);
    setSelected(null);
    setMessenger(null);
    setPresence(null);
    setPage(null);
    setPageOffset(0);
    setChoices([]);
    setConversationPhase('first');
    setPendingChoiceIndex(null);
    setError(null);
    unreadBaseline.current = null;
    acknowledgedMessages.current.clear();
  };

  const choose = async (index: number) => {
    if (!currentAccount || !selected || !choices[index] || sending) return;
    const chosen = choices[index]!;
    setSending(true);
    setPendingChoiceIndex(index);
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
      // The offered set may have gone stale while another turn landed. Ask the
      // Worker again rather than keeping dead buttons on screen.
      try {
        const refreshed = await session.pulseNarrative({ kind: 'choices', actorId: selected });
        if (refreshed.actorId === selected) {
          setChoices(refreshed.choices);
          setConversationPhase(refreshed.phase);
        }
      } catch { /* the visible error already explains the failed send */ }
    } finally {
      setSending(false);
      setPendingChoiceIndex(null);
    }
  };

  if (!currentAccount) {
    return (
      <section ref={panelRef} className="flex h-full min-h-0 flex-col bg-[#efeaf6]"
        data-testid="worker-pulse-panel" data-pulse-phase="sign-in" data-pulse-layout="sign-in">
        <PulseLoginSplash onLogin={(next) => {
          setError(null);
          setAccount(next);
          setAccountSlotId(slotId);
        }} />
      </section>
    );
  }

  return (
    <section ref={panelRef}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f0eaf8] font-sans text-[#2f194c]"
      data-testid="worker-pulse-panel"
      data-pulse-phase="signed-in"
      data-pulse-layout={compact ? 'compact' : 'split'}>
      <header className="shrink-0 border-b border-[#2d1447] bg-gradient-to-b from-[#7743b4] to-[#3b1a5e] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/75 bg-[#ffd443] text-base font-black text-[#49226f] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            P
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold tracking-wide">Pulse Messenger</h2>
            <p className="truncate text-[11px] text-[#eee0ff]">
              {currentAccount.username} · {PULSE_STATUS_LABEL[currentAccount.status]} · {totals.online.length} of {contacts.length} online
            </p>
          </div>
          {compact && (
            <button type="button" onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              className="relative border border-white/60 bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25">
              Buddies
              {totalUnread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-[14px] rounded-full border border-white bg-[#d84a32] px-1 text-center text-[10px] leading-3 text-white">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </button>
          )}
          <button type="button"
            className="border border-white/60 bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25"
            onClick={signOut}>
            Sign out
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-white/15 px-2 py-0.5 text-[10px] text-[#e5d5fb]">
          <span className="min-w-0 truncate">Signed in as {currentAccount.username} · {currentAccount.awayMessage}</span>
          <span className="shrink-0">Pulse 5.2 · 2005</span>
        </div>
      </header>

      {notice && (
        <div role="status" aria-live="polite"
          className="flex shrink-0 items-center gap-2 border-b border-[#c8a74a] bg-[#fff5bf] px-2 py-1 text-[11px] text-[#4e3a00]">
          <span aria-hidden="true">✉</span>
          <span className="min-w-0 flex-1 truncate">
            New message{notice.count > 1 ? `s (${notice.count})` : ''} from <strong>{notice.name}</strong>
          </span>
          <button type="button" onClick={() => selectContact(notice.actorId)}
            className="border border-[#8b6b2d] bg-white px-1.5 py-0.5 font-bold hover:bg-[#fffbe6]">
            Open
          </button>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}
            className="px-1 font-bold text-[#7a5c16] hover:text-black">✕</button>
        </div>
      )}

      {compact ? (
        <>
          <PulseContactRail contacts={contacts} selectedId={selected}
            onSelect={selectContact} onOpenList={() => setDrawerOpen(true)} />
          <div className="flex min-h-0 flex-1 flex-col">
            <PulseChatPane contact={activeContact} accountName={currentAccount.username}
              page={page} pageOffset={pageOffset} loading={pageLoading}
              choices={choices} choicesLoading={choicesLoading}
              phase={conversationPhase} sending={sending} pendingChoiceIndex={pendingChoiceIndex}
              onOlder={() => setPageOffset(current => current + 30)}
              onNewer={() => setPageOffset(current => Math.max(0, current - 30))}
              onChoose={index => { void choose(index); }} />
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)]">
          <div className="min-h-0 border-r border-[#b49dcb]">
            <PulseBuddyList contacts={contacts} selectedId={selected}
              onSelect={selectContact} />
          </div>
          <PulseChatPane contact={activeContact} accountName={currentAccount.username}
            page={page} pageOffset={pageOffset} loading={pageLoading}
            choices={choices} choicesLoading={choicesLoading}
            phase={conversationPhase} sending={sending} pendingChoiceIndex={pendingChoiceIndex}
            onOlder={() => setPageOffset(current => current + 30)}
            onNewer={() => setPageOffset(current => Math.max(0, current - 30))}
            onChoose={index => { void choose(index); }} />
        </div>
      )}

      {compact && drawerOpen && (
        <div className="absolute inset-0 z-30 flex bg-black/35" role="dialog" aria-modal="true" aria-label="Buddy list">
          <div className="flex h-full w-[86%] max-w-[310px] flex-col border-r-2 border-[#5b3a7b] bg-[#fbf8ff] shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-[#5b3a7b] bg-gradient-to-b from-[#7743b4] to-[#4a2378] px-2 py-1 text-white">
              <h3 className="text-[12px] font-bold tracking-wide">Buddy List</h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={signOut}
                  aria-label="Sign out of Pulse"
                  className="border border-white/60 bg-white/15 px-1.5 py-0.5 text-[10px] font-bold hover:bg-white/25">
                  Sign out
                </button>
                <button type="button" onClick={() => setDrawerOpen(false)}
                  className="h-5 w-5 border border-white/60 bg-white/15 text-[11px] font-bold hover:bg-white/25"
                  aria-label="Close buddy list">✕</button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <PulseBuddyList contacts={contacts} selectedId={selected}
                onSelect={selectContact} />
            </div>
          </div>
          <button type="button" aria-label="Close buddy list" onClick={() => setDrawerOpen(false)}
            className="h-full min-w-0 flex-1" />
        </div>
      )}

      {error && (
        <p role="alert" className="shrink-0 border-t border-red-300 bg-red-50 p-2 text-[11px] text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
