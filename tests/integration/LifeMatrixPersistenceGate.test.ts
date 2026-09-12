import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';

function firstLocalActor(sim: SimulationEngine): string {
  const actor = sim.social.getBuddies().find((buddy) => buddy.reach !== 'remote');
  if (!actor) throw new Error('Expected at least one local Away character.');
  return actor.id;
}

function makeTravelFixture(): { sim: SimulationEngine; actorId: string; appointmentId: string } {
  const probe = new SimulationEngine();
  const actorId = firstLocalActor(probe);
  const sim = new SimulationEngine({
    npcMobility: { trips: {}, places: { [actorId]: 'place_a1' } },
  });
  const appointmentId = `life_gate_persist_${actorId}`;
  const day = sim.clock.getTime().day;
  const appointment = sim.world.scheduleAppointment({
    id: appointmentId,
    characterId: actorId,
    locationId: 'place_b1',
    targetDay: day,
    startMinute: 1080,
    endMinute: 1140,
    description: 'Life Matrix persistence gate meeting',
    status: 'confirmed',
    rsvp: 'yes',
  });
  if (!appointment) throw new Error('Expected appointment owner to record the fixture.');
  return { sim, actorId, appointmentId };
}

const presenceOptions = {
  playerPlaceId: 'place_a1',
  messagingDeviceContext: 'home_pc' as const,
};

describe('Life Matrix persistence and time-jump gate (#48)', () => {
  it('reconstructs obligations, intent and coherent presence after save/reload mid-transit', () => {
    const { sim, actorId, appointmentId } = makeTravelFixture();
    sim.advanceGameMinutes(60, 'life gate planning tick');
    const planned = sim.getNpcTrip(actorId);
    if (!planned) throw new Error('Expected a planned trip.');

    sim.advanceGameMinutes(
      planned.plannedDepartureMinute - sim.clock.getTotalMinutes() + 1,
      'life gate one minute into transit',
    );
    expect(sim.getNpcTrip(actorId)?.status).toBe('active');
    expect(sim.getNpcPlaceState(actorId).status).toBe('in_transit');

    const snapshot = sim.exportSnapshot();
    const reloaded = new SimulationEngine(snapshot as never);

    expect(reloaded.clock.getTotalMinutes()).toBe(sim.clock.getTotalMinutes());
    expect(reloaded.getNpcTrip(actorId)).toEqual(sim.getNpcTrip(actorId));
    expect(reloaded.getNpcPlaceState(actorId)).toEqual(sim.getNpcPlaceState(actorId));
    expect(reloaded.getCharacterObligations(actorId)).toEqual(sim.getCharacterObligations(actorId));
    expect(reloaded.getCharacterIntent(actorId)).toEqual(sim.getCharacterIntent(actorId));
    expect(resolveCharacterPresenceFromSimulation(reloaded, actorId, presenceOptions)).toEqual(
      resolveCharacterPresenceFromSimulation(sim, actorId, presenceOptions),
    );
    expect(reloaded.world.getAppointments().find((entry) => entry.id === appointmentId)).toEqual(
      sim.world.getAppointments().find((entry) => entry.id === appointmentId),
    );

    const persisted = JSON.stringify(snapshot);
    expect(persisted).not.toContain('"obligations"');
    expect(persisted).not.toContain('"characterIntent"');
    expect(persisted).not.toContain('"characterPresence"');
  });

  it('produces equivalent canonical and projected results for one large jump and minute-by-minute progression', () => {
    const jumped = makeTravelFixture();
    const stepped = makeTravelFixture();
    expect(stepped.actorId).toBe(jumped.actorId);
    expect(stepped.appointmentId).toBe(jumped.appointmentId);

    jumped.sim.advanceGameMinutes(600, 'life gate single jump');
    for (let minute = 0; minute < 600; minute++) {
      stepped.sim.advanceGameMinutes(1, 'life gate minute step');
    }

    const actorId = jumped.actorId;
    expect(jumped.sim.clock.getTotalMinutes()).toBe(stepped.sim.clock.getTotalMinutes());
    expect(jumped.sim.getNpcTrip(actorId)).toEqual(stepped.sim.getNpcTrip(actorId));
    expect(jumped.sim.getNpcPlaceState(actorId)).toEqual(stepped.sim.getNpcPlaceState(actorId));
    expect(jumped.sim.getCharacterObligations(actorId)).toEqual(
      stepped.sim.getCharacterObligations(actorId),
    );
    expect(jumped.sim.getCharacterIntent(actorId)).toEqual(stepped.sim.getCharacterIntent(actorId));
    expect(resolveCharacterPresenceFromSimulation(jumped.sim, actorId, presenceOptions)).toEqual(
      resolveCharacterPresenceFromSimulation(stepped.sim, actorId, presenceOptions),
    );
    expect(jumped.sim.world.getAppointments().find((entry) => entry.id === jumped.appointmentId)).toEqual(
      stepped.sim.world.getAppointments().find((entry) => entry.id === stepped.appointmentId),
    );
    expect(jumped.sim.social.getRelationships(actorId)).toEqual(
      stepped.sim.social.getRelationships(actorId),
    );
  });
});
