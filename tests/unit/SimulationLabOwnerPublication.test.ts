import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { getAllReleases } from '../../src/engine/OsCatalog';

describe('#172 AI Lab source-backed world and OS publication', () => {
  it('commits only genuinely new procedural events and publishes one world revision', async () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const revisions: Array<{ revision: number; domains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => revisions.push({
      revision: change.revision, domains: change.changedDomains,
    }));
    revisions.length = 0;
    const before = game.getRevision();
    const beforePending = new Set(game.world.getPendingEvents().map(event => event.id));
    const options = { worldSeed: 'lab-bounded-172', maxEvents: 2, useAI: false };
    const first = await game.generateLabProceduralEvents(options);
    expect(first.injectedIds.length).toBeGreaterThan(0);
    expect(first.events.map(event => event.id)).toEqual(first.injectedIds);
    expect(first.injectedIds.some(id => beforePending.has(id))).toBe(false);
    expect(game.getRevision()).toBe(before + 1);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.domains).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(JSON.parse(JSON.stringify(revisions))).toEqual(revisions);
    expect(broad).not.toHaveBeenCalled();

    const repeated = await game.generateLabProceduralEvents(options);
    expect(repeated.injectedIds).toEqual([]);
    expect(repeated.events).toEqual([]);
    expect(game.getRevision()).toBe(before + 1);
    expect(revisions).toHaveLength(1);
    stop();
  });

  it('discards a Lab generation response after a save is loaded', async () => {
    const game = new SimulationEngine();
    const snapshot = game.exportSnapshot();
    const beforeIds = game.world.getPendingEvents().map(event => event.id);
    const pending = game.generateLabProceduralEvents({
      worldSeed: 'stale-lab-172', maxEvents: 2, useAI: false,
    });
    game.loadSnapshot(snapshot);
    const revisionAfterLoad = game.getRevision();
    const result = await pending;
    expect(result.events).toEqual([]);
    expect(result.injectedIds).toEqual([]);
    expect(game.world.getPendingEvents().map(event => event.id)).toEqual(beforeIds);
    expect(game.getRevision()).toBe(revisionAfterLoad);
  });

  it('commits OS release and public news once, and rejects duplicate IDs without publishing', () => {
    const game = new SimulationEngine();
    const base = getAllReleases()[0]!;
    const release = {
      ...base,
      id: 'lab_bounded_os_172',
      version: '9.172',
      build: '9.172.1',
      displayName: 'Lab Bounded OS',
      releaseDay: 6,
      isProcedural: true,
    } as typeof base;
    const seen: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => seen.push(change.changedDomains));
    seen.length = 0;
    const before = game.getRevision();
    const broad = vi.spyOn(game, 'getState');
    expect(game.registerLabOsRelease(release).id).toBe(release.id);
    expect(game.getRevision()).toBe(before + 1);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(expect.arrayContaining(['os', 'world', 'unknown']));
    expect(game.world.getPendingEvents().some(event => event.id === 'os_lab_bounded_os_172')).toBe(true);
    expect(broad).not.toHaveBeenCalled();
    expect(() => game.registerLabOsRelease(release)).toThrow(/already exists/);
    expect(game.getRevision()).toBe(before + 1);
    expect(seen).toHaveLength(1);
    stop();
  });
});
