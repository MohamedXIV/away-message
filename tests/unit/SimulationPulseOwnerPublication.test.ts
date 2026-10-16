import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 Pulse direct-owner mutations and focused profile reads', () => {
  it('publishes and persists custom player away presence in canonical Social state', () => {
    const game = new SimulationEngine();
    const events: string[] = [];
    const off = game.events.on('social:status_changed', ({ buddyId }) => events.push(buddyId));
    const old = game.getRevision();
    const full = vi.spyOn(game, 'getState');
    game.social.setPlayerPresence({
      status: 'away', awayMessage: 'BRB real life', customAwayMessage: 'BRB real life',
    });
    game.publishExternalChange();
    expect(game.getRevision()).toBe(old + 1);
    expect(events.at(-1)).toBe('player');
    expect(game.getPresenceRead().presence.player?.status).toBe('away');
    expect(game.getPresenceRead().presence.player?.awayMessage).toBe('BRB real life');
    expect(full).not.toHaveBeenCalled();

    const snapshot = game.exportSnapshot(); // explicit persistence boundary
    expect(snapshot.social.presence.player?.awayMessage).toBe('BRB real life');
    const restored = new SimulationEngine(snapshot);
    expect(restored.social.getPresence('player')?.awayMessage).toBe('BRB real life');
    restored.social.setPlayerPresence({ status: 'online', awayMessage: '' });
    expect(restored.social.getPresence('player')?.status).toBe('online');
    off();
    full.mockRestore();
  });

  it('a profile read accesses one buddy only, never serializing all Social/World state', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const unrelated = game.social.getBuddies()[1]!;
    game.social.addCoreMemory(unrelated.id, {
      id: 'unrelated_secret', kind: 'shared_photo',
      text: 'SECRET_ONLY_OTHER_BUDDY', day: 1,
    });
    const giant = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const world = vi.spyOn(game.world, 'getState');
    const read = game.getPulseProfileRead(actor.id);
    expect(JSON.stringify(read)).not.toContain('SECRET_ONLY_OTHER_BUDDY');
    expect(read.photoMemories.every(memory => memory.kind === 'shared_photo')).toBe(true);
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(giant).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();
  });
});
