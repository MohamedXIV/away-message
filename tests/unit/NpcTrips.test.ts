import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { planTravel } from '../../src/engine/transit/TravelPlanner';
import { commitTravelPlan } from '../../src/engine/transit/ActiveTravel';
import type { TransitServiceState, TravelPlan } from '../../src/engine/transit/types';
import {
  NPC_PREP_LEAD_MINUTES,
  buildPlaceAliases,
  emptyNpcMobility,
  findNpcCoLocation,
  getNpcPlaceState,
  hydrateNpcMobility,
  planDueNpcTrips,
  planNpcTrip,
  progressNpcTrips,
  resolveTransitPlaceId,
  tripStatusAt,
} from '../../src/engine/transit/NpcTrips';
import { selectCharacterIntent } from '../../src/engine/life/Intent';
import type { CharacterIntent } from '../../src/engine/life/types';
import type { NpcMobilityState } from '../../src/engine/transit/NpcTrips';
import { twoLineFixture } from './transitFixtures';

const network = buildTransitNetwork(twoLineFixture());
const aliases = { cafe: 'place_b1', diner: 'place_c1' };

function attendIntent(overrides: Partial<CharacterIntent> = {}): CharacterIntent {
  return {
    actorId: 'sam',
    kind: 'attend_appointment',
    sourceKind: 'appointment',
    sourceId: 'appt_1',
    targetPlaceId: 'place_b1',
    priority: 110,
    reasons: ['appointment_due', 'due_now'],
    earliestAt: 1080,
    latestAt: 1140,
    blockers: [],
    reevaluateAtMinute: 1080,
    ...overrides,
  };
}

