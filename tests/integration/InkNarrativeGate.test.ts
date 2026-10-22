import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';
import { startCafeMeetingNarrative } from '../../src/narrative/cafeMeeting';
import { createSimulationNarrative } from '../../src/narrative/SimulationNarrativeAdapter';
import {
  NarrativeContextProjectionSchema,
  validateNarrativeEffectRequest,
  type NarrativeFrame,
} from '../../src/narrative/contracts';
import type { NarrativeSessionRef } from '../../src/narrative/NarrativeCoordinator';
import { buildUtterancePlan } from '../../src/narrative/realization';
import {
  buildGeneratedSiteNarrative,
  buildNightBoardNarrative,
  createFakeNetRuntime,
} from '../../src/narrative/fakeNet';

function cafeEngine(): SimulationEngine {
  const engine = new SimulationEngine();
  engine.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
  return engine;
}

function engineSnapshot(engine: SimulationEngine): Record<string, string | string[]> {
  return {
    roster: engine.social.getBuddies().map((buddy) => buddy.id),
    website: JSON.stringify(engine.getWebsiteRead()),
    transit: JSON.stringify(engine.getTransitRead()),
    scenarios: JSON.stringify(engine.getScenarioState()),
    board: JSON.stringify(engine.getNightBoardRead()),
    hud: JSON.stringify(engine.getHudProjection()),
  };
}

function remoteActor(engine: SimulationEngine, handle: string): string {
  const result = engine.dispatchAction({
    type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
    identity: { source: 'pulse-room', username: handle, handle, displayName: handle },
    silent: true,
  });
  if (!result.success) throw new Error(result.error ?? 'promotion failed');
  return (result.data as { actorId: string }).actorId;
}

