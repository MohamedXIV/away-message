import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { emptyScenarioState } from '../../src/engine/scenario/ScenarioState';
import type { ScenarioDefinition } from '../../src/engine/scenario/types';

function hiddenThread(): ScenarioDefinition {
  return {
    id: 'projection_probe',
    tags: ['test'],
    eligibility: {
      requiredWorldTags: [],
      excludedWorldTags: [],
      selectionWeight: 1,
      exclusiveGroup: '',
    },
    roles: [{
      id: 'unknown_contact',
      required: true,
      allowSharedActor: false,
      actorRolesAny: ['canal-regular'],
      actorTagsAll: [],
      actorTagsNone: [],
      reachesAny: ['local'],
    }],
    initialFacts: [],
    hooks: [{
      id: 'contact_nearby',
      kind: 'bound_actor_colocated',
      roleId: 'unknown_contact',
      factKey: '',
      oneShot: true,
      presentationCue: 'familiar_face_nearby',
    }],
    presentation: {
      titleKey: 'scenario.projection_probe.title',
      summaryKey: 'scenario.projection_probe.summary',
      hiddenUntilHookId: 'contact_nearby',
    },
  };
}

describe('knowledge-safe ScenarioProjection (#147)', () => {
  it('keeps hidden identity and presentation data private until canonical knowledge permits it', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    const definition = hiddenThread();
    const [instance] = engine.initializeScenarios([definition], 'projection-seed');
    expect(instance?.bindings.unknown_contact).toBe('nora');

    const beforeScenario = engine.getScenarioState();
    const beforeSocial = engine.social.getState();
    const [projection] = engine.getScenarioProjection(
      { colocatedActorIds: ['nora'] },
      [definition],
    );

    expect(projection?.presentationState).toBe('hidden');
    expect(projection?.titleKey).toBeNull();
    expect(projection?.summaryKey).toBeNull();
    expect(projection?.roles).toEqual([{ roleId: 'unknown_contact', actor: null }]);
    expect(projection?.availableHooks).toEqual([{
      id: 'contact_nearby',
      presentationCue: 'familiar_face_nearby',
      roleId: 'unknown_contact',
      actor: null,
    }]);
    expect(engine.getScenarioState()).toEqual(beforeScenario);
    expect(engine.social.getState()).toEqual(beforeSocial);
  });

  it('reveals only canonical known identity and never projects location/job/relationship truth', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    const definition = hiddenThread();
    const [instance] = engine.initializeScenarios([definition], 'projection-known');
    expect(instance).toBeDefined();
    engine.social.learnHandle('nora', 'nora');

    const [known] = engine.getScenarioProjection({ colocatedActorIds: ['nora'] }, [definition]);
    expect(known?.roles[0]?.actor).toEqual({
      id: 'nora',
      displayName: 'Nora',
      knownHandles: ['nora'],
    });
    expect(known?.availableHooks[0]?.actor?.id).toBe('nora');
    expect(known?.roles[0]?.actor).not.toHaveProperty('location');
    expect(known?.roles[0]?.actor).not.toHaveProperty('job');
    expect(known?.roles[0]?.actor).not.toHaveProperty('relationship');
    expect(known).not.toHaveProperty('address');

    expect(engine.consumeScenarioHook(instance!.id, 'contact_nearby', [definition])).toBe(true);
    const [visible] = engine.getScenarioProjection({}, [definition]);
    expect(visible?.presentationState).toBe('active');
    expect(visible?.titleKey).toBe('scenario.projection_probe.title');
    expect(visible?.summaryKey).toBe('scenario.projection_probe.summary');
  });

  it('requires no visible Scenario UI and cleanly projects zero scenarios', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    expect(engine.getScenarioProjection({})).toEqual([]);
  });
});
