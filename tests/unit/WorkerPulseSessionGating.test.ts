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

interface SessionOptions {
  choices?: Array<{ id: string; text: string }>;
  conversationPage?: (offset: number) => {
    revision: number;
    conversationId: string;
    messages: Array<Record<string, unknown>>;
    total: number;
    hasOlder: boolean;
  };
}

function createSession(options: SessionOptions = {}) {
  const markConversationRead = vi.fn(async () => true);
  const pulseNarrative = vi.fn(async (command: { kind: string; expectedText?: string }) => ({
    revision: command.kind === 'choose' ? 2 : 1,
    actorId: 'actor_a',
    phase: command.kind === 'choose' ? 'waiting_first' : 'first',
    choices: command.kind === 'choose' ? [] : (options.choices ?? []),
    ...(command.kind === 'choose' ? { sent: command.expectedText, reply: null } : {}),
  }));
  const read = vi.fn(async (query: { kind: string; offset?: number }) => {
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
        if (options.conversationPage) return options.conversationPage(query.offset ?? 0);
        return {
          revision: 1,
          conversationId: 'pulse:shared_id:actor_a',
          messages: [{
            id: 'message_1', conversationId: 'pulse:shared_id:actor_a', senderId: 'actor_a',
            recipientId: 'player', text: 'are you around?', timestampMinute: 10,
            day: 1, isRead: false, deliveredAway: false,
          }],
          total: 1,
          hasOlder: false,
        };
      }
      throw new Error('Unexpected Worker read: ' + query.kind);
  });
  const session = {
    read,
    pulseNarrative,
    markConversationRead,
  } as unknown as WorkerGameSession;
  return { session, read, markConversationRead, pulseNarrative };
}

