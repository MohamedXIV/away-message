import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  characterPresenceToLegacyBuddyPresence,
  resolveCharacterPresence,
  resolveCharacterPresenceFromSimulation,
  resolveLegacyBuddyPresenceFromSimulation,
} from '../../src/engine/life';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { BuddyPresence } from '../../src/engine/types';
import type { TravelPlan } from '../../src/engine/transit/types';

function localActor(sim: SimulationEngine) {
  const actor = sim.social.getBuddies().find((buddy) => buddy.reach !== 'remote');
  if (!actor) throw new Error('Expected at least one local Away character.');
  return actor;
}

function withCanonicalState(
  sim: SimulationEngine,
  actorId: string,
  presence: BuddyPresence,
  npcMobility: unknown,
): SimulationEngine {
  const snapshot = JSON.parse(JSON.stringify(sim.exportSnapshot())) as {
    social: { presence: Record<string, BuddyPresence> };
    npcMobility?: unknown;
  };
  snapshot.social.presence[actorId] = presence;
  snapshot.npcMobility = npcMobility;
  return new SimulationEngine(snapshot as never);
}

function activeTrip(actorId: string, departAtMinute = 600) {
  const arriveAtMinute = departAtMinute + 30;
  const plan: TravelPlan = {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute,
    arriveAtMinute,
    legs: [{ kind: 'walk', fromPlaceId: 'place_a1', toPlaceId: 'place_b1', minutes: 30 }],
    walkMinutes: 30,
    waitMinutes: 0,
    rideMinutes: 0,
    totalMinutes: 30,
    fare: 0,
    transferCount: 0,
    busLineIds: [],
  };
  return {
    trip: commitTravelPlan(actorId, plan, departAtMinute, 'presence-test'),
    intentKind: 'travel_to_place',
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    plannedDepartureMinute: departAtMinute,
    expectedArrivalMinute: arriveAtMinute,
    policy: 'fastest',
    status: 'active',
  };
}

