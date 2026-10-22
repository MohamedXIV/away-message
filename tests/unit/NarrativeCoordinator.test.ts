import { describe, expect, it, vi } from 'vitest';
import {
  NarrativeCoordinator,
  type NarrativeContextSource,
  type NarrativeEffectOwner,
  type NarrativeScenarioHookRef,
  type NarrativeSessionRef,
} from '../../src/narrative/NarrativeCoordinator';
import { NarrativeContextProjectionSchema, type NarrativeEffectRequest } from '../../src/narrative/contracts';
import { DEFAULT_NARRATIVE_FLOWS } from '../../src/narrative/flows';

function contextSource(options: { trusted?: boolean } = {}): NarrativeContextSource {
  return {
    buildContext: (session: NarrativeSessionRef) => NarrativeContextProjectionSchema.parse({
      currentDay: 2,
      currentTimeMinute: 600,
      timeOfDay: 'day',
      player: { cash: 40, energy: 70, fatigue: 20 },
      ...(session.actorId
        ? {
            actor: {
              id: session.actorId,
              reach: 'local',
              roles: ['diner-staff'],
              lifecycle: 'active',
              connection: 'known',
              relationshipStage: 'friend',
              trusted: options.trusted ?? false,
              conflicted: false,
            },
          }
        : {}),
      ...(session.placeId ? { location: { placeId: session.placeId, coLocated: true } } : {}),
      ...(session.scenario
        ? { scenario: { instanceId: session.scenario.instanceId, hookId: session.scenario.hookId } }
        : {}),
      flags: {},
      completedBeats: [],
    }),
  };
}

function effectOwner(): { owner: NarrativeEffectOwner; effects: NarrativeEffectRequest[] } {
  const effects: NarrativeEffectRequest[] = [];
  return {
    effects,
    owner: {
      handleEffect: (request) => {
        effects.push(request);
        return { accepted: true, committed: true };
      },
    },
  };
}

function createCoordinator(options: {
  trusted?: boolean;
  owner?: NarrativeEffectOwner;
  consumeScenarioHook?: (hook: NarrativeScenarioHookRef) => boolean;
} = {}): NarrativeCoordinator {
  return new NarrativeCoordinator({
    flows: DEFAULT_NARRATIVE_FLOWS,
    contextSource: contextSource({ trusted: options.trusted }),
    ...(options.owner ? { effectOwner: options.owner } : {}),
    ...(options.consumeScenarioHook ? { consumeScenarioHook: options.consumeScenarioHook } : {}),
  });
}

const scenarioHook: NarrativeScenarioHookRef = {
  instanceId: 'old_debt:fixture',
  definitionId: 'old_debt',
  hookId: 'debt_search',
  roleId: 'old_debtor',
  boundActorId: 'actor_fixture',
  presentationCue: 'old_obligation_recalled',
};