function setPulseWindow(slotId: string, activeWindowId: string, width = 600) {
  useWindowStore.setState({
    windows: {
      pulse: {
        id: 'pulse', appId: 'pulse', title: 'Pulse Messenger', icon: '',
        isOpen: true, isMinimized: false, isMaximized: false, zIndex: 11,
        position: { x: 20, y: 20 }, size: { width, height: 540 },
        minSize: { width: 340, height: 420 }, isResizable: true,
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

describe('#223 Worker Pulse UI session and attention', () => {
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

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes(text)) as HTMLButtonElement | undefined;
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
    expect(markConversationRead).toHaveBeenCalledWith('actor_a', 'shared_id');
  });

  it('freezes the older history page when a new revision arrives', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse');
    const total = 60;
    const { session, read } = createSession({
      conversationPage: (offset) => {
        const start = Math.max(0, total - offset - 30);
        const count = Math.min(30, total - offset);
        return {
          revision: 1,
          conversationId: 'pulse:shared_id:actor_a',
          messages: Array.from({ length: count }, (_, index) => ({
            id: `message_${start + index}`,
            conversationId: 'pulse:shared_id:actor_a',
            senderId: index % 2 === 0 ? 'actor_a' : 'player',
            recipientId: index % 2 === 0 ? 'player' : 'actor_a',
            text: `message ${start + index}`,
            timestampMinute: 10 + start + index,
            day: 1,
            isRead: true,
            deliveredAway: false,
          })),
          total,
          hasOlder: offset + 30 < total,
        };
      },
    });

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.textContent?.includes('message 59') === true);
    const older = buttonByText('Older');
    expect(older).toBeTruthy();
    await act(async () => {
      older!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => container.textContent?.includes('message 0') === true);
    const readsAfterOlder = () => read.mock.calls
      .filter(([query]) => query.kind === 'conversation').length;
    const beforeRevision = readsAfterOlder();
    expect(beforeRevision).toBeGreaterThanOrEqual(2);

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 2, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await flush();
    expect(readsAfterOlder()).toBe(beforeRevision);
    expect(container.textContent).toContain('message 0');
  });

  it('does not interrupt scrolled-up history and only acknowledges after jumping to the newest turn', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse');
    let latestIndex = 59;
    const { session, markConversationRead } = createSession({
      conversationPage: () => {
        const start = Math.max(0, latestIndex - 29);
        return {
          revision: 1,
          conversationId: 'pulse:shared_id:actor_a',
          messages: Array.from({ length: latestIndex - start + 1 }, (_, index) => ({
            id: `message_${start + index}`,
            conversationId: 'pulse:shared_id:actor_a',
            senderId: (start + index) % 2 === 0 ? 'actor_a' : 'player',
            recipientId: (start + index) % 2 === 0 ? 'player' : 'actor_a',
            text: `message ${start + index}`,
            timestampMinute: 10 + start + index,
            day: 1,
            isRead: true,
            deliveredAway: false,
          })),
          total: latestIndex + 1,
          hasOlder: latestIndex >= 30,
        };
      },
    });

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.textContent?.includes('message 59') === true);
    const transcript = container.querySelector('[data-testid="worker-pulse-messages"]') as HTMLElement;
    Object.defineProperty(transcript, 'scrollHeight', { value: 1200, configurable: true });
    Object.defineProperty(transcript, 'clientHeight', { value: 200, configurable: true });
    transcript.scrollTop = 600;
    await act(async () => {
      transcript.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await waitFor(() => markConversationRead.mock.calls.length === 1);
    const marksBeforeArrival = markConversationRead.mock.calls.length;

    latestIndex = 60;
    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 2, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.querySelector('[data-testid="worker-pulse-new-messages"]') !== null);
    // The unseen newest page is frozen: the transcript does not silently swap
    // messages under the reader, and the new turn is not acknowledged yet.
    expect(container.textContent).not.toContain('message 60');
    expect(markConversationRead.mock.calls.length).toBe(marksBeforeArrival);
    expect(transcript.scrollTop).toBe(600);

    await act(async () => {
      (container.querySelector('[data-testid="worker-pulse-new-messages"]') as HTMLButtonElement).click();
    });
    await waitFor(() => container.textContent?.includes('message 60') === true);
    await waitFor(() => markConversationRead.mock.calls.length > marksBeforeArrival);
    await waitFor(() => container.querySelector('[data-testid="worker-pulse-new-messages"]') === null);
  });

  it('renders transcript timestamps, day separators and reply hints at AA secondary contrast', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse');
    const { session } = createSession({ choices: [{ id: 'choice_1', text: 'Hello there' }] });

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.querySelector('[data-testid="worker-pulse-choices"]') !== null);
    const timestamp = container.querySelector('[data-testid="worker-pulse-messages"] time');
    expect(timestamp?.className).toContain('text-[#6d5684]');
    const day = Array.from(container.querySelectorAll('div'))
      .find(element => element.textContent?.trim() === 'Day 1');
    expect(day?.className).toContain('text-[#6d5684]');
    const hint = Array.from(container.querySelectorAll('span'))
      .find(element => element.textContent === 'Written only · 1–9');
    expect(hint?.className).toContain('text-[#6d5684]');
  });

  it('focuses the compact drawer search and restores focus on Escape', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse', 400);
    const { session } = createSession();

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => buttonByText('Buddies') !== undefined);
    const opener = buttonByText('Buddies')!;
    await act(async () => {
      opener.click();
    });
    await waitFor(() => container.querySelector('[role="dialog"]') !== null);
    await waitFor(() => document.activeElement?.getAttribute('type') === 'search');
    expect(document.activeElement?.getAttribute('placeholder')).toBe('Search buddies…');

    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await waitFor(() => container.querySelector('[role="dialog"]') === null);
    await waitFor(() => document.activeElement === opener);
  });

  it('keeps numbered reply shortcuts inside the composer', async () => {
    checkPulseCredentials([], 'shared_id', 'slot-a-password', 'slot_1');
    setPulseWindow('slot_1', 'pulse');
    const { session, pulseNarrative } = createSession({
      choices: [{ id: 'choice_1', text: 'Hello there' }],
    });

    await act(async () => {
      root.render(React.createElement(WorkerPulsePanel, { session, revision: 1, windowId: 'pulse', slotId: 'slot_1' }));
    });
    await waitFor(() => container.querySelector('[data-testid="worker-pulse-choices"]') !== null);
    const choice = container.querySelector('button[aria-label="Hello there"]');
    expect(choice).toBeTruthy();
    await act(async () => {
      choice!.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    });
    await waitFor(() => pulseNarrative.mock.calls.some(([command]) =>
      (command as { kind: string }).kind === 'choose'));
    expect(pulseNarrative).toHaveBeenCalledWith({
      kind: 'choose', actorId: 'actor_a', accountId: 'shared_id', choiceIndex: 0, expectedText: 'Hello there',
    });
  });
});
