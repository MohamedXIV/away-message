import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolveCharacterPresenceFromSimulation } from '../../src/engine/life';
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

function activeTrip(actorId: string) {
  const plan: TravelPlan = {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: 600,
    arriveAtMinute: 630,
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
    trip: commitTravelPlan(actorId, plan, 600, 'presence-test'),
    intentKind: 'travel_to_place',
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    plannedDepartureMinute: 600,
    expectedArrivalMinute: 630,
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
