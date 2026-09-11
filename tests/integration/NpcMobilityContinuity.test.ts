import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function firstActor(sim: SimulationEngine): string {
  const [actor] = sim.social.getBuddies();
  if (!actor) throw new Error('Expected at least one Away character.');
  return actor.id;
}

/** Fresh engine with the actor's mobility origin seeded at place_a1. */
function engineAtPlaceA(): { sim: SimulationEngine; actor: string } {
  const probe = new SimulationEngine();
  const actor = firstActor(probe);
  const sim = new SimulationEngine({
    npcMobility: { trips: {}, places: { [actor]: 'place_a1' } },
  });
  return { sim, actor };
}

function schedulePlaceBAppointment(sim: SimulationEngine, actor: string, startMinute = 1080) {
  const day = sim.clock.getTime().day;
  return sim.world.scheduleAppointment({
    id: `trip_appt_${actor}`,
    characterId: actor,
    locationId: 'place_b1',
    targetDay: day,
    startMinute,
    endMinute: startMinute + 60,
    description: 'Continuity fixture meeting',
    status: 'confirmed',
    rsvp: 'yes',
  });
}

describe('NPC mobility continuity (#37)', () => {
  it('4. actor stays at origin until the planned departure minute', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');

    const trip = sim.getNpcTrip(actor);
    expect(trip).not.toBeNull();
    expect(trip?.status).toBe('planned');
    expect(sim.getNpcMobilityState().places[actor]).toBe('place_a1');
    expect(sim.getNpcPlaceState(actor).status).not.toBe('in_transit');
  });

  it('6/18. transit progresses leg by leg and arrives only after the duration', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');
    const planned = sim.getNpcTrip(actor);
    if (!planned) throw new Error('Expected a planned trip.');
    const { plannedDepartureMinute, expectedArrivalMinute } = planned;
    expect(expectedArrivalMinute).toBeGreaterThan(plannedDepartureMinute);

    // Just before departure: still planned.
    sim.advanceGameMinutes(plannedDepartureMinute - sim.clock.getTotalMinutes() - 1, 'to eve of departure');
    expect(sim.getNpcTrip(actor)?.status).toBe('planned');

    // Departure minute: in transit on the first leg.
    sim.advanceGameMinutes(1, 'depart');
    const departed = sim.getNpcTrip(actor);
    expect(departed?.status).toBe('active');
    expect(sim.getNpcPlaceState(actor).status).toBe('in_transit');

    // One minute before arrival: still in transit.
    sim.advanceGameMinutes(expectedArrivalMinute - sim.clock.getTotalMinutes() - 1, 'almost there');
    expect(sim.getNpcTrip(actor)?.status).toBe('active');

    // Arrival minute: arrived at the destination, never before.
    sim.advanceGameMinutes(1, 'arrive');
    expect(sim.getNpcTrip(actor)?.status).toBe('arrived');
    expect(sim.getNpcMobilityState().places[actor]).toBe('place_b1');
    expect(sim.getNpcPlaceState(actor)).toEqual({ status: 'at_place', placeId: 'place_b1' });
  });

  it('7/21. travel never marks appointment/job/social outcomes', () => {
    const { sim, actor } = engineAtPlaceA();
    const appointment = schedulePlaceBAppointment(sim, actor);
    expect(appointment).not.toBeNull();
    const relationshipsBefore = sim.social.getRelationships(actor);
    const cashBefore = sim.economy.getState().cash;

    sim.advanceGameMinutes(60, 'planning tick');
    const planned = sim.getNpcTrip(actor);
    if (!planned) throw new Error('Expected a planned trip.');
    sim.advanceGameMinutes(planned.expectedArrivalMinute - sim.clock.getTotalMinutes(), 'travel to arrival');
    const trip = sim.getNpcTrip(actor);
    expect(trip?.status).toBe('arrived');

    // The appointment owner still sees a confirmed, undecided appointment.
    const afterAppt = sim.world.getAppointments().find((a) => a.id === appointment?.id);
    expect(afterAppt?.status).toBe('confirmed');
    expect(afterAppt?.isCompleted).toBe(false);
    expect(afterAppt?.isMissed).toBe(false);
    // No relationship or economy consequence was written by mobility.
    expect(sim.social.getRelationships(actor)).toEqual(relationshipsBefore);
    expect(sim.economy.getState().cash).toBe(cashBefore);
  });

  it('8b. unmapped legacy destinations fail deterministically without side effects', () => {
    const { sim, actor } = engineAtPlaceA();
    const day = sim.clock.getTime().day;
    sim.world.scheduleAppointment({
      id: `trip_appt_legacy_${actor}`,
      characterId: actor,
      locationId: 'cafe',
      targetDay: day,
      startMinute: 1080,
      endMinute: 1140,
      description: 'Legacy fixture meeting',
      status: 'confirmed',
      rsvp: 'yes',
    });
    const beforeAppointments = sim.world.getAppointments();
    sim.advanceGameMinutes(60, 'planning tick');

    const trip = sim.getNpcTrip(actor);
    expect(trip?.status).toBe('failed');
    expect(trip?.failureReason).toBe('unknown_destination');
    expect(sim.world.getAppointments()).toEqual(beforeAppointments);
    // Origin truth is untouched by the failure.
    expect(sim.getNpcMobilityState().places[actor]).toBe('place_a1');
  });

  it('13b. active trip exposes #45-ready truth (origin, destination, leg)', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(600, 'travel past arrival');
    const trip = sim.getNpcTrip(actor);
    expect(trip).not.toBeNull();
    expect(trip).toMatchObject({ originPlaceId: 'place_a1', destinationPlaceId: 'place_b1' });
    expect(typeof trip?.plannedDepartureMinute).toBe('number');
    expect(typeof trip?.expectedArrivalMinute).toBe('number');
    expect(typeof trip?.sourceId).toBe('string');
  });

  it('14/16. save/reload mid-trip is exact and stable', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');
    const planned = sim.getNpcTrip(actor);
    if (!planned) throw new Error('Expected a planned trip.');
    // Step into the active interval (departure passed, arrival pending).
    sim.advanceGameMinutes(planned.plannedDepartureMinute - sim.clock.getTotalMinutes() + 1, 'just departed');
    expect(sim.getNpcTrip(actor)?.status).toBe('active');

    const snapshot = sim.exportSnapshot();
    const reloaded = new SimulationEngine(snapshot as never);
    expect(reloaded.exportSnapshot().npcMobility).toEqual(snapshot.npcMobility);
    expect(reloaded.getNpcTrip(actor)).toEqual(sim.getNpcTrip(actor));

    // Reloaded engine continues to the same arrival.
    const arrival = sim.getNpcTrip(actor)?.expectedArrivalMinute;
    if (arrival === undefined) throw new Error('Expected an expected arrival.');
    sim.advanceGameMinutes(arrival - sim.clock.getTotalMinutes(), 'finish');
    reloaded.advanceGameMinutes(arrival - reloaded.clock.getTotalMinutes(), 'finish');
    expect(reloaded.getNpcTrip(actor)).toEqual(sim.getNpcTrip(actor));
    expect(reloaded.exportSnapshot().npcMobility).toEqual(sim.exportSnapshot().npcMobility);
  });

  it('15. old saves receive deterministic empty mobility defaults', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');
    expect(sim.getNpcTrip(actor)).not.toBeNull();

    const snapshot = JSON.parse(JSON.stringify(sim.exportSnapshot())) as Record<string, unknown>;
    delete snapshot['npcMobility'];
    const reloaded = new SimulationEngine(snapshot as never);
    expect(reloaded.exportSnapshot().npcMobility).toEqual({ trips: {}, places: {} });

    // Planning proceeds deterministically from explicit state afterwards.
    const a = new SimulationEngine(snapshot as never);
    const b = new SimulationEngine(snapshot as never);
    a.advanceGameMinutes(60, 'tick');
    b.advanceGameMinutes(60, 'tick');
    expect(a.exportSnapshot().npcMobility).toEqual(b.exportSnapshot().npcMobility);
  });

  it('17. one 120-minute jump equals 120 one-minute steps', () => {
    const makeReady = (): { sim: SimulationEngine; actor: string } => {
      const { sim, actor } = engineAtPlaceA();
      schedulePlaceBAppointment(sim, actor);
      return { sim, actor };
    };
    const jumped = makeReady();
    const stepped = makeReady();

    jumped.sim.advanceGameMinutes(120, 'single jump');
    for (let i = 0; i < 120; i++) stepped.sim.advanceGameMinutes(1, 'step');

    expect(jumped.sim.clock.getTotalMinutes()).toBe(stepped.sim.clock.getTotalMinutes());
    expect(jumped.sim.exportSnapshot().npcMobility).toEqual(stepped.sim.exportSnapshot().npcMobility);
    expect(jumped.sim.getNpcTrip(jumped.actor)).toEqual(stepped.sim.getNpcTrip(stepped.actor));
  });

  it('19. repeated arrival processing notifies exactly once', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');
    const planned = sim.getNpcTrip(actor);
    if (!planned) throw new Error('Expected a planned trip.');
    sim.advanceGameMinutes(planned.expectedArrivalMinute - sim.clock.getTotalMinutes(), 'travel to arrival');
    expect(sim.getNpcTrip(actor)?.status).toBe('arrived');

    // exportSnapshot rebuilds fresh (getState may lag post-tick writes by design).
    const countArrivals = (engine: SimulationEngine): number =>
      engine.exportSnapshot().telemetry.logs.filter(
        (log) => log.category === 'world' && log.action === 'travel_arrived' &&
          (log.data as { actorId?: string } | undefined)?.actorId === actor,
      ).length;
    expect(countArrivals(sim)).toBe(1);

    sim.advanceGameMinutes(30, 'later');
    expect(countArrivals(sim)).toBe(1);

    const reloaded = new SimulationEngine(sim.exportSnapshot() as never);
    reloaded.advanceGameMinutes(30, 'later still');
    expect(countArrivals(reloaded)).toBe(1);
  });

  it('B1b. an arrived actor re-plans on a later appointment (honest when unreachable)', () => {
    const { sim, actor } = engineAtPlaceA();
    schedulePlaceBAppointment(sim, actor);
    sim.advanceGameMinutes(60, 'planning tick');
    const first = sim.getNpcTrip(actor);
    if (!first) throw new Error('Expected a planned trip.');
    sim.advanceGameMinutes(first.expectedArrivalMinute - sim.clock.getTotalMinutes(), 'first arrival');
    expect(sim.getNpcTrip(actor)?.status).toBe('arrived');
    expect(sim.getNpcMobilityState().places[actor]).toBe('place_b1');

    // Move past the first appointment window so its due-now intent stops
    // winning; a later appointment back at the origin then drives fresh
    // planning from the arrival place.
    sim.advanceGameMinutes(1140 - sim.clock.getTotalMinutes() + 1, 'past first window');
    const day = sim.clock.getTime().day;
    const minuteOfDay = sim.clock.getTotalMinutes() % 1440;
    sim.world.scheduleAppointment({
      id: `trip_appt_return_${actor}`,
      characterId: actor,
      locationId: 'place_a1',
      targetDay: day,
      startMinute: minuteOfDay + 120,
      endMinute: minuteOfDay + 180,
      description: 'Return fixture meeting',
      status: 'confirmed',
      rsvp: 'yes',
    });
    sim.advanceGameMinutes(30, 'replanning tick');
    const second = sim.getNpcTrip(actor);
    expect(second).not.toBeNull();
    // Generated content has no upstream/walk route back: honest failure that
    // preserves origin truth — never a stall on the stale record, never teleport.
    expect(second?.status).toBe('failed');
    expect(second?.failureReason).toBe('no_route');
    expect(second?.originPlaceId).toBe('place_b1');
    expect(Object.keys(sim.getNpcMobilityState().trips)).toEqual([actor]);
    expect(sim.getNpcMobilityState().places[actor]).toBe('place_b1');
    expect(sim.getNpcPlaceState(actor)).toEqual({ status: 'at_place', placeId: 'place_b1' });
  });
});
