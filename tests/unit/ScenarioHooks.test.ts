import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { ScenarioDirector } from '../../src/engine/scenario/ScenarioDirector';
import type { ScenarioDefinition } from '../../src/engine/scenario/types';

function hookDefinition(): ScenarioDefinition {
  return {
    id: 'hook_probe',
    tags: ['test'],
    eligibility: {
      requiredWorldTags: [],
      excludedWorldTags: [],
      selectionWeight: 1,
      exclusiveGroup: '',
    },
    roles: [{
      id: 'contact',
      required: true,
      allowSharedActor: false,
      actorRolesAny: ['canal-regular'],
      actorTagsAll: [],
      actorTagsNone: [],
      reachesAny: ['local'],
    }],
    initialFacts: [],
    hooks: [
      {
        id: 'learned_clue',
        kind: 'knowledge_fact',
        roleId: '',
        factKey: 'old_username_known',
        oneShot: true,
        presentationCue: 'remembered_old_username',
      },
      {
        id: 'searched_name',
        kind: 'search_term',
        roleId: '',
        factKey: 'old surname',
        oneShot: true,
        presentationCue: 'search_memory_stirred',
      },
      {
        id: 'same_place',
        kind: 'bound_actor_colocated',
        roleId: 'contact',
        factKey: '',
        oneShot: false,
        presentationCue: 'familiar_face_nearby',
      },
      {
        id: 'entered_archive',
        kind: 'player_entered_place',
        roleId: '',
        factKey: 'archive',
        oneShot: true,
        presentationCue: 'archive_memory',
      },
    ],
  };
}

describe('Scenario observation, hooks, lifecycle, and persistence (#145)', () => {
  it('derives hook eligibility from bounded canonical observations without mutating owners', () => {
    const social = new SocialEngine(new EventBus());
    const director = new ScenarioDirector(social);
    const definition = hookDefinition();
    const [instance] = director.initialize([definition], { seed: 'hooks' });
    expect(instance).toBeDefined();

    const beforeSocial = social.getState();
    const hooks = director.getAvailableHooks([definition], {
      knowledgeFacts: ['old_username_known'],
      searchTerms: ['  OLD SURNAME  '],
      playerPlaceId: 'archive',
      colocatedActorIds: ['nora'],
    });

    expect(hooks.map((hook) => hook.hookId)).toEqual([
      'entered_archive',
      'learned_clue',
      'same_place',
      'searched_name',
    ]);
    expect(hooks.find((hook) => hook.hookId === 'same_place')?.boundActorId).toBe('nora');
    expect(social.getState()).toEqual(beforeSocial);
  });

  it('dedupes one-shot consumption across ticks/reload while repeatable hooks remain derived', () => {
    const social = new SocialEngine(new EventBus());
    const definition = hookDefinition();
    const director = new ScenarioDirector(social);
    const [instance] = director.initialize([definition], { seed: 'dedupe' });
    expect(instance).toBeDefined();
    const instanceId = instance!.id;

    const observation = {
      knowledgeFacts: ['old_username_known'],
      colocatedActorIds: ['nora'],
    };
    expect(director.getAvailableHooks([definition], observation).map((hook) => hook.hookId))
      .toEqual(['learned_clue', 'same_place']);
    expect(director.consumeHook([definition], instanceId, 'learned_clue')).toBe(true);
    expect(director.consumeHook([definition], instanceId, 'learned_clue')).toBe(false);

    const restored = new ScenarioDirector(social, director.getState());
    expect(restored.getAvailableHooks([definition], observation).map((hook) => hook.hookId))
      .toEqual(['same_place']);
    expect(restored.getState().instances[instanceId]?.consumedHookIds).toEqual(['learned_clue']);
  });

  it('allows dormant unresolved threads indefinitely and resolved/abandoned threads stop surfacing hooks', () => {
    const social = new SocialEngine(new EventBus());
    const definition = hookDefinition();
    const director = new ScenarioDirector(social);
    const [instance] = director.initialize([definition], { seed: 'lifecycle', atMinute: 0 });
    const id = instance!.id;
    const observation = { knowledgeFacts: ['old_username_known'] };

    expect(director.setLifecycle(id, 'dormant')).toBe(true);
    expect(director.getAvailableHooks([definition], observation).map((hook) => hook.hookId))
      .toContain('learned_clue');

    const afterLongGap = new ScenarioDirector(social, director.getState());
    expect(afterLongGap.getState().instances[id]?.lifecycle).toBe('dormant');
    expect(afterLongGap.getAvailableHooks([definition], observation).map((hook) => hook.hookId))
      .toContain('learned_clue');

    expect(afterLongGap.setLifecycle(id, 'resolved')).toBe(true);
    expect(afterLongGap.getAvailableHooks([definition], observation)).toEqual([]);
    expect(afterLongGap.setLifecycle(id, 'abandoned')).toBe(true);
    expect(afterLongGap.getAvailableHooks([definition], observation)).toEqual([]);
  });
});
