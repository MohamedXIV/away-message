import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as workerUi from '../../src/apps/pulse/utils/workerPulseUi';
import { ChatTabHeader } from '../../src/apps/pulse/components/ChatTabHeader';
import { PulseChatPane } from '../../src/apps/pulse/components/PulseChatPane';
import type { SimulationConversationRead } from '../../src/engine/kernel/SimulationPublication';

interface Tabs {
  openIds: string[];
  activeId: string | null;
  autoOpenFirst: boolean;
}
type TabModel = {
  createPulseChatTabs: (initial: string | null) => Tabs;
  reconcilePulseChatTabs: (tabs: Tabs, eligible: readonly string[]) => Tabs;
  openPulseChatTab: (tabs: Tabs, id: string) => Tabs;
  closePulseChatTab: (tabs: Tabs, id: string) => Tabs;
};
// Cast here so the RED commit compiles and fails in Vitest for missing behavior.
const model = workerUi as unknown as Partial<TabModel>;
function tabsModel(): TabModel {
  expect(model.createPulseChatTabs).toBeTypeOf('function');
  expect(model.reconcilePulseChatTabs).toBeTypeOf('function');
  expect(model.openPulseChatTab).toBeTypeOf('function');
  expect(model.closePulseChatTab).toBeTypeOf('function');
  return model as TabModel;
}

describe('#223 Worker Pulse conversation tabs', () => {
  it('opens the first learned buddy once, but does not reopen a tab the player explicitly closed', () => {
    const { createPulseChatTabs, reconcilePulseChatTabs, closePulseChatTab } = tabsModel();
    const start = createPulseChatTabs(null);
    const empty = reconcilePulseChatTabs(start, []);
    expect(empty.openIds).toEqual([]);
    const first = reconcilePulseChatTabs(empty, ['alex', 'blair']);
    expect(first.openIds).toEqual(['alex']);
    expect(first.activeId).toBe('alex');
    const closed = closePulseChatTab(first, 'alex');
    expect(closed.openIds).toEqual([]);
    expect(closed.activeId).toBeNull();
    expect(reconcilePulseChatTabs(closed, ['alex', 'blair'])).toEqual(closed);
  });

  it('switches among multiple chats and closes only the targeted tab', () => {
    const { createPulseChatTabs, openPulseChatTab, closePulseChatTab } = tabsModel();
    const first = openPulseChatTab(createPulseChatTabs(null), 'alex');
    const second = openPulseChatTab(first, 'blair');
    expect(second).toMatchObject({ openIds: ['alex', 'blair'], activeId: 'blair' });
    const switchBack = openPulseChatTab(second, 'alex');
    expect(switchBack.openIds).toEqual(['alex', 'blair']);
    expect(switchBack.activeId).toBe('alex');
    const closeBackground = closePulseChatTab(switchBack, 'blair');
    expect(closeBackground.openIds).toEqual(['alex']);
    expect(closeBackground.activeId).toBe('alex');
    const closeActive = closePulseChatTab(second, 'blair');
    expect(closeActive).toMatchObject({ openIds: ['alex'], activeId: 'alex' });
  });

  it('drops departed/inaccessible buddies without resurrecting stale tabs or leaking another account', () => {
    const { createPulseChatTabs, openPulseChatTab, reconcilePulseChatTabs } = tabsModel();
    const tabs = openPulseChatTab(openPulseChatTab(createPulseChatTabs(null), 'alex'), 'blair');
    const pruned = reconcilePulseChatTabs(tabs, ['alex', 'casey']);
    expect(pruned).toMatchObject({ openIds: ['alex'], activeId: 'alex' });
    expect(reconcilePulseChatTabs(pruned, ['alex', 'casey'])).toBe(pruned);
    expect(createPulseChatTabs(null)).toMatchObject({ openIds: [], activeId: null });
  });

  it('offers real, separately focusable switch and close controls with accessible labels', () => {
    const markup = renderToStaticMarkup(React.createElement(ChatTabHeader, {
      openBuddyIds: ['alex', 'blair'],
      activeBuddyId: 'alex',
      buddies: { alex: { id: 'alex', displayName: 'Alex' }, blair: { id: 'blair', displayName: 'Blair' } } as never,
      unreadCounts: { blair: 3 },
      onSelectTab: () => {},
      onCloseTab: () => {},
    }));
    expect(markup).toContain('aria-label="Open conversations"');
    expect(markup).toContain('aria-label="Switch to Blair"');
    expect(markup).toContain('aria-label="Close conversation with Blair"');
    expect(markup).toContain('3 unread');
  });

  it('shows a classic 2005 IM transcript with inline colored speaker names, not opposing chat bubbles', () => {
    const markup = renderToStaticMarkup(React.createElement(PulseChatPane, {
      contact: { actorId: 'alex', displayName: 'Alex', handle: 'alex05',
        status: 'online', awayMessage: '', unread: 0, lastMessageMinute: null },
      accountName: 'nightowl06',
      page: {
        conversationId: 'pulse:nightowl06:alex', total: 2, hasOlder: false,
        messages: [
          { id: 'one', senderId: 'player', text: 'hello', timestampMinute: 600, day: 1 },
          { id: 'two', senderId: 'alex', text: 'hey there :)', timestampMinute: 613, day: 1 },
        ],
      } as unknown as SimulationConversationRead,
      pageOffset: 0, latestUnread: 0, loading: false, choices: [], choicesLoading: false,
      phase: 'complete', replyActivity: 'idle', sending: false,
      pendingChoiceIndex: null, compact: false, scrollToLatestSignal: 0,
      onOlder: () => {}, onNewer: () => {}, onNewest: () => {}, onChoose: () => {},
      onJumpToLatest: () => {},
    }));
    expect(markup).toContain('data-pulse-transcript-style="classic"');
    expect(markup).toContain('data-sender="player"');
    expect(markup).toContain('data-sender="buddy"');
    expect(markup).toContain('nightowl06:');
    expect(markup).toContain('Alex:');
    expect(markup).not.toContain('justify-end');
  });
});
