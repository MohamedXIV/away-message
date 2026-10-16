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
      kind: 'shared_photo',
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

  it('atomically publishes a real group turn with its directed-address bonuses', () => {
    const game = new SimulationEngine();
    const ids = game.social.getBuddies().slice(0, 3).map(buddy => buddy.id);
    expect(ids).toHaveLength(3);
    const [a, b, c] = ids as [string, string, string];
    const beforeAB = game.social.getAffinity(a, b);
    const beforeBC = game.social.getAffinity(b, c);
    const seen: Array<{ revision: number; domains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => seen.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    seen.length = 0;
    const broad = vi.spyOn(game, 'getState');
    const socialBroad = vi.spyOn(game.social, 'getState');
    const beforeRevision = game.getRevision();

    expect(game.commitPulseRoomTurn(ids, 4, 2, [[a, b], [b, c]])).toBe(5);
    expect(game.social.getAffinity(a, b)).toBe(beforeAB + 3);
    expect(game.social.getAffinity(b, c)).toBe(beforeBC + 3);
    expect(game.getRevision()).toBe(beforeRevision + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.domains).toEqual(expect.arrayContaining(['social', 'unknown']));
    expect(JSON.parse(JSON.stringify(seen[0]))).toEqual(seen[0]);
    expect(broad).not.toHaveBeenCalled();
    expect(socialBroad).not.toHaveBeenCalled();

    // Persistence is deliberately cold/explicit; caps and affinities survive.
    const snapshot = game.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    expect(restored.social.getAffinity(a, b)).toBe(beforeAB + 3);
    expect(restored.commitPulseRoomTurn([a, b], 4, 3)).toBe(1); // cap: +3 more
    expect(restored.social.getAffinity(a, b)).toBe(beforeAB + 6);
    broad.mockRestore();
    socialBroad.mockRestore();
    stop();
  });

  it('refuses to fabricate revisions for absent, cold, or already capped room turns', () => {
    const game = new SimulationEngine();
    const [a, b] = game.social.getBuddies().slice(0, 2).map(actor => actor.id);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    const changes: number[] = [];
    const stop = game.subscribeChanges(change => changes.push(change.revision));
    changes.length = 0;
    const baseline = game.getRevision();
    expect(game.commitPulseRoomTurn([a!, b!], 5, 0)).toBe(0);
    expect(game.commitPulseRoomTurn([a!], 5, 3, [[a!, b!]])).toBe(0);
    expect(game.commitPulseRoomTurn(['absent_one', 'absent_two'], 5, 2)).toBe(0);
    expect(game.getRevision()).toBe(baseline);
    expect(changes).toHaveLength(0);

    expect(game.commitPulseRoomTurn([a!, b!], 5, 3)).toBe(1);
    expect(game.commitPulseRoomTurn([a!, b!], 5, 3)).toBe(1);
    const capped = game.getRevision();
    expect(game.commitPulseRoomTurn([a!, b!], 5, 3, [[a!, b!]])).toBe(0);
    expect(game.getRevision()).toBe(capped);
    expect(changes).toHaveLength(2);
    expect(game.commitPulseRoomTurn([a!, b!], 6, 1)).toBe(1);
    expect(game.getRevision()).toBe(capped + 1);
    stop();
  });
});