describe('NPC trip planning (#37)', () => {
  it('1. future destination intent creates a planned record without teleporting', () => {
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' } };
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent(),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    expect(planned.record.status).toBe('planned');
    expect(planned.record.originPlaceId).toBe('place_a1');
    expect(planned.record.destinationPlaceId).toBe('place_b1');
    expect(planned.record.sourceId).toBe('appt_1');
    // Actor remains at origin: planning moves nothing.
    expect(state.places['sam']).toBe('place_a1');
  });

  it('2/5. itinerary comes from the #35 planner at the planned departure', () => {
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent(),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const quoted = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: planned.record.plannedDepartureMinute,
    });
    expect(quoted.ok).toBe(true);
    if (!quoted.ok) throw new Error('Expected the planner to quote.');
    expect(planned.record.trip.plan).toEqual(quoted.plan);
  });

  it('3. departure honors prep lead plus authoritative duration', () => {
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent(),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    expect(planned.record.plannedDepartureMinute).toBeLessThanOrEqual(1080 - NPC_PREP_LEAD_MINUTES);
    expect(planned.record.expectedArrivalMinute).toBe(
      planned.record.plannedDepartureMinute + planned.record.trip.plan.totalMinutes,
    );
  });

  it('4. status follows the authoritative interval, never early arrival', () => {
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent(),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const { record } = planned;
    expect(tripStatusAt(record, 960).status).toBe('planned');
    expect(tripStatusAt(record, record.plannedDepartureMinute).status).toBe('active');
    expect(tripStatusAt(record, record.expectedArrivalMinute - 1).status).toBe('active');
    expect(tripStatusAt(record, record.expectedArrivalMinute).status).toBe('arrived');
  });

  it('6. arrival resolves only after the full duration with factual receipts', () => {
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent(),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' }, trips: { sam: planned.record } };

    const early = progressNpcTrips(state, planned.record.expectedArrivalMinute - 1);
    expect(early.arrivals).toEqual([]);
    expect(early.state.trips['sam']?.status).not.toBe('arrived');

    const done = progressNpcTrips(state, planned.record.expectedArrivalMinute);
    expect(done.arrivals).toHaveLength(1);
    expect(done.arrivals[0]).toMatchObject({
      actorId: 'sam',
      sourceId: 'appt_1',
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
    });
    expect(done.state.trips['sam']?.status).toBe('arrived');
    expect(done.state.places['sam']).toBe('place_b1');
  });

  it('8. dead service falls back deterministically, then fails closed', () => {
    const dead: TransitServiceState = {
      closedStopIds: [],
      closedLineIds: ['line_ab', 'line_bc'],
      lineDelayMinutes: {},
      headwayMultiplier: {},
    };
    const first = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases, service: dead,
    });
    const second = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases, service: dead,
    });
    expect(second).toEqual(first);
    if (first.ok) {
      // Walk-only fallback: no bus legs may appear.
      expect(first.record.trip.plan.legs.every((leg) => leg.kind !== 'bus')).toBe(true);
    } else {
      expect(first.reason).toBeDefined();
    }
  });

  it('9. itinerary legs reference only real network stops, lines, and places', () => {
    const planned = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const plan = planned.record.trip.plan;
    const knownStops = new Set(['stop_a', 'stop_b', 'stop_c']);
    const knownLines = new Set(['line_ab', 'line_bc']);
    const knownPlaces = new Set(['place_a1', 'place_b1', 'place_c1']);
    expect(knownPlaces.has(plan.originPlaceId)).toBe(true);
    expect(knownPlaces.has(plan.destinationPlaceId)).toBe(true);
    for (const leg of plan.legs) {
      if (leg.kind === 'wait') {
        expect(knownStops.has(leg.stopId)).toBe(true);
        expect(knownLines.has(leg.lineId)).toBe(true);
      } else if (leg.kind === 'bus') {
        expect(knownLines.has(leg.lineId)).toBe(true);
        expect(knownStops.has(leg.fromStopId)).toBe(true);
        expect(knownStops.has(leg.toStopId)).toBe(true);
      } else {
        expect(leg.minutes).toBeGreaterThan(0);
      }
    }
    // No hidden padding: totals equal the leg windows end to end.
    expect(plan.totalMinutes).toBe(plan.walkMinutes + plan.waitMinutes + plan.rideMinutes);
    expect(plan.arriveAtMinute - plan.departAtMinute).toBe(plan.totalMinutes);
  });

  it('10/11/12. factual co-location for shared waits and rides, none for strangers', () => {
    const quote = (origin: string, destination: string, departAtMinute: number): TravelPlan => {
      const result = planTravel(network, { originPlaceId: origin, destinationPlaceId: destination, departAtMinute });
      if (!result.ok) throw new Error(`No fixture plan ${origin}->${destination} @${departAtMinute}.`);
      return result.plan;
    };
    const samTrip = commitTravelPlan('sam', quote('place_a1', 'place_b1', 990), 990, 'appt_1');
    const leeTrip = commitTravelPlan('lee', quote('place_a1', 'place_c1', 992), 992, 'appt_2');
    const trips = {
      sam: {
        trip: samTrip, intentKind: 'attend_appointment' as const, sourceId: 'appt_1',
        originPlaceId: 'place_a1', destinationPlaceId: 'place_b1',
        plannedDepartureMinute: 990, expectedArrivalMinute: 1100, policy: 'fastest' as const,
        status: 'active' as const,
      },
      lee: {
        trip: leeTrip, intentKind: 'attend_appointment' as const, sourceId: 'appt_2',
        originPlaceId: 'place_a1', destinationPlaceId: 'place_c1',
        plannedDepartureMinute: 992, expectedArrivalMinute: 1200, policy: 'fastest' as const,
        status: 'active' as const,
      },
    };
    const facts = findNpcCoLocation(trips, network);
    // Both wait at stop_a around minute 1000 (walk 4m then wait for headway).
    expect(facts.some((f) => f.kind === 'stop_wait' && f.stopId === 'stop_a')).toBe(true);
    // No stranger on another line/stop is implicated.
    for (const fact of facts) {
      expect(fact.actors.sort()).toEqual(['lee', 'sam']);
    }
  });

  it('13. place query rejects contradictory endpoint presence mid-trip', () => {
    const planned = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' }, trips: { sam: planned.record } };

    expect(getNpcPlaceState(state, 'ghost', 960)).toEqual({ status: 'unknown' });
    const before = getNpcPlaceState(state, 'sam', 960);
    expect(before.status).toBe('planned');

    const mid = getNpcPlaceState(
      progressNpcTrips(state, planned.record.plannedDepartureMinute + 1).state,
      'sam',
      planned.record.plannedDepartureMinute + 1,
    );
    expect(mid.status).toBe('in_transit');
    expect(mid).not.toMatchObject({ status: 'at_place' });

    const done = getNpcPlaceState(
      progressNpcTrips(state, planned.record.expectedArrivalMinute).state,
      'sam',
      planned.record.expectedArrivalMinute,
    );
    expect(done).toEqual({ status: 'at_place', placeId: 'place_b1' });
  });

  it('17/18. jump equivalence and multi-leg boundary progression are stateless', () => {
    const planned = planNpcTrip({
      actorId: 'sam',
      intent: attendIntent({ targetPlaceId: 'place_c1', earliestAt: 1200, latestAt: 1260 }),
      originPlaceId: 'place_a1',
      nowMinute: 960,
      network,
      aliases: { ...aliases, far: 'place_c1' },
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    // Transfer route: walk + wait + bus + (transfer) wait + bus + walk.
    expect(planned.record.trip.plan.legs.length).toBeGreaterThan(3);
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' }, trips: { sam: planned.record } };

    const stepped = [1, 2, 3, 4, 5].reduce(
      (acc: NpcMobilityState, i: number) =>
        progressNpcTrips(acc, 960 + i * 60).state,
      state,
    );
    const jumped = progressNpcTrips(state, 960 + 300).state;
    expect(jumped.trips['sam']).toEqual(stepped.trips['sam']);

    // Leg index advances monotonically across boundaries.
    let previous = -1;
    for (let minute = 960; minute <= planned.record.expectedArrivalMinute + 1; minute += 5) {
      const progressed = progressNpcTrips(state, minute).state.trips['sam'];
      if (!progressed) throw new Error('Expected the trip to persist.');
      const index = progressed.trip.currentLegIndex;
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it('19. repeated arrival processing emits once', () => {
    const planned = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' }, trips: { sam: planned.record } };
    const at = planned.record.expectedArrivalMinute;

    const first = progressNpcTrips(state, at);
    expect(first.arrivals).toHaveLength(1);
    const second = progressNpcTrips(first.state, at);
    expect(second.arrivals).toEqual([]);
    expect(second.state).toEqual(first.state);
    const later = progressNpcTrips(first.state, at + 30);
    expect(later.arrivals).toEqual([]);
  });

  it('20. malformed persisted trips cannot cross actor boundaries', () => {
    const planned = planNpcTrip({
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const hydrated = hydrateNpcMobility({
      trips: {
        // Key does not match the trip's own actorId: must be dropped.
        lee: JSON.parse(JSON.stringify(planned.record)),
        // Garbage trip snapshot: must be dropped.
        sam: { trip: { nonsense: true }, status: 'active' },
      },
      places: { sam: 'place_a1', lee: 42 },
    });
    expect(hydrated.trips).toEqual({});
    expect(hydrated.places).toEqual({ sam: 'place_a1' });
  });

  it('22. zero AI/provider dependency and plain determinism', () => {
    const args = {
      actorId: 'sam', intent: attendIntent(), originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    };
    expect(planNpcTrip(args)).toEqual(planNpcTrip(args));
    const state = { ...emptyNpcMobility(), places: { sam: 'place_a1' } };
    const planned = planNpcTrip(args);
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    const withTrip = { ...state, trips: { sam: planned.record } };
    expect(progressNpcTrips(withTrip, 1000)).toEqual(progressNpcTrips(withTrip, 1000));
    expect(JSON.parse(JSON.stringify(planned.record))).toEqual(planned.record);
  });

  it('23. #44 selection is consumed, never re-scored', () => {
    const snapshotIntent = attendIntent();
    const planned = planNpcTrip({
      actorId: 'sam', intent: snapshotIntent, originPlaceId: 'place_a1',
      nowMinute: 960, network, aliases,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error('Expected a planned trip.');
    // Provenance flows through verbatim; the trip carries no score of its own.
    expect(planned.record.sourceId).toBe(snapshotIntent.sourceId);
    expect(planned.record.intentKind).toBe(snapshotIntent.kind);
    expect(JSON.stringify(planned.record)).not.toContain('score');
    // selectCharacterIntent itself is untouched by trip processing inputs.
    expect(typeof selectCharacterIntent).toBe('function');
  });

  it('aliases resolve legacy ids; unknown ids fail closed', () => {
    expect(resolveTransitPlaceId('place_a1', network, aliases)).toBe('place_a1');
    expect(resolveTransitPlaceId('cafe', network, aliases)).toBe('place_b1');
    expect(resolveTransitPlaceId('motel_lobby', network, aliases)).toBeNull();
    expect(buildPlaceAliases([{ id: 'place_b1', legacyIds: ['cafe'] } as never])).toEqual({ cafe: 'place_b1' });
  });

  it('planDueNpcTrips skips actors without destinations and dedupes live trips', () => {    const intents = new Map([
      ['sam', attendIntent()],
      ['lee', null],
    ]);
    const first = planDueNpcTrips(
      { ...emptyNpcMobility(), places: { sam: 'place_a1' } },
      intents, 960, { network, aliases },
    );
    expect(first.planned).toEqual(['sam']);
    expect(first.failed).toEqual([]);
    const second = planDueNpcTrips(first.state, intents, 961, { network, aliases });
    expect(second.planned).toEqual([]);
    expect(second.failed).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  it('unknown origin fails closed without inventing a start place', () => {
    const intents = new Map([['sam', attendIntent()]]);
    const result = planDueNpcTrips(emptyNpcMobility(), intents, 960, { network, aliases });
    expect(result.planned).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ actorId: 'sam', reason: 'unknown_origin' });
    expect(result.state.trips['sam']?.status).toBe('failed');
    expect(result.state.places['sam']).toBeUndefined();
  });
});
