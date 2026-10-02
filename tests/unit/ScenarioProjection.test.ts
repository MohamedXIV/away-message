import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ScenarioDirector } from '../../src/engine/scenario/ScenarioDirector';
import { emptyScenarioState } from '../../src/engine/scenario/ScenarioState';
import { projectScenarios } from '../../src/engine/scenario/ScenarioProjection';
import { GENERATED_SCENARIOS } from '../../src/engine/scenarioContent.generated';

function definition(id: string) {
  const found = GENERATED_SCENARIOS.find((scenario) => scenario.id === id);
  if (!found) throw new Error(`Missing generated scenario: ${id}`);
  return found;
}

function knowledge(social: SocialEngine) {
  return {
    isActorKnown: (actorId: string) => social.isKnown(actorId),
    getActorPresentation: (actorId: string) => {
      const actor = social.getBuddy(actorId);
      return actor ? { id: actor.id, displayName: actor.displayName, handle: actor.handle } : null;
    },
  };
}

describe('ScenarioProjection player-safe read boundary (#147)', () => {
  it('keeps a hidden thread fully opaque even when its bound actor is independently known', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const scenario = definition('someone_from_before');
    director.initialize([scenario], { seed: 'hidden-proof', maxInstances: 1 });

    expect(social.isKnown('nora')).toBe(true);
    const projection = projectScenarios({
      definitions: [scenario],
      state: director.getState(),
      availableHooks: director.getAvailableHooks([scenario], {}),
      knowledge: knowledge(social),
    });

    expect(projection).toHaveLength(1);
    expect(projection[0]?.state).toBe('hidden');
    expect(projection[0]?.titleKey).toBeNull();
    expect(projection[0]?.summaryKey).toBeNull();
    expect(projection[0]?.roles[0]?.actor).toBeNull();
    expect(projection[0]?.availableHooks).toEqual([]);
  });

  it('reveals only canonical-known identity once a safe authored hook makes the thread visible', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const scenario = definition('someone_from_before');
    director.initialize([scenario], { seed: 'visible-known', maxInstances: 1 });

    const availableHooks = director.getAvailableHooks([scenario], {
      searchTerms: ['old username'],
    });
    const projection = projectScenarios({
      definitions: [scenario],
      state: director.getState(),
      availableHooks,
      knowledge: knowledge(social),
    });

    expect(projection[0]?.state).toBe('active');
    expect(projection[0]?.titleKey).toBe('scenario.someone_from_before.title');
    expect(projection[0]?.roles[0]?.actor).toMatchObject({ id: 'nora', displayName: 'Nora' });
    expect(projection[0]?.availableHooks.map((hook) => hook.id)).toContain('old_handle_search');
  });

  it('does not leak an unknown bound actor or private canonical domain state', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const scenario = definition('old_debt');
    director.initialize([scenario], { seed: 'visible-unknown', maxInstances: 1 });

    expect(social.isKnown('ryan')).toBe(false);
    const projection = projectScenarios({
      definitions: [scenario],
      state: director.getState(),
      availableHooks: director.getAvailableHooks([scenario], {
        searchTerms: ['old debt'],
      }),
      knowledge: knowledge(social),
    });

    expect(projection[0]?.state).toBe('active');
    expect(projection[0]?.roles[0]?.actor).toBeNull();
    expect(projection[0]?.availableHooks[0]?.actor).toBeNull();

    const serialized = JSON.stringify(projection);
    expect(serialized).not.toContain('"ryan"');
    expect(serialized).not.toContain('relationship');
    expect(serialized).not.toContain('location');
    expect(serialized).not.toContain('job');
    expect(serialized).not.toContain('address');
  });

  it('restores an exact persisted Scenario set without selecting newly-authored threads on loadSnapshot', () => {
    const engine = new SimulationEngine();
    expect(Object.keys(engine.getScenarioState().instances).length).toBeGreaterThan(0);

    const snapshot = structuredClone(engine.exportSnapshot());
    snapshot.scenarios = emptyScenarioState();
    engine.loadSnapshot(snapshot as never);

    expect(engine.getScenarioState()).toEqual(emptyScenarioState());
  });
});
