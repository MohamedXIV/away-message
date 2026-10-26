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
    && !input.conversationObscured;
}