describe('coherent character presence (#45)', () => {
  it('preserves legacy online behavior for a local actor whose physical place is known', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'online', awayMessage: 'around' },
      { trips: {}, places: { [actor.id]: 'place_a1' } },
    );

    expect(resolveCharacterPresenceFromSimulation(sim, actor.id, {
      atMinute: 600,
      playerPlaceId: 'place_a1',
    })).toMatchObject({
      actorId: actor.id,
      physical: { kind: 'at_place', placeId: 'place_a1' },
      communication: { status: 'online_active', legacyStatus: 'online', awayMessage: 'around' },
      availability: { canMessage: true, canCall: true, canInteractInPerson: true },
    });
  });

  it('uses #37 transit truth to suppress impossible home-PC active presence', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'online', awayMessage: 'home pc still logged in' },
      {
        trips: { [actor.id]: activeTrip(actor.id) },
        places: { [actor.id]: 'place_a1' },
      },
    );

    const projected = resolveCharacterPresenceFromSimulation(sim, actor.id, {
      atMinute: 615,
      playerPlaceId: 'place_a1',
    });
    expect(projected).not.toBeNull();
    expect(projected!.physical).toMatchObject({
      kind: 'in_transit',
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
    });
    expect(projected!.communication.status).toBe('online_idle');
    expect(projected!.availability.canCall).toBe(false);
    expect(projected!.availability.canInteractInPerson).toBe(false);
    expect(projected!.reasonCodes).toContain('transit_suppresses_active_device');
  });

  it('preserves an unattended away/login state while the actor is elsewhere', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'away', awayMessage: 'afk - back later' },
      {
        trips: { [actor.id]: activeTrip(actor.id) },
        places: { [actor.id]: 'place_a1' },
      },
    );

    expect(resolveCharacterPresenceFromSimulation(sim, actor.id, { atMinute: 615 })).toMatchObject({
      physical: { kind: 'in_transit' },
      communication: {
        status: 'away',
        legacyStatus: 'away',
        awayMessage: 'afk - back later',
      },
      availability: { canMessage: true, canCall: false, canInteractInPerson: false },
    });
  });

  it('allows active online projection in transit only with explicit portable-device context', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'online', awayMessage: 'online' },
      {
        trips: { [actor.id]: activeTrip(actor.id) },
        places: { [actor.id]: 'place_a1' },
      },
    );

    expect(resolveCharacterPresenceFromSimulation(sim, actor.id, {
      atMinute: 615,
      hasPortableMessagingDevice: true,
    })).toMatchObject({
      physical: { kind: 'in_transit' },
      communication: { status: 'online_active' },
      availability: { canMessage: true, canCall: false, canInteractInPerson: false },
    });
  });

  it('treats a planned trip as still physically at its origin before departure', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const record = { ...activeTrip(actor.id), status: 'planned' };
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'away', awayMessage: 'heading out soon' },
      {
        trips: { [actor.id]: record },
        places: { [actor.id]: 'place_a1' },
      },
    );

    expect(resolveCharacterPresenceFromSimulation(sim, actor.id, {
      atMinute: 590,
      playerPlaceId: 'place_a1',
    })).toMatchObject({
      physical: { kind: 'at_place', placeId: 'place_a1' },
      communication: { status: 'away', legacyStatus: 'away' },
      availability: { canInteractInPerson: true },
      reasonCodes: expect.arrayContaining(['departure_planned']),
    });
  });

  it('projects remote identity without inventing a local place', () => {
    expect(resolveCharacterPresence({
      actorId: 'remote-test',
      place: { status: 'unknown' },
      legacyPresence: { status: 'online', awayMessage: 'online from elsewhere' },
      reach: 'remote',
    })).toMatchObject({
      actorId: 'remote-test',
      physical: { kind: 'remote' },
      communication: { status: 'online_active' },
      availability: { canMessage: true, canInteractInPerson: false },
    });
  });

  it('makes unavailable lifecycle states offline without mutating their legacy presence', () => {
    const result = resolveCharacterPresence({
      actorId: 'blocked-test',
      place: { status: 'at_place', placeId: 'place_a1' },
      legacyPresence: { status: 'online', awayMessage: 'legacy online' },
      reach: 'local',
      lifecycleStatus: 'blocked',
      playerPlaceId: 'place_a1',
    });

    expect(result.communication).toMatchObject({
      status: 'offline',
      legacyStatus: 'online',
      awayMessage: 'legacy online',
    });
    expect(result.availability).toEqual({
      canMessage: false,
      canCall: false,
      canInteractInPerson: false,
    });
    expect(result.reasonCodes).toContain('lifecycle_unavailable');
  });

  it('reconstructs the same mid-transit projection after save/reload', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const startMinute = first.clock.getTotalMinutes();
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'online', awayMessage: 'logged in' },
      {
        trips: { [actor.id]: activeTrip(actor.id, startMinute) },
        places: { [actor.id]: 'place_a1' },
      },
    );

    sim.advanceGameMinutes(15, 'presence mid-transit save');
    const before = resolveCharacterPresenceFromSimulation(sim, actor.id);
    const restored = new SimulationEngine(sim.exportSnapshot());
    const after = resolveCharacterPresenceFromSimulation(restored, actor.id);

    expect(before).toEqual(after);
    expect(after?.physical.kind).toBe('in_transit');
  });

  it('large time jump and minute-by-minute progression end with equivalent presence', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const startMinute = first.clock.getTotalMinutes();
    const seeded = withCanonicalState(
      first,
      actor.id,
      { status: 'away', awayMessage: 'out' },
      {
        trips: { [actor.id]: activeTrip(actor.id, startMinute) },
        places: { [actor.id]: 'place_a1' },
      },
    );
    const snapshot = seeded.exportSnapshot();
    const jumped = new SimulationEngine(snapshot);
    const stepped = new SimulationEngine(snapshot);

    jumped.advanceGameMinutes(30, 'presence large jump');
    for (let i = 0; i < 30; i += 1) stepped.advanceGameMinutes(1, 'presence stepped');

    const jumpPresence = resolveCharacterPresenceFromSimulation(jumped, actor.id);
    const stepPresence = resolveCharacterPresenceFromSimulation(stepped, actor.id);
    expect(jumpPresence).toEqual(stepPresence);
    expect(jumpPresence?.physical).toEqual({ kind: 'at_place', placeId: 'place_b1' });
  });

  it('maps coherent status back to legacy Pulse presence without reviving active-home contradiction', () => {
    const coherent = resolveCharacterPresence({
      actorId: 'legacy-pulse-test',
      place: {
        status: 'in_transit',
        originPlaceId: 'place_a1',
        destinationPlaceId: 'place_b1',
        legIndex: 0,
        legKind: 'walk',
      },
      legacyPresence: {
        status: 'online',
        awayMessage: 'left this logged in',
        customAwayMessage: 'brb',
      },
      reach: 'local',
    });

    expect(characterPresenceToLegacyBuddyPresence(coherent)).toEqual({
      status: 'away',
      awayMessage: 'left this logged in',
      customAwayMessage: 'brb',
    });
  });

  it('offers a one-call legacy migration seam for existing Pulse readers', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withCanonicalState(
      first,
      actor.id,
      { status: 'online', awayMessage: 'still logged in' },
      {
        trips: { [actor.id]: activeTrip(actor.id) },
        places: { [actor.id]: 'place_a1' },
      },
    );

    expect(resolveLegacyBuddyPresenceFromSimulation(sim, actor.id, { atMinute: 615 })).toEqual({
      status: 'away',
      awayMessage: 'still logged in',
    });
    expect(sim.social.getPresence(actor.id)).toEqual({
      status: 'online',
      awayMessage: 'still logged in',
    });
  });

  it('does not persist the derived presence projection as a second source of truth', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const legacy = first.social.getPresence(actor.id) ?? { status: 'offline', awayMessage: 'offline' };
    const sim = withCanonicalState(
      first,
      actor.id,
      legacy,
      { trips: {}, places: { [actor.id]: 'place_a1' } },
    );
    resolveCharacterPresenceFromSimulation(sim, actor.id, { atMinute: 600 });

    const snapshotJson = JSON.stringify(sim.exportSnapshot());
    expect(snapshotJson).not.toContain('characterPresence');
    expect(snapshotJson).not.toContain('presenceProjection');
    expect(snapshotJson).not.toContain('reasonCodes');
  });
});
