import { describe, expect, it } from 'vitest';
import {
  restorePulseUiSession,
  shouldAcknowledgePulseConversation,
  type PulseAcknowledgementInput,
} from '../../src/apps/pulse/utils/workerPulseUi';
import type { PulseAccount } from '../../src/apps/pulse/persistence';

const session = {
  username: 'shared_id',
  status: 'online' as const,
  awayMessage: 'back online :)',
  signedInAt: 1000,
};

const slotAAccounts: PulseAccount[] = [
  { id: 'shared_id', password: 'slot-a-password', createdAt: 1 },
];
const slotBAccounts: PulseAccount[] = [
  { id: 'shared_id', password: 'slot-b-password', createdAt: 2 },
];

describe('#223 Worker Pulse UI session isolation', () => {
  it('restores a UI session only in the slot that established it', () => {
    const restored = restorePulseUiSession({
      storedSession: session,
      storedSlotId: 'slot_1',
      storedSelectedActorId: 'actor_one',
      slotId: 'slot_1',
      accounts: slotAAccounts,
    });
    expect(restored).toEqual({
      session,
      slotId: 'slot_1',
      selectedActorId: 'actor_one',
    });
  });

  it('never carries a same-username session into another slot with a different password', () => {
    const restored = restorePulseUiSession({
      storedSession: session,
      storedSlotId: 'slot_1',
      storedSelectedActorId: 'actor_one',
      slotId: 'slot_2',
      accounts: slotBAccounts,
    });
    expect(restored).toBeNull();
  });

  it('rejects missing slot identity, unknown IDs and malformed sessions', () => {
    expect(restorePulseUiSession({
      storedSession: session,
      storedSlotId: undefined,
      storedSelectedActorId: 'actor_one',
      slotId: 'slot_1',
      accounts: slotAAccounts,
    })).toBeNull();
    expect(restorePulseUiSession({
      storedSession: { ...session, username: 'unknown_id' },
      storedSlotId: 'slot_1',
      storedSelectedActorId: 'actor_one',
      slotId: 'slot_1',
      accounts: slotAAccounts,
    })).toBeNull();
    expect(restorePulseUiSession({
      storedSession: { ...session, status: 'idle' },
      storedSlotId: 'slot_1',
      storedSelectedActorId: 'actor_one',
      slotId: 'slot_1',
      accounts: slotAAccounts,
    })).toBeNull();
  });
});

describe('#223 Pulse conversation acknowledgement visibility', () => {
  const visible: PulseAcknowledgementInput = {
    signedIn: true,
    selectedActorId: 'actor_one',
    pageOffset: 0,
    latestMessageId: 'message_7',
    alreadyAcknowledged: false,
    windowActive: true,
    windowVisible: true,
    documentVisible: true,
    conversationObscured: false,
    latestVisible: true,
  };

  it('acknowledges a visible, active conversation exactly once', () => {
    expect(shouldAcknowledgePulseConversation(visible)).toBe(true);
    expect(shouldAcknowledgePulseConversation({ ...visible, alreadyAcknowledged: true })).toBe(false);
  });

  it('leaves an arrival unread while Pulse is behind another OS window', () => {
    expect(shouldAcknowledgePulseConversation({ ...visible, windowActive: false })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, windowVisible: false })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, documentVisible: false })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, conversationObscured: true })).toBe(false);
  });

  it('keeps a new turn unread while the player is scrolled up in history', () => {
    expect(shouldAcknowledgePulseConversation({ ...visible, latestVisible: false })).toBe(false);
  });

  it('does not acknowledge while browsing older history or without a thread', () => {
    expect(shouldAcknowledgePulseConversation({ ...visible, pageOffset: 30 })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, selectedActorId: null })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, signedIn: false })).toBe(false);
    expect(shouldAcknowledgePulseConversation({ ...visible, latestMessageId: null })).toBe(false);
  });
});
