import type { PulseAccount } from '../persistence';
import type { PulseLoginSession } from '../components/PulseLoginSplash';

export interface RestoredPulseUiSession {
  session: PulseLoginSession;
  slotId: string;
  selectedActorId: string | null;
}

export function isPulseLoginSession(value: unknown): value is PulseLoginSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PulseLoginSession>;
  return typeof candidate.username === 'string' && candidate.username.length > 0
    && (candidate.status === 'online' || candidate.status === 'away' || candidate.status === 'busy')
    && typeof candidate.awayMessage === 'string'
    && typeof candidate.signedInAt === 'number';
}

/**
 * A UI-only signed-in session may resume only inside the save slot that
 * established it. Window custom state outlives slot switches, so username
 * existence alone is insufficient: two slots can both hold the same ID with
 * different passwords. Credentials remain owned by the per-slot account store.
 */
export function restorePulseUiSession(input: {
  storedSession: unknown;
  storedSlotId: unknown;
  storedSelectedActorId: unknown;
  slotId: string;
  accounts: readonly PulseAccount[];
}): RestoredPulseUiSession | null {
  if (input.storedSlotId !== input.slotId) return null;
  if (!isPulseLoginSession(input.storedSession)) return null;
  const username = input.storedSession.username.toLowerCase();
  if (!input.accounts.some(account => account.id.toLowerCase() === username)) return null;
  return {
    session: input.storedSession,
    slotId: input.slotId,
    selectedActorId: typeof input.storedSelectedActorId === 'string'
      ? input.storedSelectedActorId : null,
  };
}

export interface PulseAcknowledgementInput {
  signedIn: boolean;
  selectedActorId: string | null;
  pageOffset: number;
  latestMessageId: string | null;
  alreadyAcknowledged: boolean;
  windowActive: boolean;
  windowVisible: boolean;
  documentVisible: boolean;
  conversationObscured: boolean;
  latestVisible: boolean;
}

/**
 * A mounted Pulse window is not necessarily being looked at. Canonical unread
 * may clear only while the selected thread is actually visible to the player.
 */
export function shouldAcknowledgePulseConversation(input: PulseAcknowledgementInput): boolean {
  return input.signedIn
    && Boolean(input.selectedActorId)
    && input.pageOffset === 0
    && Boolean(input.latestMessageId)
    && !input.alreadyAcknowledged
    && input.windowActive
    && input.windowVisible
    && input.documentVisible
    && !input.conversationObscured
    && input.latestVisible;
}

/**
 * Transient chat-window state. The Social Worker remains the only owner of
 * buddy membership and messages; these IDs describe only open UI tabs.
 */
export interface PulseChatTabs {
  openIds: string[];
  activeId: string | null;
  /** Auto-open the first known contact only on an untouched account session. */
  autoOpenFirst: boolean;
}

export function createPulseChatTabs(initialActorId: string | null): PulseChatTabs {
  const id = initialActorId?.trim() || null;
  return { openIds: id ? [id] : [], activeId: id, autoOpenFirst: true };
}

export function reconcilePulseChatTabs(
  state: PulseChatTabs,
  permittedActorIds: readonly string[],
): PulseChatTabs {
  const permitted = new Set(permittedActorIds);
  const openIds = state.openIds.filter(id => permitted.has(id));
  let activeId = state.activeId && openIds.includes(state.activeId)
    ? state.activeId : (openIds.at(-1) ?? null);
  let autoOpenFirst = state.autoOpenFirst;
  if (openIds.length === 0 && autoOpenFirst && permittedActorIds.length > 0) {
    const first = permittedActorIds[0]!;
    openIds.push(first);
    activeId = first;
  }
  if (openIds.length > 0) autoOpenFirst = false;
  if (activeId === state.activeId && autoOpenFirst === state.autoOpenFirst
    && openIds.length === state.openIds.length
    && openIds.every((id, index) => id === state.openIds[index])) return state;
  return { openIds, activeId, autoOpenFirst };
}

export function openPulseChatTab(state: PulseChatTabs, actorId: string): PulseChatTabs {
  if (!actorId) return state;
  if (state.activeId === actorId && state.openIds.includes(actorId)) return state;
  return {
    openIds: state.openIds.includes(actorId) ? state.openIds : [...state.openIds, actorId],
    activeId: actorId, autoOpenFirst: false,
  };
}

export function closePulseChatTab(state: PulseChatTabs, actorId: string): PulseChatTabs {
  const index = state.openIds.indexOf(actorId);
  if (index === -1) return state;
  const openIds = state.openIds.filter(id => id !== actorId);
  return {
    openIds,
    activeId: state.activeId === actorId
      ? (openIds[Math.min(index, openIds.length - 1)] ?? null) : state.activeId,
    autoOpenFirst: false,
  };
}
