import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { getAllReleases } from '../../src/engine/OsCatalog';
import { ProceduralDirector } from '../../src/engine/ProceduralDirector';
import { ProceduralWorldCycle } from '../../src/engine/kernel/ProceduralWorldCycle';

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
    const first = await game.generateProceduralEvents(options);
    expect(first.injectedIds.length).toBeGreaterThan(0);
    expect(first.events.map(event => event.id)).toEqual(first.injectedIds);
    expect(first.injectedIds.some(id => beforePending.has(id))).toBe(false);
    expect(game.getRevision()).toBe(before + 1);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.domains).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(JSON.parse(JSON.stringify(revisions))).toEqual(revisions);
    expect(broad).not.toHaveBeenCalled();

    // Director may intentionally rename repeat seeds to unique IDs; test
    // idempotency at the actual owner-commit boundary, not content authoring.
    expect(game.commitLabProceduralEvents(first.events)).toEqual([]);
    expect(game.commitLabProceduralEvents([{
      ...first.events[0]!, id: 'NOT VALID AS WORLD ID',
    }])).toEqual([]);
    expect(game.getRevision()).toBe(before + 1);
    expect(revisions).toHaveLength(1);
    stop();
  });

  it('discards a Lab generation response after a save is loaded', async () => {
    const game = new SimulationEngine();
    const snapshot = game.exportSnapshot();
    const beforeIds = game.world.getPendingEvents().map(event => event.id);
    const pending = game.generateProceduralEvents({
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

  it('keeps the legacy store entrypoint on the same one-revision generation boundary', async () => {
    const game = new SimulationEngine();
    const events: Array<readonly string[]> = [];
    const stop = game.subscribeChanges(change => events.push(change.changedDomains));
    events.length = 0;
    const full = vi.spyOn(game, 'getState');
    const before = game.getRevision();
    const created = await game.generateProceduralEventsNow({ maxEvents: 2, useAI: false });
    expect(created.length).toBeGreaterThan(0);
    expect(game.getRevision()).toBe(before + 1);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.arrayContaining(['world', 'unknown']));
    expect(full).not.toHaveBeenCalled();
    stop();
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
  it('drops an in-flight automatic procedural generation after loading a different world', async () => {
    const game = new SimulationEngine();
    const saved = game.world.getState();
    const before = game.world.getPendingEvents().map(event => event.id);
    type Batch = Awaited<ReturnType<ProceduralDirector['generateNextBatch']>>;
    let complete!: (result: Batch) => void;
    const deferred = new Promise<Batch>(resolve => { complete = resolve; });
    const generate = vi.spyOn(ProceduralDirector.prototype, 'generateNextBatch')
      .mockReturnValue(deferred);
    let notifications = 0;
    const cycle = new ProceduralWorldCycle(
      { clock: game.clock, world: game.world, social: game.social },
      () => false,
      () => { notifications++; },
    );
    // The fixture world ships with enough authored pending events that the
    // automatic generator correctly skips work. Open only the scheduling gate
    // once, without altering canonical pending/triggered state.
    const emptyGate = vi.spyOn(game.world, 'getPendingEvents').mockReturnValueOnce([]);
    try {
      cycle.processNewDay(1);
      await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
      expect(generate.mock.calls[0]![2]).toMatchObject({ inject: false });
      game.world.loadState(saved);
      const event = game.world.getPendingEvents()[0]!;
      complete({
        events: [{ ...event, id: 'stale_autoworld_batch_172', isTriggered: false }],
        injectedIds: [],
        meta: { source: 'template', latencyMs: 0 },
      });
      await vi.waitFor(() => {
        expect(game.world.getPendingEvents().map(entry => entry.id)).toEqual(before);
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(notifications).toBe(0);
      expect(game.world.getPendingEvents().some(entry => entry.id === 'stale_autoworld_batch_172')).toBe(false);
    } finally {
      emptyGate.mockRestore();
      generate.mockRestore();
    }
  });

});
