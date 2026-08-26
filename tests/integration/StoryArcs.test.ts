import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { NarrativeEngine } from '../../src/narrative/NarrativeEngine';
import { InkAdapter } from '../../src/narrative/InkAdapter';
import { ALL_STORY_KNOTS } from '../../src/narrative/data/allKnots';

describe('14-Day Full Story Arcs Integration Test Suite', () => {
  let simEngine: SimulationEngine;
  let narrativeEngine: NarrativeEngine;
  let adapter: InkAdapter;

  beforeEach(() => {
    simEngine = new SimulationEngine();
    narrativeEngine = new NarrativeEngine(undefined, ALL_STORY_KNOTS);
    adapter = new InkAdapter(simEngine, narrativeEngine);
  });

  it('runs complete 14-day evaluation story arc from Day 1 to Day 14 free play unlock', () => {
    // ==========================================
    // DAY 1: Arrival & Onboarding
    // ==========================================
    expect(simEngine.getState().time.day).toBe(1);

    // Maya Day 1 Greeting
    const mayaKnot = adapter.triggerKnot('maya_day1_greeting');
    expect(mayaKnot).toBeDefined();
    const mayaChoice = mayaKnot?.choices?.[0];
    if (mayaChoice) adapter.executeChoice('maya', mayaChoice);

    // Ryan Day 1 Tacos
    const ryanKnot = adapter.triggerKnot('ryan_day1');
    expect(ryanKnot).toBeDefined();
    const ryanChoice = ryanKnot?.choices?.[0];
    if (ryanChoice) adapter.executeChoice('ryan', ryanChoice);

    // Henderson Day 1 Policies
    const hendersonKnot = adapter.triggerKnot('henderson_day1');
    expect(hendersonKnot).toBeDefined();
    const hendersonChoice = hendersonKnot?.choices?.[0];
    if (hendersonChoice) adapter.executeChoice('henderson', hendersonChoice);

    // Nora Day 1 Frequencies
    const noraKnot = adapter.triggerKnot('nora_day1');
    expect(noraKnot).toBeDefined();
    const noraChoice = noraKnot?.choices?.[0];
    if (noraChoice) adapter.executeChoice('nora', noraChoice);

    expect(simEngine.getState().narrative.completedBeats).toContain('maya_day1_complete');
    expect(simEngine.getState().narrative.completedBeats).toContain('ryan_day1_complete');
    expect(simEngine.getState().narrative.completedBeats).toContain('henderson_day1_complete');
    expect(simEngine.getState().narrative.completedBeats).toContain('nora_day1_complete');

    // ==========================================
    // DAY 3: Adware Warnings & Maintenance
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 2 * 1440, reason: 'jump to day 3' });
    expect(simEngine.getState().time.day).toBe(3);

    const ryanD3 = adapter.triggerKnot('ryan_day3');
    if (ryanD3?.choices?.[0]) adapter.executeChoice('ryan', ryanD3.choices[0]);
    expect(simEngine.getState().narrative.flags['ryan_adware_warned']).toBe(true);

    // ==========================================
    // DAY 4: Rabbit Hole A & Food Cart Shifts
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'jump to day 4' });
    expect(simEngine.getState().time.day).toBe(4);

    const noraD4 = adapter.triggerKnot('nora_day4');
    if (noraD4?.choices?.[0]) adapter.executeChoice('nora', noraD4.choices[0]);
    expect(simEngine.getState().narrative.flags['unlock_website_nightboard_thread_104']).toBe(true);
    expect(simEngine.getState().narrative.flags['nora_rabbit_hole_a']).toBe(true);

    // ==========================================
    // DAY 6: Photo Sharing File Transfer
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 2 * 1440, reason: 'jump to day 6' });
    expect(simEngine.getState().time.day).toBe(6);

    const mayaD6 = adapter.triggerKnot('maya_day6');
    if (mayaD6?.choices?.[0]) adapter.executeChoice('maya', mayaD6.choices[0]);
    expect(simEngine.getState().narrative.flags['maya_shared_photo']).toBe(true);
    expect(simEngine.getState().vfs.files['C:/Downloads/maya_rain_neon.jpg']).toBeDefined();

    // ==========================================
    // DAY 7: First Rent Check ($140.00)
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'jump to day 7' });
    expect(simEngine.getState().time.day).toBe(7);

    // Player earns cash from working shifts and pays rent
    simEngine.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 200, reason: 'weekly wages' });
    simEngine.dispatchAction({ type: 'PLAYER_PAY_RENT' });
    expect(simEngine.getState().player.rentPaid).toBe(true);

    const hendersonD7 = adapter.triggerKnot('henderson_day7');
    if (hendersonD7?.choices?.[0]) adapter.executeChoice('henderson', hendersonD7.choices[0]);
    expect(simEngine.getState().narrative.completedBeats).toContain('henderson_day7_complete');

    // ==========================================
    // DAY 8: OS 6 Transition & RAM Upgrade
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'jump to day 8' });
    expect(simEngine.getState().time.day).toBe(8);

    simEngine.dispatchAction({ type: 'HARDWARE_UPGRADE_RAM', ramMB: 1024, cost: 40 });
    simEngine.dispatchAction({ type: 'HARDWARE_UPGRADE_OS', targetOs: 'Orion_6.0', cost: 0 });

    const snapD8 = adapter.syncSnapshot();
    expect(snapD8.sim_os_version).toBe('Orion_6.0');
    expect(snapD8.sim_ram_mb).toBe(1024);

    // ==========================================
    // DAY 10: Maya Café Invitation
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 2 * 1440, reason: 'jump to day 10' });
    expect(simEngine.getState().time.day).toBe(10);

    const mayaD10 = adapter.triggerKnot('maya_day10');
    if (mayaD10?.choices?.[0]) adapter.executeChoice('maya', mayaD10.choices[0]);

    const appt = simEngine.getState().narrative.appointments.find((a) => a.id === 'maya_cafe');
    expect(appt).toBeDefined();
    expect(appt?.targetDay).toBe(11);

    // ==========================================
    // DAY 11: Café Meeting Minigame
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'jump to day 11' });
    expect(simEngine.getState().time.day).toBe(11);

    // Execute Café Meeting
    simEngine.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    const cafeKnot = adapter.triggerKnot('cafe_scene_start');
    if (cafeKnot?.choices?.[0]) adapter.executeChoice('maya', cafeKnot.choices[0]);

    // Ordering (spends $4)
    const cafeOrd = adapter.triggerKnot('cafe_scene_ordering');
    if (cafeOrd?.lines[0]?.tags) adapter.executeTags(cafeOrd.lines[0].tags);

    // Portfolio
    const cafePort = adapter.triggerKnot('cafe_scene_portfolio');
    if (cafePort?.choices?.[0]) adapter.executeChoice('maya', cafePort.choices[0]);

    // Questions & Parting
    const cafeQ = adapter.triggerKnot('cafe_scene_questions');
    if (cafeQ?.choices?.[0]) adapter.executeChoice('maya', cafeQ.choices[0]);

    const cafePart = adapter.triggerKnot('cafe_scene_parting');
    if (cafePart?.lines[1]?.tags) adapter.executeTags(cafePart.lines[1].tags);

    expect(simEngine.getState().narrative.completedBeats).toContain('cafe_meeting_complete');
    expect(simEngine.getState().narrative.flags['cafe_meeting_attended']).toBe(true);

    // ==========================================
    // DAY 13: Nora Emergency Archive
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 2 * 1440, reason: 'jump to day 13' });
    expect(simEngine.getState().time.day).toBe(13);

    const noraD13 = adapter.triggerKnot('nora_day13');
    if (noraD13?.choices?.[0]) adapter.executeChoice('nora', noraD13.choices[0]);
    expect(simEngine.getState().vfs.files['C:/Downloads/canal_archive_2001.txt']).toBeDefined();

    // ==========================================
    // DAY 14: Final Rent & Evaluation Resolution
    // ==========================================
    simEngine.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 1440, reason: 'jump to day 14' });
    expect(simEngine.getState().time.day).toBe(14);

    // Pay Week 2 Rent
    simEngine.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 200, reason: 'wages' });
    simEngine.dispatchAction({ type: 'PLAYER_PAY_RENT' });

    // Henderson Week 2 Clearance
    const hendersonD14 = adapter.triggerKnot('henderson_day14');
    if (hendersonD14?.choices?.[0]) adapter.executeChoice('henderson', hendersonD14.choices[0]);
    expect(simEngine.getState().narrative.flags['henderson_arc_completed']).toBe(true);

    // Ryan Day 14 Toast
    const ryanD14 = adapter.triggerKnot('ryan_day14');
    if (ryanD14?.choices?.[0]) adapter.executeChoice('ryan', ryanD14.choices[0]);
    expect(simEngine.getState().narrative.flags['ryan_arc_completed']).toBe(true);

    // Maya Day 14 Climax
    const mayaD14 = adapter.triggerKnot('maya_day14');
    if (mayaD14?.choices?.[0]) adapter.executeChoice('maya', mayaD14.choices[0]);
    expect(simEngine.getState().narrative.flags['maya_arc_completed']).toBe(true);

    // Nora Day 14 Farewell
    const noraD14 = adapter.triggerKnot('nora_day14');
    if (noraD14?.choices?.[0]) adapter.executeChoice('nora', noraD14.choices[0]);
    expect(simEngine.getState().narrative.flags['nora_arc_completed']).toBe(true);

    // Day 14 Evaluation Conclusion Knot
    const evalKnot = adapter.triggerKnot('evaluation_day14_conclusion');
    expect(evalKnot).toBeDefined();
    if (evalKnot?.choices?.[0]) adapter.executeChoice('system', evalKnot.choices[0]);

    const finalState = simEngine.getState();
    expect(finalState.narrative.completedBeats).toContain('evaluation_complete');
    expect(finalState.narrative.flags['evaluation_complete']).toBe(true);
    expect(finalState.narrative.flags['free_play_unlocked']).toBe(true);
    expect(finalState.narrative.flags['free_play_active']).toBe(true);
  });
});
