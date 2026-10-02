import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ScenarioDirector } from '../../src/engine/scenario/ScenarioDirector';
import { emptyScenarioState } from '../../src/engine/scenario/ScenarioState';
import type { ScenarioDefinition } from '../../src/engine/scenario/types';

function someoneFromBefore(): ScenarioDefinition {
  return {
    id: 'someone_from_before',
    tags: ['personal-history'],
    eligibility: {
      requiredWorldTags: [],
      excludedWorldTags: [],
      selectionWeight: 1,
      exclusiveGroup: '',
    },
    roles: [{
      id: 'old_acquaintance',
      required: true,
      allowSharedActor: false,
      actorRolesAny: ['canal-regular'],
      actorTagsAll: ['local'],
      actorTagsNone: [],
      reachesAny: ['local'],
    }],
    initialFacts: [
      {
        id: 'old_familiarity',
        kind: 'social_history',
        roleId: 'old_acquaintance',
        factKey: 'familiarity',
        value: 35,
        sourceRef: 'scenario:someone_from_before',
      },
      {
        id: 'remembered_account',
        kind: 'player_knowledge',
        roleId: 'old_acquaintance',
        factKey: 'bound_actor_handle',
        value: true,
        sourceRef: 'scenario:someone_from_before',
      },
      {
        id: 'origin',
        kind: 'scenario_fact',
        roleId: '',
        factKey: 'origin',
        value: 'nearby_village',
        sourceRef: 'scenario:someone_from_before',
      },
    ],
    hooks: [],
  };
}

describe('Scenario dynamic role binding + initialization (#144)', () => {
  it('binds a semantic role to a compatible non-Maya actor and writes canonical Social/knowledge truth', () => {
    const social = new SocialEngine(new EventBus());
    social.removeBuddy('maya');
    const director = new ScenarioDirector(social);

    const [instance] = director.initialize([someoneFromBefore()], {
      seed: 'save-alpha',
      atMinute: 120,
    });

    expect(instance).toBeDefined();
    const bound = instance!;
    expect(bound.bindings.old_acquaintance).toBe('nora');
    expect(bound.bindings.old_acquaintance).not.toBe('maya');
    expect(social.getRelationships('nora')?.familiarity).toBeGreaterThanOrEqual(35);
    expect(social.isKnown('nora')).toBe(true);
    expect(bound.facts).toEqual({ origin: 'nearby_village' });
    expect(bound.facts).not.toHaveProperty('familiarity');
    expect(bound.facts).not.toHaveProperty('known_handle');
  });

  it('resolves role conflicts deterministically and allows optional roles to remain unbound', () => {
    const social = new SocialEngine(new EventBus());
    const definition: ScenarioDefinition = {
      ...someoneFromBefore(),
      id: 'two_roles',
      roles: [
        {
          id: 'required_local',
          required: true,
          allowSharedActor: false,
          actorRolesAny: ['landlord'],
          actorTagsAll: [],
          actorTagsNone: [],
          reachesAny: ['local'],
        },
        {
          id: 'optional_same_pool',
          required: false,
          allowSharedActor: false,
          actorRolesAny: ['landlord'],
          actorTagsAll: [],
          actorTagsNone: [],
          reachesAny: ['local'],
        },
      ],
      initialFacts: [],
    };
    const director = new ScenarioDirector(social);
    const [instance] = director.initialize([definition], { seed: 'conflict-seed' });

    expect(instance).toBeDefined();
    expect(instance!.bindings.required_local).toBe('henderson');
    expect(instance!.bindings.optional_same_pool).toBeNull();
  });

  it('records failed required binding so reload/time advancement cannot reroll it', () => {
    const social = new SocialEngine(new EventBus());
    const impossible: ScenarioDefinition = {
      ...someoneFromBefore(),
      id: 'impossible_history',
      roles: [{
        id: 'missing_person',
        required: true,
        allowSharedActor: false,
        actorRolesAny: ['role-that-does-not-exist'],
        actorTagsAll: [],
        actorTagsNone: [],
        reachesAny: ['local'],
      }],
      initialFacts: [],
    };
    const first = new ScenarioDirector(social);
    expect(first.initialize([impossible], { seed: 'first' })).toEqual([]);
    expect(first.getState().attemptedDefinitionIds).toEqual(['impossible_history']);

    const restored = new ScenarioDirector(social, first.getState());
    expect(restored.initialize([impossible], { seed: 'different-seed', atMinute: 50_000 })).toEqual([]);
    expect(restored.getState().instances).toEqual({});
  });

  it('persists bindings through the current SimulationEngine snapshot seam', () => {
    const engine = new SimulationEngine({ scenarios: emptyScenarioState() } as never);
    engine.social.removeBuddy('maya');
    const probe = { ...someoneFromBefore(), id: 'binding_snapshot_probe' };
    const [created] = engine.initializeScenarios([probe], 'snapshot-seed');
    expect(created).toBeDefined();
    expect(created!.bindings.old_acquaintance).toBe('nora');

    const snapshot = engine.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    const before = restored.getScenarioState();
    expect(restored.initializeScenarios([probe], 'different-seed')).toEqual([]);
    expect(restored.getScenarioState()).toEqual(before);
    expect(restored.social.getRelationships('nora')?.familiarity).toBeGreaterThanOrEqual(35);
    expect(restored.social.isKnown('nora')).toBe(true);
  });
});
