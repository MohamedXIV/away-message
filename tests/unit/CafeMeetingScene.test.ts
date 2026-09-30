import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { NarrativeEngine } from '../../src/narrative/NarrativeEngine';
import { InkAdapter } from '../../src/narrative/InkAdapter';

describe('Generic in-person appointment semantics', () => {
  let sim: SimulationEngine;
  let narrative: NarrativeEngine;
  let adapter: InkAdapter;

  beforeEach(() => {
    sim = new SimulationEngine();
    narrative = new NarrativeEngine();
    adapter = new InkAdapter(sim, narrative);
  });

  it('schedules an appointment without requiring a named campaign character', () => {
    const actorId = sim.social.getBuddies()[0]?.id;
    expect(actorId).toBeTruthy();

    adapter.executeTags([
      '# schedule:appointment:coffee_meet:3:900:960:cafe:Coffee together',
    ]);

    const appointment = sim.getState().narrative.appointments.find((a) => a.id === 'coffee_meet');
    expect(appointment).toBeDefined();
    expect(appointment?.characterId).toBe(actorId);
    expect(appointment?.targetDay).toBe(3);
    expect(appointment?.locationId).toBe('cafe');
  });

  it('supports optional social time without creating a campaign completion flag', () => {
    const actorId = sim.social.getBuddies()[0]?.id;
    expect(actorId).toBeTruthy();
    if (!actorId) return;

    const before = sim.social.getRelationships(actorId);
    sim.dispatchAction({ type: 'VIEW_SWITCH', view: 'cafe' });
    sim.dispatchAction({
      type: 'SOCIAL_APPLY_ACTION',
      buddyId: actorId,
      socialAction: 'empathy',
    });
    sim.dispatchAction({ type: 'TIME_ADVANCE_MINUTES', minutes: 75, reason: 'optional cafe visit' });

    expect(sim.getState().activeView).toBe('cafe');
    expect(sim.social.getRelationships(actorId)?.trust).toBeGreaterThanOrEqual(before?.trust ?? 0);
    expect(sim.getState().world.flags['evaluation_complete']).toBeUndefined();
  });
});
