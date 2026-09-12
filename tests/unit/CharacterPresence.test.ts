import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { TravelPlan } from '../../src/engine/transit/types';

function localActor(sim: SimulationEngine) {
  const actor = sim.social.getBuddies().find((buddy) => buddy.reach !== 'remote');
  if (!actor) throw new Error('Expected at least one local Away character.');
  return actor;
}

function remoteActor(sim: SimulationEngine) {
  const actor = sim.social.getBuddies().find((buddy) => buddy.reach === 'remote');
  if (!actor) throw new Error('Expected at least one remote Away character.');
  return actor;
}

function withMobility(sim: SimulationEngine, npcMobility: unknown): SimulationEngine {
  const snapshot = JSON.parse(JSON.stringify(sim.exportSnapshot())) as Record<string, unknown>;
  snapshot.npcMobility = npcMobility;
  return new SimulationEngine(snapshot as never);
}

function resolvePresence(
  sim: SimulationEngine,
  actorId: string,
  options?: { atMinute?: number; playerPlaceId?: string },
) {
  const resolver = (sim as unknown as {
    resolveCharacterPresence?: (id: string, opts?: { atMinute?: number; playerPlaceId?: string }) => unknown;
  }).resolveCharacterPresence;
  expect(typeof resolver).toBe('function');
  return resolver!.call(sim, actorId, options) as {
    actorId: string;
    physical: { kind: string; placeId?: string; originPlaceId?: string; destinationPlaceId?: string };
    communication: { status: string; legacyStatus: string; awayMessage: string };
    availability: { canMessage: boolean; canCall: boolean; canInteractInPerson: boolean };
    reasonCodes: string[];
  } | null;
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
    first.social.setPresence(actor.id, { status: 'online', awayMessage: 'around' });
    const sim = withMobility(first, { trips: {}, places: { [actor.id]: 'place_a1' } });

    expect(resolvePresence(sim, actor.id, { atMinute: 600, playerPlaceId: 'place_a1' })).toMatchObject({
      actorId: actor.id,
      physical: { kind: 'at_place', placeId: 'place_a1' },
      communication: { status: 'online_active', legacyStatus: 'online', awayMessage: 'around' },
      availability: { canMessage: true, canCall: true, canInteractInPerson: true },
    });
  });

  it('uses #37 transit truth to suppress impossible home-PC active presence', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    first.social.setPresence(actor.id, { status: 'online', awayMessage: 'home pc still logged in' });
    const sim = withMobility(first, {
      trips: { [actor.id]: activeTrip(actor.id) },
      places: { [actor.id]: 'place_a1' },
    });

    const projected = resolvePresence(sim, actor.id, { atMinute: 615, playerPlaceId: 'place_a1' });
    expect(projected).not.toBeNull();
    expect(projected!.physical).toMatchObject({
      kind: 'in_transit',
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
    });
    expect(projected!.communication.status).not.toBe('online_active');
    expect(projected!.availability.canCall).toBe(false);
    expect(projected!.availability.canInteractInPerson).toBe(false);
    expect(projected!.reasonCodes).toContain('transit_suppresses_active_device');
  });

  it('treats a planned trip as still physically at its origin before departure', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    first.social.setPresence(actor.id, { status: 'away', awayMessage: 'heading out soon' });
    const record = { ...activeTrip(actor.id), status: 'planned' };
    const sim = withMobility(first, {
      trips: { [actor.id]: record },
      places: { [actor.id]: 'place_a1' },
    });

    expect(resolvePresence(sim, actor.id, { atMinute: 590, playerPlaceId: 'place_a1' })).toMatchObject({
      physical: { kind: 'at_place', placeId: 'place_a1' },
      communication: { status: 'away', legacyStatus: 'away' },
      availability: { canInteractInPerson: true },
      reasonCodes: expect.arrayContaining(['departure_planned']),
    });
  });

  it('keeps remote identity remote while preserving valid messenger presence', () => {
    const first = new SimulationEngine();
    const actor = remoteActor(first);
    first.social.setPresence(actor.id, { status: 'online', awayMessage: 'online' });
    const sim = withMobility(first, { trips: {}, places: {} });

    expect(resolvePresence(sim, actor.id, { atMinute: 600, playerPlaceId: 'place_a1' })).toMatchObject({
      actorId: actor.id,
      physical: { kind: 'remote' },
      communication: { status: 'online_active', legacyStatus: 'online' },
      availability: { canMessage: true, canInteractInPerson: false },
    });
  });

  it('does not persist the derived presence projection as a second source of truth', () => {
    const first = new SimulationEngine();
    const actor = localActor(first);
    const sim = withMobility(first, { trips: {}, places: { [actor.id]: 'place_a1' } });
    resolvePresence(sim, actor.id, { atMinute: 600 });

    const snapshotJson = JSON.stringify(sim.exportSnapshot());
    expect(snapshotJson).not.toContain('characterPresence');
    expect(snapshotJson).not.toContain('presenceProjection');
    expect(snapshotJson).not.toContain('reasonCodes');
  });
});
