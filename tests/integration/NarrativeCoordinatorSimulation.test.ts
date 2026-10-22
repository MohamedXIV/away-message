import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createSimulationNarrative } from '../../src/narrative/SimulationNarrativeAdapter';
import { realizeUtterance } from '../../src/narrative/realization';

function cafeEngine(): SimulationEngine {
  const engine = new SimulationEngine();
  engine.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
  return engine;
}

describe('#182 NarrativeCoordinator + canonical simulation', () => {
  it('runs the migrated cafe interaction end-to-end with a canonical social effect', async () => {
    const engine = cafeEngine();
    const { coordinator } = createSimulationNarrative(engine);
    const getState = vi.spyOn(engine, 'getState');

    const start = coordinator.requestInteraction({
      interactionId: 'cafe_meeting',
      actorId: 'maya',
      placeId: 'place_a1',
    });
    expect(start.started).toBe(true);
    expect(start.frame?.text).toContain('Hey! You made it!');
    expect(coordinator.getContext()?.actor).toMatchObject({ id: 'maya', connection: 'known' });
    expect(coordinator.getContext()?.location).toEqual({ placeId: 'place_a1', coLocated: true });

    const choices = coordinator.advanceToChoices();
    expect(choices.choices).toHaveLength(3);
    // Bounded owner reads only: the narrative seam never asks for a full snapshot.
    expect(getState).not.toHaveBeenCalled();

    const before = engine.social.getRelationships('maya');
    const frame = coordinator.choose(0);
    expect(frame.text).toContain('the week comes out sideways');
    const after = engine.social.getRelationships('maya');
    expect(after?.familiarity).toBeGreaterThan(before?.familiarity ?? 0);
    expect(after?.trust).toBeGreaterThan(before?.trust ?? 0);
    expect(coordinator.getPendingEffects()).toEqual([]);

    const plan = coordinator.getUtterancePlan();
    expect(plan?.tier).toBe('L2');
    expect(plan?.speakerKind).toBe('canonical_local');
    expect(plan?.requiredFacts).toEqual(['the week', 'pieces']);
    expect(plan?.offlineText).toBe(frame.text.trim());
    const offline = await realizeUtterance(plan!);
    expect(offline.source).toBe('offline');
    expect(offline.text).toBe(frame.text.trim());
    const realized = await realizeUtterance(plan!, {
      ai: async () => 'Okay. The week comes out sideways, in pieces. I am listening.',
    });
    expect(realized.source).toBe('ai');
    expect(engine.social.getRelationships('maya')).toEqual(after);
  });

  it('launches an Ink flow from a real authored Scenario hook without copying Scenario state', async () => {
    const engine = new SimulationEngine();
    const { coordinator, adapter } = createSimulationNarrative(engine);
    const scenarioState = engine.getScenarioState();
    const debt = Object.values(scenarioState.instances).find((instance) => instance.definitionId === 'old_debt');
    expect(debt).toBeDefined();

    const observed = adapter.observeScenarioHooks(coordinator, { searchTerms: ['old debt'] });
    expect(observed.filter((result) => result.started)).toHaveLength(1);
    expect(coordinator.activeFlowId).toBe('scenario_old_debt');
    expect(coordinator.activeSession?.scenario?.instanceId).toBe(debt!.id);

    const consumed = engine.getScenarioState().instances[debt!.id];
    expect(consumed?.consumedHookIds).toContain('debt_search');
    expect(consumed?.lifecycle).toBe('active');
    expect(consumed?.bindings.old_debtor).toBe(debt!.bindings.old_debtor);

    const saved = JSON.stringify(coordinator.save());
    expect(saved).not.toContain('consumedHookIds');
    expect(saved).not.toContain('obligation_kind');
    expect(saved).not.toContain('unresolved');

    const frame = coordinator.advanceToChoices();
    expect(frame.text).toContain('something unfinished');
    expect(frame.choices.map((choice) => choice.text)).toEqual([
      'Sit with it for a minute',
      'Close the window',
    ]);

    // Unknown scenario bindings stay exact and offline: no AI call, no choice drift.
    const plan = coordinator.getUtterancePlan();
    expect(plan?.speakerKind).toBe('system');
    expect(plan?.tier).toBe('L0');
    const ai = vi.fn(async () => 'rewritten by ai');
    const realized = await realizeUtterance(plan!, { ai });
    expect(ai).not.toHaveBeenCalled();
    expect(realized.source).toBe('offline');
    expect(realized.text).toBe(frame.text.trim());
    expect(coordinator.advanceToChoices().choices.map((choice) => choice.text)).toEqual([
      'Sit with it for a minute',
      'Close the window',
    ]);

    expect(coordinator.choose(1).text).toContain('The window closes');
    expect(coordinator.getPendingEffects()).toEqual([]);

    // The hook was consumed by the canonical Scenario owner, so it cannot relaunch.
    const again = adapter.observeScenarioHooks(coordinator, { searchTerms: ['old debt'] });
    expect(again.filter((result) => result.started)).toHaveLength(0);
  });

  it('does not start narrative flows from ordinary time advancement', () => {
    const engine = cafeEngine();
    const { coordinator } = createSimulationNarrative(engine);
    engine.advanceGameMinutes(30, 'narrative no-tick test');
    expect(coordinator.isActive).toBe(false);
  });

  it('restores a saved flow deterministically in a second simulation', () => {
    const firstEngine = cafeEngine();
    const first = createSimulationNarrative(firstEngine).coordinator;
    first.requestInteraction({ interactionId: 'cafe_meeting', actorId: 'maya', placeId: 'place_a1' });
    const firstChoices = first.advanceToChoices();
    const saved = first.save();

    const secondEngine = cafeEngine();
    const second = createSimulationNarrative(secondEngine).coordinator;
    second.load(saved);
    const restoredChoices = second.advanceToChoices();
    expect(restoredChoices.choices.map((choice) => choice.text))
      .toEqual(firstChoices.choices.map((choice) => choice.text));

    const firstFrame = first.choose(1);
    const secondFrame = second.choose(1);
    expect(secondFrame.text).toBe(firstFrame.text);
    expect(secondFrame.tags).toEqual(firstFrame.tags);
    expect(secondEngine.social.getRelationships('maya'))
      .toEqual(firstEngine.social.getRelationships('maya'));
  });
});
