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
