// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerPulsePanel } from '../../src/simulation/host/WorkerPulsePanel';
import { useWindowStore } from '../../src/store/useWindowStore';
import { checkPulseCredentials, loadPulseAccounts } from '../../src/apps/pulse/persistence';
import type { WorkerGameSession } from '../../src/simulation/host/WorkerGameSession';

const SESSION = {
  username: 'shared_id',
  status: 'online' as const,
  awayMessage: 'back online :)',
  signedInAt: 1000,
};

function createSession() {
  const markConversationRead = vi.fn(async () => true);
  const session = {
    read: vi.fn(async (query: { kind: string }) => {
      if (query.kind === 'messenger') {
        return {
          revision: 1,
          contacts: [{
            actorId: 'actor_a', displayName: 'Actor A', handle: 'actor_a',
            archetype: 'regular', onlineStatus: 'online', relationshipStage: 'friend',
            lastMessageMinute: 10, unread: 1,
          }],
          unreadCounts: { actor_a: 1 },
        };
      }
      if (query.kind === 'presence') {
        return { revision: 1, presence: { actor_a: { status: 'online', awayMessage: '' } } };
      }
      if (query.kind === 'conversation') {
        return {
          revision: 1,
          conversationId: 'actor_a',
          messages: [{
            id: 'message_1', conversationId: 'actor_a', senderId: 'actor_a',
            recipientId: 'player', text: 'are you around?', timestampMinute: 10,
            day: 1, isRead: false, deliveredAway: false,
          }],
          total: 1,
          hasOlder: false,
        };
      }
      throw new Error('Unexpected Worker read: ' + query.kind);
    }),
    pulseNarrative: vi.fn(async () => ({
      revision: 1, actorId: 'actor_a', phase: 'first', choices: [],
    })),
    markConversationRead,
  } as unknown as WorkerGameSession;
  return { session, markConversationRead };
}

function setPulseWindow(slotId: string, activeWindowId: string) {
  useWindowStore.setState({
    windows: {
      pulse: {
        id: 'pulse', appId: 'pulse', title: 'Pulse Messenger', icon: '',
        isOpen: true, isMinimized: false, isMaximized: false, zIndex: 11,
        position: { x: 20, y: 20 }, size: { width: 600, height: 540 },
        minSize: { width: 340, height: 360 }, isResizable: true,
        customState: {
          pulseSignedIn: true,
          pulseSession: SESSION,
          pulseSessionSlotId: slotId,
          pulseSelectedActorId: 'actor_a',
        },
      },
    },
    windowOrder: ['pulse'],
    activeWindowId,
    highestZIndex: 11,
    cascadeCounter: 0,
  });
}

describe('#223 Worker Pulse slot isolation and conversation attention', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    useWindowStore.setState({
      windows: {}, windowOrder: [], activeWindowId: null,
      highestZIndex: 10, cascadeCounter: 0,
    });
    window.localStorage.clear();
  });

  async function flush() {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  }

  async function waitFor(predicate: () => boolean) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (predicate()) return;
      await flush();
    }
    throw new Error('Timed out waiting for UI state\n' + (container.textContent ?? ''));
  }

  it('does not restore a same-username session carried from another slot', async () => {
    // Slot B has the same visible ID but a different password. A UI session
    // established in slot A must not authenticate against slot B.
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    checkPulseCredentials([], 'shared_id', 'slot-b-password', 'slot_2');
    expect(loadPulseAccounts('slot_1')[0]).toMatchObject({ id: 'shared_id', password: 'slot-a-password' });
    expect(loadPulseAccounts('slot_2')[0]).toMatchObject({ id: 'shared_id', password: 'slot-b-password' });
    setPulseWindow('slot_1', 'pulse');
    const { session, markConversationRead } = createSession();

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_2' }));
    });
    await waitFor(() => container.querySelector('[data-testid="worker-pulse-panel"]')
      ?.getAttribute('data-pulse-phase') === 'sign-in');
    expect(container.textContent).toContain('Pulse ID');
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it('preserves tray restoration inside the same slot', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse');
    const { session, markConversationRead } = createSession();

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.textContent?.includes('are you around?') === true);
    expect(container.querySelector('[data-testid="worker-pulse-panel"]')
      ?.getAttribute('data-pulse-phase')).toBe('signed-in');
    await waitFor(() => markConversationRead.mock.calls.length === 1);
  });

  it('leaves an arrival unread while Pulse is behind another window, then acknowledges on focus', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'fileexplorer');
    const { session, markConversationRead } = createSession();

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.textContent?.includes('are you around?') === true);
    // The conversation is mounted and has a fresh incoming row, but another
    // OS window is active. Canonical unread must remain untouched.
    expect(markConversationRead).not.toHaveBeenCalled();

    await act(async () => {
      useWindowStore.setState({ activeWindowId: 'pulse' });
    });
    await waitFor(() => markConversationRead.mock.calls.length === 1);
    expect(markConversationRead).toHaveBeenCalledWith('actor_a');
  });
});
