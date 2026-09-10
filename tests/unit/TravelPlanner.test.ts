import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { planTravel } from '../../src/engine/transit/TravelPlanner';
import { twoLineFixture } from './transitFixtures';

/** Fixture plus a second place sharing stop_a (walkable without any bus). */
function sharedStopFixture() {
  const fixture = twoLineFixture();
  fixture.places.push({
    id: 'place_a2',
    districtId: 'district_a',
    name: 'Place A2',
    transitAccess: [{ stopId: 'stop_a', walkMinutes: 6 }],
  });
  return fixture;
}

describe('TravelPlanner walking (#35 slice 2)', () => {
  it('returns a zero no-op plan for a place to itself', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a1',
      departAtMinute: 600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a no-op plan.');
    expect(result.plan.totalMinutes).toBe(0);
    expect(result.plan.fare).toBe(0);
    expect(result.plan.legs).toEqual([]);
    expect(result.plan.arriveAtMinute).toBe(600);
  });

  it('fails loudly on unknown origin/destination places', () => {
    const network = buildTransitNetwork(twoLineFixture());
    expect(
      planTravel(network, {
        originPlaceId: 'place_ghost',
        destinationPlaceId: 'place_a1',
        departAtMinute: 600,
      }),
    ).toEqual({ ok: false, reason: 'unknown_origin' });
    expect(
      planTravel(network, {
        originPlaceId: 'place_a1',
        destinationPlaceId: 'place_ghost',
        departAtMinute: 600,
      }),
    ).toEqual({ ok: false, reason: 'unknown_destination' });
  });

  it('walks between places that share a stop', () => {
    const network = buildTransitNetwork(sharedStopFixture());
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a2',
      departAtMinute: 600,
      policy: 'walk_only',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a walk plan.');
    expect(result.plan.legs).toEqual([
      { kind: 'walk', fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
      { kind: 'walk', fromStopId: 'stop_a', toPlaceId: 'place_a2', minutes: 6 },
    ]);
    expect(result.plan.walkMinutes).toBe(10);
    expect(result.plan.waitMinutes).toBe(0);
    expect(result.plan.rideMinutes).toBe(0);
    expect(result.plan.totalMinutes).toBe(10);
    expect(result.plan.fare).toBe(0);
    expect(result.plan.transferCount).toBe(0);
    expect(result.plan.arriveAtMinute).toBe(610);
  });

  it('reports no_route for walk_only across unconnected places', () => {
    const network = buildTransitNetwork(twoLineFixture());
    expect(
      planTravel(network, {
        originPlaceId: 'place_a1',
        destinationPlaceId: 'place_b1',
        departAtMinute: 600,
        policy: 'walk_only',
      }),
    ).toEqual({ ok: false, reason: 'no_route' });
  });

  it('applies the rain walking multiplier per leg', () => {
    const network = buildTransitNetwork(sharedStopFixture());
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a2',
      departAtMinute: 600,
      policy: 'walk_only',
      raining: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a rainy walk plan.');
    // ceil(4 * 1.25) + ceil(6 * 1.25) = 5 + 8.
    expect(result.plan.walkMinutes).toBe(13);
    expect(result.plan.totalMinutes).toBe(13);
    expect(result.plan.arriveAtMinute).toBe(613);
  });
});

describe('TravelPlanner single-line bus (#35 slice 3)', () => {
  it('rides one line with walk access, wait, ride and fare totals', () => {
    const network = buildTransitNetwork(twoLineFixture());
    // Depart 10:00 from place_a1: walk 4 to stop_a (arrive 604),
    // next line_ab departure boards 620, rides 12, alights 632, walks 5.
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a bus plan.');
    expect(result.plan.legs).toEqual([
      { kind: 'walk', fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
      { kind: 'wait', stopId: 'stop_a', lineId: 'line_ab', minutes: 16, boardAtMinute: 620 },
      {
        kind: 'bus',
        lineId: 'line_ab',
        fromStopId: 'stop_a',
        toStopId: 'stop_b',
        boardAtMinute: 620,
        alightAtMinute: 632,
        minutes: 12,
      },
      { kind: 'walk', fromStopId: 'stop_b', toPlaceId: 'place_b1', minutes: 5 },
    ]);
    expect(result.plan.walkMinutes).toBe(9);
    expect(result.plan.waitMinutes).toBe(16);
    expect(result.plan.rideMinutes).toBe(12);
    expect(result.plan.totalMinutes).toBe(37);
    expect(result.plan.fare).toBe(2);
    expect(result.plan.transferCount).toBe(0);
    expect(result.plan.busLineIds).toEqual(['line_ab']);
    expect(result.plan.arriveAtMinute).toBe(637);
  });

  it('derives wait from the line headway (06:07 departure)', () => {
    const network = buildTransitNetwork(twoLineFixture());
    // Walk 4 to stop_a (arrive 371); departures every 20 from 06:00 → board 380.
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 367,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a bus plan.');
    expect(result.plan.waitMinutes).toBe(9);
    expect(result.plan.rideMinutes).toBe(12);
    expect(result.plan.walkMinutes).toBe(9);
    expect(result.plan.totalMinutes).toBe(30);
    expect(result.plan.arriveAtMinute).toBe(397);
  });

  it('reports service_ended after the last run instead of inventing service', () => {
    const network = buildTransitNetwork(twoLineFixture());
    expect(
      planTravel(network, {
        originPlaceId: 'place_a1',
        destinationPlaceId: 'place_b1',
        departAtMinute: 1400,
      }),
    ).toEqual({ ok: false, reason: 'service_ended' });
  });

  it('does not ride a line backwards (forward-only service)', () => {
    const network = buildTransitNetwork(twoLineFixture());
    expect(
      planTravel(network, {
        originPlaceId: 'place_b1',
        destinationPlaceId: 'place_a1',
        departAtMinute: 600,
      }),
    ).toEqual({ ok: false, reason: 'no_route' });
  });

  it('cheapest prefers reachable walking, otherwise falls back to bus', () => {
    const network = buildTransitNetwork(sharedStopFixture());
    const walk = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a2',
      departAtMinute: 600,
      policy: 'cheapest',
    });
    expect(walk.ok).toBe(true);
    if (!walk.ok) throw new Error('Expected a cheapest walk plan.');
    expect(walk.plan.fare).toBe(0);
    expect(walk.plan.busLineIds).toEqual([]);

    const bus = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      policy: 'cheapest',
    });
    expect(bus.ok).toBe(true);
    if (!bus.ok) throw new Error('Expected a cheapest bus fallback.');
    expect(bus.plan.busLineIds).toEqual(['line_ab']);
  });

  it('prefer_bus takes the bus when walking cannot connect', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_b1',
      departAtMinute: 600,
      policy: 'prefer_bus',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a prefer_bus plan.');
    expect(result.plan.busLineIds).toEqual(['line_ab']);
    expect(result.plan.fare).toBe(2);
  });
});

