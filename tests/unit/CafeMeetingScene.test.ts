import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { NarrativeEngine } from '../../src/narrative/NarrativeEngine';
import { InkAdapter } from '../../src/narrative/InkAdapter';
import { ALL_STORY_KNOTS } from '../../src/narrative/data/allKnots';

describe('Café Meeting Scene & Physical Social Mechanics Test Suite', () => {
  let simEngine: SimulationEngine;
  let narrativeEngine: NarrativeEngine;
  let adapter: InkAdapter;

  beforeEach(() => {
    simEngine = new SimulationEngine();
    narrativeEngine = new NarrativeEngine(undefined, ALL_STORY_KNOTS);
    adapter = new InkAdapter(simEngine, narrativeEngine);
  });

  it('schedules the café appointment for Day 11 via semantic tag', () => {
    const schedTag = '# schedule:appointment:maya_cafe:11:900:960:cafe:Coffee with Maya';
    adapter.executeTags([schedTag]);

    const state = simEngine.getState();
    const appt = state.narrative.appointments.find((a) => a.id === 'maya_cafe');

    expect(appt).toBeDefined();
    expect(appt?.targetDay).toBe(11);
    expect(appt?.startMinute).toBe(900); // 15:00
    expect(appt?.endMinute).toBe(960);   // 16:00
    expect(appt?.locationId).toBe('cafe');
    expect(appt?.description).toBe('Coffee with Maya');
  });

  it('executes the full multi-beat café meeting conversation and tracks state changes', () => {
    const initialCash = simEngine.getState().player.cash;
    const initialFam = simEngine.getState().social.relationships['maya']?.familiarity ?? 0;
    const initialTrust = simEngine.getState().social.relationships['maya']?.trust ?? 0;

    // 1. Enter Café View
    simEngine.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    expect(simEngine.getState().activeView).toBe('cafe');

    // 2. Start Café Dialogue (legacy Ink path — kept for compat)
    const startKnot = narrativeEngine.startKnot('cafe_scene_start');
    expect(startKnot).toBeDefined();

    // 3. Select Choice 1: Screen Barrier
    const choice1 = startKnot?.choices?.[0];
    expect(choice1).toBeDefined();
    if (choice1?.tags) adapter.executeTags(choice1.tags);

    // 4. Ordering Coffee (spends $4) — now via direct spend in sandbox
    simEngine.dispatchAction({ type: 'PLAYER_SPEND_CASH', amount: 4, reason: 'Coffee at Starlight Café' });

    expect(simEngine.getState().player.cash).toBe(initialCash - 4);

    // 5. Viewing 35mm Portfolio
    const portfolioKnot = narrativeEngine.startKnot('cafe_scene_portfolio');
    const portChoice = portfolioKnot?.choices?.[0];
    if (portChoice?.tags) adapter.executeTags(portChoice.tags);

    // 6. Deep Personal Questions
    const questionsKnot = narrativeEngine.startKnot('cafe_scene_questions');
    const qChoice = questionsKnot?.choices?.[0];
    if (qChoice?.tags) adapter.executeTags(qChoice.tags);

    // 7. Parting — sandbox: set world flag directly
    simEngine.dispatchAction({ type: 'WORLD_SET_FLAG', key: 'cafe_meeting_attended', value: true });
    simEngine.dispatchAction({ type: 'WORLD_SET_FLAG', key: 'maya_met_in_person', value: true });
    simEngine.dispatchAction({ type: 'VIEW_SWITCH', view: 'room' });

    const finalState = simEngine.getState();

    // Verify world Flags (beats deprecated in sandbox)
    expect(finalState.world.flags['cafe_meeting_attended']).toBe(true);
    expect(finalState.world.flags['maya_met_in_person']).toBe(true);
    expect(finalState.activeView).toBe('room');

    // Verify Relationship Metric Growth
    const updatedRel = finalState.social.relationships['maya'];
    expect(updatedRel).toBeDefined();
    if (updatedRel) {
      expect(updatedRel.familiarity).toBeGreaterThan(initialFam);
      expect(updatedRel.trust).toBeGreaterThan(initialTrust);
    }
  });

  it('unlocks Day 12 post-meeting dialogue branch after attending meeting', () => {
    // Set flag that meeting was attended
    simEngine.dispatchAction({
      type: 'NARRATIVE_SET_FLAG',
      key: 'cafe_meeting_attended',
      value: true,
    });

    const day12Knot = narrativeEngine.getKnot('maya_day12');
    expect(day12Knot).toBeDefined();

    narrativeEngine.injectContext(simEngine.getState());
    expect(narrativeEngine.isKnotEligible(day12Knot!)).toBe(false); // Day 1 vs Day 12

    // Advance to Day 12
    simEngine.dispatchAction({
      type: 'TIME_ADVANCE_MINUTES',
      minutes: 11 * 1440,
      reason: 'advance to day 12',
    });

    narrativeEngine.injectContext(simEngine.getState());
    expect(narrativeEngine.isKnotEligible(day12Knot!)).toBe(true);
  });
});