describe('NarrativeCoordinator', () => {
  it('starts the migrated cafe interaction from an explicit request', () => {
    const coordinator = createCoordinator();
    const result = coordinator.requestInteraction({
      interactionId: 'cafe_meeting',
      actorId: 'maya',
      placeId: 'place_a1',
    });
    expect(result.started).toBe(true);
    expect(result.flowId).toBe('cafe_meeting');
    expect(result.frame?.text).toContain('Hey! You made it!');
    expect(result.frame?.tags).toContain('greeting');
    expect(coordinator.getContext()?.location).toEqual({ placeId: 'place_a1', coLocated: true });
    expect(coordinator.getContext()?.actor?.id).toBe('maya');
  });

  it('runs authored choices through validated effects and returns the response', () => {
    const { owner, effects } = effectOwner();
    const coordinator = createCoordinator({ owner });
    coordinator.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya' });
    const choices = coordinator.advanceToChoices();
    expect(choices.choices.map((choice) => choice.text)).toEqual([
      "Ask how they've been",
      'Make a dry joke about the coffee',
      'Let the pause sit',
    ]);

    const frame = coordinator.choose(0);
    expect(frame.text).toContain('the week comes out sideways');
    expect(frame.tags).toContain('empathy');
    expect(effects).toEqual([{ type: 'social_act', buddyId: 'maya', action: 'empathy' }]);
    expect(coordinator.getPendingEffects()).toEqual([]);
  });

  it('starts conversations only for their declared semantic channel', () => {
    const coordinator = createCoordinator();
    const pulse = coordinator.handleSemanticEvent({
      kind: 'conversation_started', actorId: 'maya', channel: 'pulse',
    });
    expect(pulse.started).toBe(false);
    expect(pulse.reason).toBe('no_flow');

    const inPerson = coordinator.handleSemanticEvent({
      kind: 'conversation_started', actorId: 'maya', placeId: 'place_a1', channel: 'in_person',
    });
    expect(inPerson.started).toBe(true);
    expect(inPerson.flowId).toBe('cafe_meeting');
  });

  it('refreshes bounded context before advancing authored flow', () => {
    let trusted = false;
    const source: NarrativeContextSource = {
      buildContext: (session) => contextSource({ trusted }).buildContext(session),
    };
    const coordinator = new NarrativeCoordinator({ flows: DEFAULT_NARRATIVE_FLOWS, contextSource: source });
    coordinator.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya' });
    trusted = true;
    const choices = coordinator.advanceToChoices();
    expect(choices.text).toContain('easier than their messages sounded');
    expect(choices.tags).toContain('trusted');
  });

  it('launches an Ink flow for a Scenario hook and consumes it through the owner', () => {
    const consume = vi.fn(() => true);
    const coordinator = createCoordinator({ consumeScenarioHook: consume });
    const result = coordinator.handleSemanticEvent({ kind: 'scenario_hook_available', scenario: scenarioHook });
    expect(result.started).toBe(true);
    expect(result.flowId).toBe('scenario_old_debt');
    expect(consume).toHaveBeenCalledWith(scenarioHook);
    expect(coordinator.activeSession?.scenario?.instanceId).toBe(scenarioHook.instanceId);

    const choices = coordinator.advanceToChoices();
    expect(choices.text).toContain('something unfinished');
    expect(choices.text).toContain('You know exactly whose name');
    expect(choices.choices.map((choice) => choice.text)).toEqual([
      'Sit with it for a minute',
      'Close the window',
    ]);
  });

  it('does not consume a Scenario hook while another flow is active', () => {
    const consume = vi.fn(() => true);
    const coordinator = createCoordinator({ consumeScenarioHook: consume });
    coordinator.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya' });
    const result = coordinator.handleSemanticEvent({ kind: 'scenario_hook_available', scenario: scenarioHook });
    expect(result.started).toBe(false);
    expect(result.reason).toBe('active_flow');
    expect(consume).not.toHaveBeenCalled();
  });

  it('rejects a Scenario hook the owner already consumed', () => {
    const coordinator = createCoordinator({ consumeScenarioHook: () => false });
    const result = coordinator.handleSemanticEvent({ kind: 'scenario_hook_available', scenario: scenarioHook });
    expect(result.started).toBe(false);
    expect(result.reason).toBe('scenario_hook_unavailable');
    expect(coordinator.isActive).toBe(false);
  });

  it('saves and reloads at a choice point deterministically', () => {
    const first = effectOwner();
    const original = createCoordinator({ owner: first.owner });
    original.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya' });
    original.advanceToChoices();
    const saved = original.save();

    const second = effectOwner();
    const restored = createCoordinator({ owner: second.owner });
    restored.load(saved);
    const restoredChoices = restored.advanceToChoices();
    expect(restoredChoices.choices.map((choice) => choice.text))
      .toEqual(['Ask how they\'ve been', 'Make a dry joke about the coffee', 'Let the pause sit']);

    const originalFrame = original.choose(1);
    const restoredFrame = restored.choose(1);
    expect(restoredFrame.text).toBe(originalFrame.text);
    expect(restoredFrame.tags).toEqual(originalFrame.tags);
    expect(second.effects).toEqual(first.effects);
  });

  it('rejects malformed coordinator save state', () => {
    const coordinator = createCoordinator();
    expect(() => coordinator.load({
      version: 1,
      session: { flowId: 'cafe_meeting', trigger: { kind: 'interaction', interactionId: 'cafe_meeting' } },
      context: null,
      host: { version: 1, flowId: 'cafe_meeting', compiledStoryKey: 'cafe_meeting', inkState: { version: 1, storyStateJson: '{}' } },
    })).toThrow(/no context/);
  });

  it('does not start any flow from an ordinary time tick shape', () => {
    const coordinator = createCoordinator();
    // The coordinator exposes no tick method and does not subscribe to time.
    expect(coordinator.isActive).toBe(false);
    const result = coordinator.handleSemanticEvent({ kind: 'knowledge_fact_learned', factKey: 'x' });
    expect(result.started).toBe(false);
    expect(coordinator.isActive).toBe(false);
  });
});
