import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 bounded desktop chrome and unread tray', () => {
  it('keeps an exact badge with only four newest unread previews and no world snapshot', () => {
    const game = new SimulationEngine();
    const [a, b] = game.social.getBuddies().slice(0, 2);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const full = vi.spyOn(game, 'getState');
    const snapshot = vi.spyOn(game, 'exportSnapshot');
    const received: string[] = [];
    const off = game.events.on('social:message_received', ({ message }) => received.push(message.id));
    for (let i = 0; i < 12; i++) {
      const actor = i % 2 === 0 ? a! : b!;
      game.social.sendMessage(actor.id, actor.id, 'player', 'hello-' + i, 480 + i);
    }
    game.social.sendMessage(a!.id, 'player', a!.id, 'player outbound', 500);
    game.publishExternalChange();

    const result = game.getChromeRead();
    expect(result.revision).toBe(game.getRevision());
    expect(result.unreadCount).toBe(12);
    expect(result.unreadPreviews).toHaveLength(4);
    expect(result.unreadPreviews.map(m => m.text)).toEqual([
      'hello-11', 'hello-10', 'hello-9', 'hello-8',
    ]);
    expect(received).toHaveLength(13);
    expect(result.osVersion).toBe(game.os.getCurrentOsId());
    expect(result.connectionSpeedKbps).toBe(game.hardware.getState().connectionSpeedKbps);
    expect(full).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();

    const detached = game.getChromeRead();
    detached.unreadPreviews[0]!.text = 'forged';
    expect(game.getChromeRead().unreadPreviews[0]?.text).toBe('hello-11');
    game.social.markAsRead(a!.id);
    game.publishExternalChange();
    expect(game.getChromeRead().unreadCount).toBe(6);
    expect(game.getChromeRead().unreadPreviews.every(m => m.buddyId === b!.id)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    off();
    full.mockRestore();
    snapshot.mockRestore();
  });

  it('does not grow serialized desktop chrome with NPC population or full chat histories', () => {
    for (const population of [20, 100, 250, 500]) {
      const fixture = createSimulationBenchmarkFixture(population);
      const game = fixture.engine;
      const spy = vi.spyOn(game, 'getState');
      for (let i = 0; i < 55; i++) {
        const actorId = fixture.actorIds[i % fixture.actorIds.length]!;
        game.social.sendMessage(actorId, actorId, 'player', 'inbox-' + i, 480 + i);
      }
      const chrome = game.getChromeRead();
      const bytes = JSON.stringify(chrome).length;
      expect(chrome.unreadCount).toBe(55);
      expect(chrome.unreadPreviews).toHaveLength(4);
      expect(bytes).toBeLessThan(3000);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
