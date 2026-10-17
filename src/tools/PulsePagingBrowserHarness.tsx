import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWindow } from '../apps/pulse/components/ChatWindow';
import { useSimulationStore } from '../store/useSimulationStore';

/**
 * Playwright-only browser harness: the actual ChatWindow and bounded React
 * hooks, mounted outside the regular OS to avoid depending on installer/login.
 * This file is never imported into the game's production entrypoint.
 */
export function mountPulsePagingBrowserHarness(): { actorId: string; total: number; paused: boolean } {
  // The normal game ticker can deliver unsolicited NPC messages. Pin the
  // simulated clock so this browser gate tests page boundaries against a
  // fixed 125-message owner history, not an actively mutating background world.
  const store = useSimulationStore.getState();
  store.setPaused(true);
  const engine = store.engine;
  const actor = engine.social.getBuddies()[0]!;
  engine.social.learnHandle(actor.id, actor.handle);
  const baseMinute = engine.clock.getTotalMinutes();
  for (let index = 0; index < 125; index++) {
    engine.social.sendMessage(
      actor.id, actor.id, 'player',
      `PAGING_BROWSER_${String(index).padStart(3, '0')}`, baseMinute + index,
    );
  }
  engine.publishExternalChange();

  const host = document.createElement('div');
  host.id = 'pulse-paging-harness';
  Object.assign(host.style, {
    position: 'fixed', top: '12px', left: '12px',
    height: '640px', width: '760px', zIndex: '2147483646',
    background: 'white', display: 'flex', overflow: 'hidden',
  });
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(React.createElement(ChatWindow, {
    openBuddyIds: [actor.id],
    activeBuddyId: actor.id,
    buddies: { [actor.id]: actor },
    unreadCounts: {},
    onSelectTab: () => {},
    onCloseTab: () => {},
    onSendMessage: () => {},
    onSelectChoice: () => {},
  }));
  return { actorId: actor.id, total: engine.getConversationRead(actor.id, 0, 50).total, paused: engine.clock.isPaused() };
}
