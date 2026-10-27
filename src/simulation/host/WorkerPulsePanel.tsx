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
  const [openedAccount, setOpenedAccount] = useState<string | null>(null);
  const [buddyToAdd, setBuddyToAdd] = useState('');
  const [addingBuddy, setAddingBuddy] = useState(false);
  const [messenger, setMessenger] = useState<SimulationMessengerRead | null>(null);
  const [presence, setPresence] = useState<SimulationPresenceRead | null>(null);
  const [page, setPage] = useState<SimulationConversationRead | null>(null);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [choices, setChoices] = useState<SimulationPulseNarrativeResult['choices']>([]);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<SimulationPulseNarrativeResult['phase']>('first');
  const [replyActivity, setReplyActivity] = useState<SimulationPulseNarrativeResult['replyActivity']>('idle');
  const [sending, setSending] = useState(false);
  const [pendingChoiceIndex, setPendingChoiceIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [latestVisible, setLatestVisible] = useState(true);
  const [conversationRevision, setConversationRevision] = useState(revision);
  const [scrollToLatestSignal, setScrollToLatestSignal] = useState(0);
  const [notice, setNotice] = useState<{ actorId: string; name: string; count: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState<boolean>(() => {
    const width = useWindowStore.getState().windows[windowId]?.size.width;
    return typeof width !== 'number' || width < SPLIT_LAYOUT_MIN_WIDTH;
  });
  const panelRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerReturnFocus = useRef<HTMLElement | null>(null);
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
  const activeAccountId = currentAccount?.username ?? null;
  const readyForAccount = activeAccountId && openedAccount === activeAccountId;

  useEffect(() => {
    let active = true;
    setOpenedAccount(null);
    setReplyActivity('idle');
    setMessenger(null);
    setPage(null);
    setSelected(null);
    setChoices([]);
    setPageOffset(0);
    unreadBaseline.current = null;
    acknowledgedMessages.current.clear();
    if (!activeAccountId) return () => { active = false; };
    void session.pulseNarrative({ kind: 'openAccount', accountId: activeAccountId })
      .then(() => { if (active) setOpenedAccount(activeAccountId); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [session, slotId, activeAccountId]);

  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    // Freeze an offset-from-newest page while the player is reading older
    // history. Only the newest, actually-visible page follows revisions.
    if (pageOffset === 0 && latestVisible) setConversationRevision(revision);
  }, [revision, pageOffset, latestVisible]);

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
    setReplyActivity('idle');
    setPendingChoiceIndex(null);
    setNotice(null);
    setDrawerOpen(false);
    setError(null);
    unreadBaseline.current = null;
    acknowledgedMessages.current.clear();
  }, [account, accountSlotId, slotId]);

  useEffect(() => {
    let active = true;
    if (!readyForAccount) {
      setReplyActivity('idle');
      setMessenger(null);
      setPresence(null);
      setSelected(null);
      setPage(null);
      setChoices([]);
      return () => { active = false; };
    }
    void Promise.all([
      session.read({ kind: 'messenger', maxContacts: 32, accountId: activeAccountId! }),
      session.read({ kind: 'presence' }),
    ]).then(([next, nextPresence]) => {
      // The revision prop belongs to an independently refreshed HUD read.
      // This effect's cleanup, not exact numeric equality across separate
      // Worker queries, prevents stale requests from updating this view.
      if (!active) return;
      setMessenger(previous => previous
        && JSON.stringify({ ...previous, revision: 0 }) === JSON.stringify({ ...next, revision: 0 })
          ? previous : next);
      setPresence(previous => previous
        && JSON.stringify({ ...previous, revision: 0 }) === JSON.stringify({ ...nextPresence, revision: 0 })
          ? previous : nextPresence);
      setSelected(current =>
        current && next.contacts.some(row => row.actorId === current)
          ? current : (next.contacts[0]?.actorId ?? null));
      setError(null);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, [session, revision, refreshNonce, readyForAccount, activeAccountId]);

  useEffect(() => {
    let active = true;
    if (!readyForAccount || !selected) {
      setPage(null);
      setPageLoading(false);
      return () => { active = false; };
    }
    // New pages show a loader; revision refreshes keep the existing transcript visible.
    if (!page || page.conversationId !== `pulse:${activeAccountId}:${selected}`) setPageLoading(true);
    void session.read({
      kind: 'conversation', actorId: selected, offset: pageOffset, limit: 30,
      accountId: activeAccountId!,
    }).then(result => {
      if (!active) return;
      setPage(previous => previous && previous.conversationId === result.conversationId
        && previous.total === result.total && previous.hasOlder === result.hasOlder
        && JSON.stringify(previous.messages) === JSON.stringify(result.messages) ? previous : result);
      setPageLoading(false);
      setError(null);
    }).catch(cause => {
      if (active) {
        setPageLoading(false);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    });
    return () => { active = false; };
  }, [session, selected, pageOffset, conversationRevision, refreshNonce, readyForAccount, activeAccountId]);

  useEffect(() => {
    let active = true;
    setChoicesLoading(Boolean(readyForAccount && selected && choices.length === 0));
    if (!readyForAccount || !selected) {
      setChoicesLoading(false);
      return () => { active = false; };
    }
    void session.pulseNarrative({ kind: 'choices', actorId: selected, accountId: activeAccountId! })
      .then(result => {
        if (active && result.actorId === selected) {
          setChoices(result.choices);
          setConversationPhase(result.phase);
          setReplyActivity(result.replyActivity);
          setError(null);
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => { if (active) setChoicesLoading(false); });
    return () => { active = false; };
  }, [session, selected, page?.messages.at(-1)?.id, refreshNonce, readyForAccount, activeAccountId]);

  // Only the Worker knows whether the world-time composing window has begun.
  // Its passive read leaves transcript pages, authored choices and loaders stable.
  useEffect(() => {
    const waiting = conversationPhase === 'waiting_first' || conversationPhase === 'waiting_second'
      || conversationPhase === 'waiting_outreach';
    if (!readyForAccount || !selected || !waiting || !windowVisible || !documentVisible) return;
    let active = true;
    void session.pulseNarrative({ kind: 'choices', actorId: selected, accountId: activeAccountId! })
      .then(result => {
        if (active && result.actorId === selected) {
          setReplyActivity(previous => previous === result.replyActivity ? previous : result.replyActivity);
        }
      })
      .catch(() => { if (active) setReplyActivity('waiting'); });
    return () => { active = false; };
  }, [session, revision, selected, readyForAccount, activeAccountId,
    conversationPhase, windowVisible, documentVisible]);

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
    if (!compact) setDrawerOpen(false);
  }, [compact]);

  useEffect(() => {
    if (!drawerOpen) return;
    const timer = window.setTimeout(() => {
      const target = drawerRef.current?.querySelector<HTMLInputElement>('input[type="search"]')
        ?? drawerRef.current?.querySelector<HTMLElement>('button, input');
      target?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [drawerOpen]);

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
      latestVisible,
    });
    if (!allowed) return;
    acknowledgedMessages.current.add(key);
    void session.markConversationRead(selected, activeAccountId ?? undefined).catch(() => {
      acknowledgedMessages.current.delete(key);
    });
  }, [session, currentAccount, activeAccountId, selected, page, pageOffset, windowActive, windowVisible,
    documentVisible, compact, drawerOpen, latestVisible]);

  const contacts = useMemo(
    () => messenger ? buildPulseContactViews(messenger.contacts, presence?.presence ?? {}) : [],
    [messenger, presence],
  );
  const activeContact = contacts.find(contact => contact.actorId === selected) ?? null;
  const totals = partitionPulseContacts(contacts);
  const totalUnread = contacts.reduce((sum, contact) => sum + contact.unread, 0);
  const availableBuddies = messenger?.availableBuddies ?? [];
  const buddyChoice = availableBuddies.some(row => row.actorId === buddyToAdd)
    ? buddyToAdd : (availableBuddies[0]?.actorId ?? '');

  const addBuddy = async () => {
    if (!activeAccountId || !buddyChoice || addingBuddy) return;
    setAddingBuddy(true);
    setError(null);
    try {
      await session.pulseNarrative({ kind: 'addBuddy', accountId: activeAccountId, actorId: buddyChoice });
      setBuddyToAdd('');
      setRefreshNonce(current => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setAddingBuddy(false); }
  };

  const addBuddyControls = (
    <div className="flex shrink-0 items-center gap-1 border-b border-[#b49dcb] bg-[#eee5f6] px-1.5 py-1">
      <select aria-label="Find a known buddy" value={buddyChoice}
        onChange={event => setBuddyToAdd(event.target.value)}
        disabled={!availableBuddies.length}
        className="min-w-0 flex-1 border border-[#9473b4] bg-white px-1 py-0.5 text-[11px] text-[#2f194c]">
        {!availableBuddies.length && <option value="">Meet people to add buddies</option>}
        {availableBuddies.map(row => <option key={row.actorId} value={row.actorId}>{row.displayName} ({row.handle})</option>)}
      </select>
      <button type="button" onClick={() => { void addBuddy(); }}
        disabled={!buddyChoice || addingBuddy}
        className="shrink-0 border border-[#6f4b98] bg-[#fffdfd] px-1.5 py-0.5 text-[11px] font-bold disabled:opacity-50">
        Add
      </button>
    </div>
  );

  const retryReads = () => {
    setError(null);
    setRefreshNonce(current => current + 1);
  };

  const openDrawer = (opener?: HTMLElement) => {
    drawerReturnFocus.current = opener
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    const target = drawerReturnFocus.current;
    drawerReturnFocus.current = null;
    window.setTimeout(() => target?.focus(), 0);
  };

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab' || !drawerRef.current) return;
    const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const selectContact = (actorId: string) => {
    if (drawerOpen) closeDrawer();
    setNotice(current => current?.actorId === actorId ? null : current);
    if (selected === actorId) return;
    setSelected(actorId);
    setPageOffset(0);
    setPage(null);
    setChoices([]);
    setConversationPhase('first');
    setReplyActivity('idle');
    setPendingChoiceIndex(null);
    setError(null);
    setLatestVisible(true);
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
    setReplyActivity('idle');
    setPendingChoiceIndex(null);
    setError(null);
    setLatestVisible(true);
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
        kind: 'choose', actorId: selected, accountId: activeAccountId!, choiceIndex: index,
        expectedText: chosen.text,
      });
      if (result.actorId === selected) {
        setChoices(result.choices);
        setConversationPhase(result.phase);
        setReplyActivity(result.replyActivity);
        setPageOffset(0);
        setLatestVisible(true);
        setConversationRevision(result.revision);
        setRefreshNonce(current => current + 1);
        setScrollToLatestSignal(current => current + 1);
      }
      // A real Social revision refreshes the canonical transcript.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      // The offered set may have gone stale while another turn landed. Ask the
      // Worker again rather than keeping dead buttons on screen.
      try {
        const refreshed = await session.pulseNarrative({ kind: 'choices', actorId: selected, accountId: activeAccountId! });
        if (refreshed.actorId === selected) {
          setChoices(refreshed.choices);
          setConversationPhase(refreshed.phase);
          setReplyActivity(refreshed.replyActivity);
        }
      } catch { /* the visible error already explains the failed send */ }
    } finally {
      setSending(false);
      setPendingChoiceIndex(null);
    }
  };

  if (!currentAccount) {
    return (
      <section ref={panelRef} className="pulse-panel flex h-full min-h-0 flex-col bg-[#efeaf6] font-pixel"
        data-testid="worker-pulse-panel" data-pulse-phase="sign-in" data-pulse-layout="sign-in">
        <PulseLoginSplash onLogin={(next) => {
          setError(null);
          setAccount(next);
          setAccountSlotId(slotId);
        }} />
      </section>
    );
  }

  if (!readyForAccount) {
    return (
      <section ref={panelRef} data-testid="worker-pulse-panel" data-pulse-phase="opening-account"
        className="pulse-panel flex h-full min-h-0 flex-col items-center justify-center gap-2 bg-[#f0eaf8] p-3 font-pixel text-[#2f194c]">
        <p role="status" className="text-center text-[12px]">Opening {currentAccount.username}…</p>
        {error && <p role="alert" className="text-center text-[11px] text-red-800">{error}</p>}
        <button type="button" className="border border-[#6f4b98] bg-white px-3 py-1 text-[11px]"
          onClick={signOut}>Sign out</button>
      </section>
    );
  }

  return (
    <section ref={panelRef}
      className="pulse-panel relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f0eaf8] font-pixel text-[#2f194c]"
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
              {currentAccount.username} · {PULSE_STATUS_LABEL[currentAccount.status]}
              {!compact ? ` · ${totals.online.length} of ${contacts.length} online` : ''}
            </p>
          </div>
          {compact && (
            <button type="button" onClick={(event) => openDrawer(event.currentTarget)}
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
        {!compact && (
          <div className="flex items-center justify-between border-t border-white/15 px-2 py-0.5 text-[10px] text-[#e5d5fb]">
            <span className="min-w-0 truncate">Signed in as {currentAccount.username} · {currentAccount.awayMessage}</span>
          </div>
        )}
      </header>

      {notice && (
        <div role="status" aria-live="polite"
          className="flex shrink-0 items-center gap-2 border-b border-[#c8a74a] bg-[#fff5bf] px-2 py-1 text-[11px] text-[#4e3a00]">
          <span aria-hidden="true">✉</span>
          <span className="min-w-0 flex-1 truncate">
            New IM{notice.count > 1 ? `s (${notice.count})` : ''} from <strong>{notice.name}</strong>
          </span>
          <button type="button" onClick={() => selectContact(notice.actorId)}
            className="border border-[#8b6b2d] bg-white px-1.5 py-0.5 font-bold hover:bg-[#fffbe6]">
            Open
          </button>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}
            className="px-1 font-bold text-[#7a5c16] hover:text-black">✕</button>
        </div>
      )}

      {error && (
        <div role="alert"
          className="flex shrink-0 items-center gap-1.5 border-b border-red-300 bg-red-50 px-2 py-1 text-[10px] text-red-800">
          <span className="min-w-0 flex-1 truncate" title={error}>{error}</span>
          <button type="button" onClick={retryReads}
            className="shrink-0 border border-red-300 bg-white px-1.5 py-0.5 font-bold hover:bg-red-100">
            Retry
          </button>
          <button type="button" aria-label="Dismiss error" onClick={() => setError(null)}
            className="shrink-0 px-1 font-bold hover:text-red-950">✕</button>
        </div>
      )}

      {compact ? (
        <>
          <PulseContactRail contacts={contacts} selectedId={selected}
            onSelect={selectContact} onOpenList={openDrawer} />
          <div className="flex min-h-0 flex-1 flex-col">
            <PulseChatPane contact={activeContact} accountName={currentAccount.username}
              page={page} pageOffset={pageOffset} latestUnread={activeContact?.unread ?? 0}
              loading={pageLoading}
              choices={choices} choicesLoading={choicesLoading}
              phase={conversationPhase} replyActivity={replyActivity} sending={sending} pendingChoiceIndex={pendingChoiceIndex}
              compact
              onOlder={() => setPageOffset(current => current + 30)}
              onNewer={() => setPageOffset(current => Math.max(0, current - 30))}
              onNewest={() => setPageOffset(0)}
              onChoose={index => { void choose(index); }}
              onLatestVisibilityChange={setLatestVisible}
              scrollToLatestSignal={scrollToLatestSignal}
              onJumpToLatest={() => {
                setRefreshNonce(current => current + 1);
                setScrollToLatestSignal(current => current + 1);
              }} />
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[210px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-[#b49dcb]">
            {addBuddyControls}
            <div className="min-h-0 flex-1">
              <PulseBuddyList contacts={contacts} selectedId={selected} onSelect={selectContact} />
            </div>
          </div>
          <PulseChatPane contact={activeContact} accountName={currentAccount.username}
            page={page} pageOffset={pageOffset} latestUnread={activeContact?.unread ?? 0}
            loading={pageLoading}
            choices={choices} choicesLoading={choicesLoading}
            phase={conversationPhase} replyActivity={replyActivity} sending={sending} pendingChoiceIndex={pendingChoiceIndex}
            compact={false}
            onOlder={() => setPageOffset(current => current + 30)}
            onNewer={() => setPageOffset(current => Math.max(0, current - 30))}
            onNewest={() => setPageOffset(0)}
            onChoose={index => { void choose(index); }}
            onLatestVisibilityChange={setLatestVisible}
            scrollToLatestSignal={scrollToLatestSignal}
            onJumpToLatest={() => {
              setRefreshNonce(current => current + 1);
              setScrollToLatestSignal(current => current + 1);
            }} />
        </div>
      )}

      {compact && drawerOpen && (
        <div className="absolute inset-0 z-30 flex bg-black/35" role="dialog" aria-modal="true" aria-label="Buddy list">
          <div ref={drawerRef} onKeyDown={handleDrawerKeyDown} data-testid="worker-pulse-drawer"
            className="flex h-full w-[92%] max-w-[310px] flex-col border-r-2 border-[#5b3a7b] bg-[#fbf8ff] shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-[#5b3a7b] bg-gradient-to-b from-[#7743b4] to-[#4a2378] px-2 py-1 text-white">
              <h3 className="text-[12px] font-bold tracking-wide">Buddy List</h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={signOut}
                  aria-label="Sign out of Pulse"
                  className="border border-white/60 bg-white/15 px-1.5 py-0.5 text-[10px] font-bold hover:bg-white/25">
                  Sign out
                </button>
                <button type="button" onClick={closeDrawer}
                  className="h-5 w-5 border border-white/60 bg-white/15 text-[11px] font-bold hover:bg-white/25"
                  aria-label="Close buddy list">✕</button>
              </div>
            </div>
            {addBuddyControls}
            <div className="min-h-0 flex-1">
              <PulseBuddyList contacts={contacts} selectedId={selected}
                onSelect={selectContact} />
            </div>
          </div>
          <button type="button" aria-label="Close buddy list" tabIndex={-1} onClick={closeDrawer}
            className="h-full min-w-0 flex-1" />
        </div>
      )}

      <footer data-testid="worker-pulse-statusbar"
        className="flex shrink-0 items-center justify-between gap-2 border-t border-[#8f78aa] bg-[#e4d9f0] px-2 py-0.5 text-[10px] text-[#5a456f] shadow-[inset_0_1px_0_#fff]">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#35a853]" aria-hidden="true" />
          {totals.online.length} of {contacts.length} buddies online
        </span>
        <span className="shrink-0">Pulse 5.2 · 2005</span>
      </footer>
    </section>
  );
}