describe('TravelPlanner transfers and tie-breaks (#35 slice 4)', () => {
  it('plans a one-transfer itinerary with schedule-derived transfer wait', () => {
    const network = buildTransitNetwork(twoLineFixture());
    // Depart 10:00 place_a1 → place_c1: walk 4 (stop_a 604), board line_ab
    // 620, alight stop_b 632; line_bc headway 30 → board 660 (wait 28),
    // alight stop_c 669, walk 3 → arrive 672.
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_c1',
      departAtMinute: 600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a transfer plan.');
    expect(result.plan.legs).toEqual([
      { kind: 'walk', fromPlaceId: 'place_a1', toStopId: 'stop_a', minutes: 4 },
      { kind: 'wait', stopId: 'stop_a', lineId: 'line_ab', minutes: 16, boardAtMinute: 620 },
      {
        kind: 'bus',
        lineId: 'line_ab',
        fromStopId: 'stop_a',
        toStopId: 'stop_b',
        boardAtMinute: 620,
        alightAtMinute: 632,
        minutes: 12,
      },
      { kind: 'wait', stopId: 'stop_b', lineId: 'line_bc', minutes: 28, boardAtMinute: 660 },
      {
        kind: 'bus',
        lineId: 'line_bc',
        fromStopId: 'stop_b',
        toStopId: 'stop_c',
        boardAtMinute: 660,
        alightAtMinute: 669,
        minutes: 9,
      },
      { kind: 'walk', fromStopId: 'stop_c', toPlaceId: 'place_c1', minutes: 3 },
    ]);
    expect(result.plan.walkMinutes).toBe(7);
    expect(result.plan.waitMinutes).toBe(44);
    expect(result.plan.rideMinutes).toBe(21);
    expect(result.plan.totalMinutes).toBe(72);
    expect(result.plan.fare).toBe(2);
    expect(result.plan.transferCount).toBe(1);
    expect(result.plan.busLineIds).toEqual(['line_ab', 'line_bc']);
    expect(result.plan.arriveAtMinute).toBe(672);
  });

  it('breaks equal-arrival ties by lower fare (walk beats bus)', () => {
    const fixture = twoLineFixture();
    // place_a3 reachable both ways: walk 4 + 30 = 34, bus 4 + 16 wait +
    // 12 ride + 2 final walk = 34. Same arrival → fare 0 wins over fare 2.
    fixture.places.push({
      id: 'place_a3',
      districtId: 'district_a',
      name: 'Place A3',
      transitAccess: [
        { stopId: 'stop_a', walkMinutes: 30 },
        { stopId: 'stop_b', walkMinutes: 2 },
      ],
    });
    const network = buildTransitNetwork(fixture);
    const result = planTravel(network, {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_a3',
      departAtMinute: 600,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected a tie-break plan.');
    expect(result.plan.arriveAtMinute).toBe(634);
    expect(result.plan.fare).toBe(0);
    expect(result.plan.busLineIds).toEqual([]);
    expect(result.plan.legs.every((leg) => leg.kind === 'walk')).toBe(true);
  });

  it('gives player and NPC callers the same plan for the same inputs', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const request = {
      originPlaceId: 'place_a1',
      destinationPlaceId: 'place_c1',
      departAtMinute: 600,
    } as const;
    const playerPlan = planTravel(network, { ...request });
    const npcPlan = planTravel(network, { ...request, policy: 'fastest' });
    expect(playerPlan).toEqual(npcPlan);
    expect(JSON.stringify(playerPlan)).toBe(JSON.stringify(npcPlan));
    // Repeated reads are stable.
    expect(planTravel(network, { ...request })).toEqual(playerPlan);
  });
});
