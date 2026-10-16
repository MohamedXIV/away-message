import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { emptyScenarioState } from '../../src/engine/scenario/ScenarioState';
import { GENERATED_SCENARIOS } from '../../src/engine/scenarioContent.generated';

const POSITION_A = { x: 20, y: 60, z: 0 };
const POSITION_SAME_PLACE = { x: 21, y: 60, z: 0 };

function capture(game: SimulationEngine) {
  const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
  const stop = game.subscribeChanges(change => changes.push(change));
  changes.length = 0;
  return { changes, stop };
}

describe('#172 direct spatial, story and Inner Voice mutation attribution', () => {
  it('observes within-place XYZ changes without emitted containment transitions, but not repeat or invalid moves', () => {
    const game = new SimulationEngine();
    const seen = capture(game);
    const whole = vi.spyOn(game, 'getState');
    const start = game.getRevision();

    game.relocateActorSpatially('player', POSITION_A);
    game.relocateActorSpatially('player', POSITION_SAME_PLACE);
    expect(seen.changes).toHaveLength(2);
    expect(seen.changes.map(change => change.revision)).toEqual([start + 1, start + 2]);
    expect(seen.changes[1]!.changedDomains).toEqual(expect.arrayContaining(['transit', 'unknown']));
    expect(game.getActorSpatialProjection('player')?.membership.placeId).toBe('place_a1');
    game.relocateActorSpatially('player', POSITION_SAME_PLACE);
    expect(seen.changes).toHaveLength(2);
    expect(() => game.relocateActorSpatially('player', { x: Number.NaN, y: 1, z: 0 })).toThrow();
    expect(seen.changes).toHaveLength(2);
    expect(whole).not.toHaveBeenCalled();

    game.clearActorSpatialForTravel('player');
    expect(seen.changes).toHaveLength(3);
    expect(seen.changes.at(-1)!.changedDomains).toEqual(expect.arrayContaining(['transit', 'unknown']));
    game.clearActorSpatialForTravel('player');
    expect(seen.changes).toHaveLength(3);
    expect(game.getActorSpatialProjection('player')).toBeNull();
    seen.stop();
  });

  it('keeps authored entry relocation silent on missing place and idempotent on repeated entry', () => {
    const game = new SimulationEngine();
    const seen = capture(game);
    expect(game.relocateActorToGeneratedPlaceEntry('player', 'missing:entry')).toBe(false);
    expect(seen.changes).toHaveLength(0);
    expect(game.relocateActorToGeneratedPlaceEntry('player', 'place_b1')).toBe(true);
    expect(seen.changes).toHaveLength(1);
    expect(game.relocateActorToGeneratedPlaceEntry('player', 'place_b1')).toBe(true);
    expect(seen.changes).toHaveLength(1);
    seen.stop();
  });

  it('publishes Scenario instance state changes and no false dirty domains on repeated/no-op lifecycle writes', () => {
    const game = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    const seen = capture(game);
    const broad = vi.spyOn(game, 'getState');
    const created = game.initializeScenarios(GENERATED_SCENARIOS, 'pub-attribution-seed', 3);
    expect(created.length).toBeGreaterThan(0);
    expect(seen.changes).toHaveLength(1);
    expect(seen.changes[0]!.changedDomains).toEqual(expect.arrayContaining(['scenario', 'unknown']));

    const instance = created[0]!;
    const changed = game.setScenarioLifecycle(instance.id, 'dormant');
    expect(changed).toBe(true);
    expect(seen.changes).toHaveLength(2);
    expect(game.setScenarioLifecycle(instance.id, 'dormant')).toBe(true);
    expect(seen.changes).toHaveLength(2);
    expect(game.setScenarioLifecycle('no-instance', 'resolved')).toBe(false);
    expect(seen.changes).toHaveLength(2);

    expect(game.initializeScenarios(GENERATED_SCENARIOS, 'pub-attribution-seed', 3)).toEqual([]);
    expect(seen.changes).toHaveLength(2);
    expect(game.getScenarioState().instances[instance.id]?.lifecycle).toBe('dormant');
    expect(broad).not.toHaveBeenCalled();
    seen.stop();
  });

  it('publishes accepted and dismissed Inner Voice thought but not rejected cooldown or empty dismissal', () => {
    const game = new SimulationEngine();
    const seen = capture(game);
    const getState = vi.spyOn(game, 'getState');
    const thought = {
      kind: 'street_detail' as const,
      topic: 'evening light',
      semanticMeaning: 'the sun catches the curtains briefly',
      tone: 'curious' as const,
      source: 'world:room',
      knowledgeRefs: ['visible:place:room104'],
      cooldownKey: 'test:evening',
      presentation: 'ambient' as const,
      knowledge: { visiblePlaceId: 'room104' },
    };
    const first = game.requestInnerThought(thought, 420);
    expect(first).not.toBeNull();
    expect(seen.changes).toHaveLength(1);
    expect(seen.changes[0]!.changedDomains).toEqual(['innerVoice', 'unknown']);
    expect(game.requestInnerThought(thought, 425)).toBeNull();
    expect(seen.changes).toHaveLength(1);
    game.dismissInnerThought();
    expect(seen.changes).toHaveLength(2);
    expect(seen.changes[1]!.changedDomains).toEqual(expect.arrayContaining(['innerVoice', 'unknown']));
    game.dismissInnerThought();
    expect(seen.changes).toHaveLength(2);
    expect(getState).not.toHaveBeenCalled();
    seen.stop();
  });
});
