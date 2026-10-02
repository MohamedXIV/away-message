import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ScenarioDirector } from '../../src/engine/scenario/ScenarioDirector';
import { GENERATED_SCENARIOS } from '../../src/engine/scenarioContent.generated';
import type { ScenarioDefinition } from '../../src/engine/scenario/types';

describe('first optional authored Scenario pack (#146)', () => {
  it('ships multiple distinct families through the generated content registry', () => {
    expect(GENERATED_SCENARIOS.map((definition) => definition.id)).toEqual([
      'bad_history',
      'family_connection',
      'first_job_lead',
      'old_debt',
      'someone_from_before',
    ]);
    expect(GENERATED_SCENARIOS.length).toBeGreaterThanOrEqual(3);
  });

  it('binds Someone From Before without Maya and keeps only scenario-local facts in the instance', () => {
    const social = new SocialEngine(new EventBus());
    social.removeBuddy('maya');
    const director = new ScenarioDirector(social);
    const definition = GENERATED_SCENARIOS.find((candidate) => candidate.id === 'someone_from_before')!;

    const [instance] = director.initialize([definition], { seed: 'non-maya-proof', maxInstances: 1 });
    expect(instance).toBeDefined();
    expect(instance!.bindings.old_acquaintance).toBeTruthy();
    expect(instance!.bindings.old_acquaintance).not.toBe('maya');
    expect(instance!.facts).toEqual({ origin: 'nearby_village' });
    expect(instance!.facts).not.toHaveProperty('familiarity');
    expect(instance!.facts).not.toHaveProperty('current_address');
    expect(instance!.facts).not.toHaveProperty('current_job');
  });

  it('allows multiple compatible authored Scenarios in one save', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const created = director.initialize(GENERATED_SCENARIOS, {
      seed: 'multi-scenario-save',
      maxInstances: 3,
    });

    expect(created).toHaveLength(3);
    expect(new Set(created.map((instance) => instance.definitionId)).size).toBe(3);
  });

  it('fails an incompatible authored-style definition cleanly without forcing a named actor', () => {
    const impossible: ScenarioDefinition = {
      id: 'unavailable_specialist',
      tags: ['test'],
      eligibility: { requiredWorldTags: [], excludedWorldTags: [], selectionWeight: 1, exclusiveGroup: '' },
      roles: [{
        id: 'specialist',
        required: true,
        allowSharedActor: false,
        actorRolesAny: ['role-not-present-in-this-roster'],
        actorTagsAll: ['local'],
        actorTagsNone: [],
        reachesAny: ['local'],
      }],
      initialFacts: [],
      hooks: [],
    };
    const director = new ScenarioDirector(new SocialEngine(new EventBus()));
    expect(director.initialize([impossible], { seed: 'safe-failure' })).toEqual([]);
    expect(director.getState().attemptedDefinitionIds).toEqual(['unavailable_specialist']);
  });

  it('keeps an authored thread dormant and unresolved across persisted long-horizon state', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const definition = GENERATED_SCENARIOS.find((candidate) => candidate.id === 'old_debt')!;
    const [instance] = director.initialize([definition], { seed: 'long-thread', atMinute: 0, maxInstances: 1 });
    expect(instance).toBeDefined();
    expect(director.setLifecycle(instance!.id, 'dormant')).toBe(true);

    const afterLongTime = new ScenarioDirector(social, director.getState());
    expect(afterLongTime.getState().instances[instance!.id]?.lifecycle).toBe('dormant');
    expect(afterLongTime.getState().instances[instance!.id]?.definitionId).toBe('old_debt');
  });
});
