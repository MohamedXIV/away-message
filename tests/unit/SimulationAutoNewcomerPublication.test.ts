import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { generateNewcomer, shouldAutoDiscover } from '../../src/engine/CharacterDirector';
import { ProceduralWorldCycle } from '../../src/engine/kernel/ProceduralWorldCycle';

const eligibleDay = Array.from({ length: 100 }, (_, index) => index + 6)
  .find(day => shouldAutoDiscover(day, 0))!;

describe('#172 automatic newcomer publication', () => {
  it('atomically publishes Social, MyPlace, public NightBoard trace and world throttle', async () => {
    const game = new SimulationEngine();
    const candidate = await generateNewcomer(
      { metVia: 'nightboard', day: eligibleDay, seed: 'auto-publication-172', useAI: false },
      { existingIds: game.social.getBuddies().map(buddy => buddy.id) },
    );
    const revisions: Array<readonly string[]> = [];
    const unsubscribe = game.subscribeChanges(change => revisions.push(change.changedDomains));
    revisions.length = 0;
    const full = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const initialRevision = game.getRevision();
    expect(game.commitAutoDiscoveredNewcomer(
      candidate.definition, candidate.introText, 'nightboard', eligibleDay,
    )).toBe(true);
    expect(game.getRevision()).toBe(initialRevision + 1);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toEqual(expect.arrayContaining(['social', 'world', 'myplace', 'unknown']));
    expect(game.social.getBuddy(candidate.definition.id)?.id).toBe(candidate.definition.id);
    expect(game.world.getFlag('newcomer_last_day')).toBe(eligibleDay);
    expect(game.world.getPendingEvents().some(event => event.id === `met_${candidate.definition.id}`)).toBe(true);
    expect(JSON.parse(JSON.stringify(revisions))).toEqual(revisions);
    expect(full).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();

    // Same generated candidate must not emit another revision or modify throttle.
    expect(game.commitAutoDiscoveredNewcomer(
      candidate.definition, candidate.introText, 'nightboard', eligibleDay + 1,
    )).toBe(false);
    expect(game.getRevision()).toBe(initialRevision + 1);
    expect(game.world.getFlag('newcomer_last_day')).toBe(eligibleDay);
    expect(revisions).toHaveLength(1);
    unsubscribe();
  });

  it('suppresses concurrent discovery and drops a stale AI result after reloading a save', async () => {
    const game = new SimulationEngine();
    const candidate = await generateNewcomer(
      { metVia: 'nightboard', day: eligibleDay, seed: 'auto-stale-172', useAI: false },
      { existingIds: game.social.getBuddies().map(buddy => buddy.id) },
    );
    type Generated = Awaited<ReturnType<typeof generateNewcomer>>;
    let resolve!: (value: Generated) => void;
    const delayed = new Promise<Generated>(done => { resolve = done; });
    const create = vi.fn(() => delayed);
    let attempted = 0;
    const register = (buddy: Generated['definition'], introText: string,
      metVia: Generated['definition']['metVia'], day: number) => {
      attempted++;
      return game.commitAutoDiscoveredNewcomer(buddy, introText, metVia ?? 'nightboard', day);
    };
    const cycle = new ProceduralWorldCycle(
      { world: game.world, social: game.social, clock: game.clock },
      register,
      () => {},
      create,
    );
    cycle.processNewDay(eligibleDay);
    expect(create).toHaveBeenCalledTimes(1);
    cycle.processNewDay(eligibleDay + 1);
    expect(create).toHaveBeenCalledTimes(1);

    const snapshot = game.exportSnapshot();
    game.loadSnapshot(snapshot);
    const loadedRevision = game.getRevision();
    resolve(candidate);
    await new Promise(done => setTimeout(done, 0));
    expect(attempted).toBe(0);
    expect(game.getRevision()).toBe(loadedRevision);
    expect(game.social.getBuddy(candidate.definition.id)).toBeUndefined();
    expect(game.world.getFlag('newcomer_last_day')).toBeUndefined();

    const createFresh = vi.fn(async () => candidate);
    const newCycle = new ProceduralWorldCycle(
      { world: game.world, social: game.social, clock: game.clock },
      register,
      () => {},
      createFresh,
    );
    newCycle.processNewDay(eligibleDay);
    await vi.waitFor(() => expect(attempted).toBe(1));
    expect(game.getRevision()).toBe(loadedRevision + 1);
    expect(game.social.getBuddy(candidate.definition.id)?.id).toBe(candidate.definition.id);
    expect(game.world.getFlag('newcomer_last_day')).toBe(eligibleDay);
  });
});