describe('#185 Ink acceptance gate', () => {
  it('1-4: real Ink branching, bounded reads, validated effects and local presence', () => {
    const empathyEngine = cafeEngine();
    const getState = vi.spyOn(empathyEngine, 'getState');
    const empathy = startCafeMeetingNarrative(empathyEngine, 'maya', 'place_a1');
    expect(empathy).not.toBeNull();
    expect(empathy!.frame.choices.map((choice) => choice.text)).toEqual([
      "Ask how they've been",
      'Make a dry joke about the coffee',
      'Let the pause sit',
    ]);
    expect(getState).not.toHaveBeenCalled();

    const presenceBefore = resolveCharacterPresenceFromSimulation(empathyEngine, 'maya', { playerPlaceId: 'place_a1' });
    expect(presenceBefore).toMatchObject({
      physical: { kind: 'at_place', placeId: 'place_a1' },
      availability: { canInteractInPerson: true },
    });

    const dispatch = vi.spyOn(empathyEngine, 'dispatchAction');
    const beforeTrust = empathyEngine.social.getRelationships('maya')?.trust ?? 0;
    const empathyFrame = empathy!.coordinator.choose(0);
    expect(empathyFrame.text).toContain('the week comes out sideways');
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SOCIAL_APPLY_ACTION', buddyId: 'maya', socialAction: 'empathy',
    });
    expect(empathyEngine.social.getRelationships('maya')?.trust).toBeGreaterThan(beforeTrust);
    const plan = empathy!.coordinator.getUtterancePlan();
    expect(plan).toMatchObject({ tier: 'L2', speakerKind: 'canonical_local' });
    expect(empathy!.coordinator.getPendingEffects()).toEqual([]);

    const teaseEngine = cafeEngine();
    const tease = startCafeMeetingNarrative(teaseEngine, 'maya', 'place_a1');
    const teaseDispatch = vi.spyOn(teaseEngine, 'dispatchAction');
    const teaseFrame = tease!.coordinator.choose(1);
    expect(teaseFrame.text).not.toBe(empathyFrame.text);
    expect(teaseDispatch).toHaveBeenCalledWith({
      type: 'SOCIAL_APPLY_ACTION', buddyId: 'maya', socialAction: 'tease_playful',
    });

    // Unknown semantic effects never reach an owner.
    expect(validateNarrativeEffectRequest({
      type: 'request_effect', effectId: 'does_not_exist', payload: {},
    }).ok).toBe(false);

    // Losing canonical presence makes the in-person flow unavailable.
    empathyEngine.relocateActorSpatially('maya', { x: 0, y: 0, z: 0 });
    expect(empathyEngine.getCafeGuestRead('place_a1', 'maya').guest).toBeNull();
    expect(startCafeMeetingNarrative(empathyEngine, 'maya', 'place_a1')).toBeNull();
  });

  it('3: Ink local variables stay outside canonical state', () => {
    const engine = new SimulationEngine();
    const { coordinator, adapter } = createSimulationNarrative(engine);
    const observed = adapter.observeScenarioHooks(coordinator, { searchTerms: ['old debt'] });
    expect(observed.filter((result) => result.started)).toHaveLength(1);
    coordinator.advanceToChoices();

    // Scenario consumption is the canonical owner's intended write; Ink-local
    // variables must not add any further canonical state.
    const afterScenario = engineSnapshot(engine);
    const saved = coordinator.save();
    expect(saved.host?.inkState.storyStateJson.length).toBeGreaterThan(10);
    expect(JSON.stringify(engine.getState())).not.toContain('hook_seen');
    expect(JSON.stringify(engine.getState())).not.toContain(saved.host?.flowId ?? '');
    expect(engineSnapshot(engine)).toEqual(afterScenario);
  });

  it('6-7: remote L0-L2, no physical presence, continuity across reach transitions', () => {
    const engine = new SimulationEngine();
    const actorId = remoteActor(engine, 'gate_remote');
    expect(engine.social.getBuddy(actorId)?.reach).toBe('remote');
    engine.social.addCoreMemory(actorId, {
      text: 'Traded a mixtape recommendation.', kind: 'shared_moment', day: 1,
    });
    expect(engine.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE', buddyId: actorId, text: 'still around?',
    }).success).toBe(true);

    const history = {
      relationships: engine.social.getRelationships(actorId),
      memories: engine.social.getCoreMemories(actorId),
      messages: engine.social.getMessages(actorId),
      handles: engine.social.getKnownHandles(actorId),
    };

    const frame: NarrativeFrame = {
      text: 'The week comes out sideways, in pieces.',
      tags: ['tier:l2', 'fact:the week', 'fact:pieces'],
      choices: [],
      canContinue: false,
      pendingEffects: [],
    };
    const session: NarrativeSessionRef = {
      flowId: 'gate_remote_flow',
      trigger: { kind: 'interaction', interactionId: 'gate_remote_flow' },
      actorId,
    };
    const context = NarrativeContextProjectionSchema.parse({
      currentDay: 1,
      currentTimeMinute: 600,
      timeOfDay: 'day',
      player: { cash: 38, energy: 80, fatigue: 10 },
      actor: {
        id: actorId, reach: 'remote', roles: [], lifecycle: 'active', connection: 'known',
        relationshipStage: 'acquaintance', trusted: false, conflicted: false,
      },
      flags: {},
      completedBeats: [],
    });
    const remotePlan = buildUtterancePlan({
      frame, session, context, speakerKind: 'canonical_remote', requestedTier: 'L2',
    });
    expect(remotePlan?.tier).toBe('L2');

    expect(engine.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });
    expect(engine.getCafeGuestRead('place_a1', actorId).guest).toBeNull();
    expect(resolveCharacterPresenceFromSimulation(engine, actorId, { playerPlaceId: 'place_a1' }))
      .toMatchObject({ physical: { kind: 'remote' }, availability: { canInteractInPerson: false } });

    expect(engine.setActorReach(actorId, 'local').success).toBe(true);
    engine.relocateActorSpatially(actorId, { x: 20, y: 60, z: 0 });
    expect(resolveCharacterPresenceFromSimulation(engine, actorId, { playerPlaceId: 'place_a1' }))
      .toMatchObject({ physical: { kind: 'at_place', placeId: 'place_a1' }, availability: { canInteractInPerson: true } });

    expect(engine.setActorReach(actorId, 'remote').success).toBe(true);
    expect(engine.getNpcPlaceState(actorId)).toEqual({ status: 'unknown' });
    expect(engine.getActorSpatialProjection(actorId)).toBeNull();
    expect(engine.getNpcTrip(actorId)).toBeNull();
    expect(engine.social.getBuddy(actorId)?.id).toBe(actorId);
    expect(engine.social.getRelationships(actorId)).toEqual(history.relationships);
    expect(engine.social.getCoreMemories(actorId)).toEqual(history.memories);
    expect(engine.social.getMessages(actorId)).toEqual(history.messages);
    expect(engine.social.getKnownHandles(actorId)).toEqual(history.handles);
  });

  it('8-9: surface identity stays noncanonical until one governed promotion', async () => {
    const engine = new SimulationEngine();
    const rosterBefore = engine.social.getBuddies().map((buddy) => buddy.id);
    const first = await buildNightBoardNarrative(createFakeNetRuntime(engine));
    expect(first.statements.every((statement) => statement.author.kind === 'surface_only')).toBe(true);
    expect(engine.social.getBuddies().map((buddy) => buddy.id)).toEqual(rosterBefore);

    expect(engine.dispatchAction({
      type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
      identity: {
        source: 'nightboard',
        username: 'northbank_owl',
        handle: 'northbank_owl',
        displayName: 'North Bank Owl',
      },
      silent: true,
    }).success).toBe(true);
    expect(engine.social.getBuddy('northbank_owl')?.reach).toBe('remote');
    expect(engine.social.isKnown('northbank_owl')).toBe(true);

    const second = await buildNightBoardNarrative(createFakeNetRuntime(engine));
    expect(second.statements[0]?.author).toMatchObject({ kind: 'surface_only', handle: 'northbank_owl' });
    expect(engine.social.getBuddies().filter((buddy) => buddy.handle.toLowerCase() === 'northbank_owl'))
      .toHaveLength(1);
  });

  it('10-11: Scenario hook drives Ink without duplicated state; fake-net claims stay claims', async () => {
    const engine = new SimulationEngine();
    const { coordinator, adapter } = createSimulationNarrative(engine);
    const observed = adapter.observeScenarioHooks(coordinator, { searchTerms: ['old debt'] });
    expect(observed.filter((result) => result.started)).toHaveLength(1);
    const scenarioState = engine.getScenarioState();
    const debt = Object.values(scenarioState.instances).find((instance) => instance.definitionId === 'old_debt');
    expect(debt?.consumedHookIds).toContain('debt_search');
    expect(JSON.stringify(coordinator.save())).not.toContain('obligation_kind');
    coordinator.advanceToChoices();

    // Scenario consumption is the only intended canonical change; fake-net
    // claims must not add any further world/roster/board mutation.
    const afterScenario = engineSnapshot(engine);
    const board = await buildNightBoardNarrative(createFakeNetRuntime(engine), {
      ai: async (plan) => `CONFIRMED BY THE CITY: ${plan.offlineText}`,
    });
    expect(board.statements.map((statement) => statement.provenance)).toEqual([
      'rumor', 'canonical_fact', 'opinion', 'lie', 'unknown', 'claim',
    ]);
    expect(board.statements.map((statement) => statement.text).join(' ')).not.toContain('CONFIRMED BY');
    expect(engineSnapshot(engine)).toEqual(afterScenario);
  });

  it('12: representative narrative/social loop runs with no AI or network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const engine = cafeEngine();
      const cafe = startCafeMeetingNarrative(engine, 'maya', 'place_a1');
      expect(cafe).not.toBeNull();
      cafe!.coordinator.choose(0);
      expect(engine.social.getRelationships('maya')?.trust).toBeGreaterThan(20);

      const board = await buildNightBoardNarrative(createFakeNetRuntime(engine));
      expect(board.statements[0]?.text).toContain('pumps cutting out');
      const site = await buildGeneratedSiteNarrative(createFakeNetRuntime(engine));
      expect(site.clueIds).toEqual(['intake_map']);

      const narrative = createSimulationNarrative(engine);
      const scenario = narrative.adapter.observeScenarioHooks(narrative.coordinator, { searchTerms: ['old debt'] });
      expect(scenario.filter((result) => result.started)).toHaveLength(1);
      narrative.coordinator.advanceToChoices();

      expect(engine.dispatchAction({
        type: 'SOCIAL_SEND_MESSAGE', buddyId: 'maya', text: 'that was nice. same time next week?',
      }).success).toBe(true);
      expect(engine.social.getMessages('maya').length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
