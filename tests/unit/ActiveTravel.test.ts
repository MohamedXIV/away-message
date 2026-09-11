import { describe, expect, it } from 'vitest';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { planTravel } from '../../src/engine/transit/TravelPlanner';
import {
  cancelTravel,
  commitTravelPlan,
  parseActiveTravel,
  serializeActiveTravel,
  travelStateAtMinute,
} from '../../src/engine/transit/ActiveTravel';
import { twoLineFixture } from './transitFixtures';

function committedFixture() {
  const network = buildTransitNetwork(twoLineFixture());
  const result = planTravel(network, {
    originPlaceId: 'place_a1',
    destinationPlaceId: 'place_b1',
    departAtMinute: 600,
  });
  if (!result.ok) throw new Error('Expected a bus plan.');
  // Legs: walk 4 (600-604), wait 16 (604-620), bus 12 (620-632), walk 5 (632-637).
  return commitTravelPlan('player', result.plan, 600);
}

describe('ActiveTravel trip contract (#35 slice 5)', () => {
  it('commits a plan into an active trip snapshot', () => {
    const state = committedFixture();
    expect(state.actorId).toBe('player');
    expect(state.status).toBe('active');
    expect(state.currentLegIndex).toBe(0);
    expect(state.committedAtMinute).toBe(600);
    expect(state.farePaid).toBe(2);
    expect(state.plan.arriveAtMinute).toBe(637);
  });

  it('resolves leg position at any clock minute', () => {
    const state = committedFixture();
    expect(travelStateAtMinute(state, 599)).toMatchObject({ status: 'active', currentLegIndex: 0 });
    expect(travelStateAtMinute(state, 602)).toMatchObject({ status: 'active', currentLegIndex: 0 });
    expect(travelStateAtMinute(state, 610)).toMatchObject({ status: 'active', currentLegIndex: 1 });
    expect(travelStateAtMinute(state, 625)).toMatchObject({ status: 'active', currentLegIndex: 2 });
    expect(travelStateAtMinute(state, 635)).toMatchObject({ status: 'active', currentLegIndex: 3 });
    expect(travelStateAtMinute(state, 637)).toMatchObject({ status: 'arrived' });
    expect(travelStateAtMinute(state, 900)).toMatchObject({ status: 'arrived' });
  });

  it('cancels immutably and freezes cancelled trips', () => {
    const state = committedFixture();
    const cancelled = cancelTravel(state);
    expect(cancelled.status).toBe('cancelled');
    expect(state.status).toBe('active');
    expect(travelStateAtMinute(cancelled, 900)).toMatchObject({ status: 'cancelled' });
  });

  it('round-trips through JSON serialization', () => {
    const state = committedFixture();
    const revived = parseActiveTravel(JSON.parse(serializeActiveTravel(state)) as unknown);
    expect(revived).toEqual(state);
    expect(travelStateAtMinute(revived, 625)).toMatchObject({ status: 'active', currentLegIndex: 2 });
  });

  it('rejects malformed serialized trips', () => {
    expect(() => parseActiveTravel(null)).toThrow(/ActiveTravelState/);
    expect(() => parseActiveTravel({ actorId: 'player' })).toThrow(/ActiveTravelState/);
  });
});
