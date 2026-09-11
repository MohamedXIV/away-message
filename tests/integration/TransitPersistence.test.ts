import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { commitTravelPlan, travelStateAtMinute } from '../../src/engine/transit/ActiveTravel';
import type { TravelPlan } from '../../src/engine/transit/types';

const plan: TravelPlan = {
  originPlaceId: 'room_104',
  destinationPlaceId: 'corner_mart',
  departAtMinute: 600,
  arriveAtMinute: 630,
  legs: [
    { kind: 'walk', fromPlaceId: 'room_104', toStopId: 'stop_motel', minutes: 5 },
    { kind: 'wait', stopId: 'stop_motel', lineId: 'line_1', minutes: 5, boardAtMinute: 610 },
    { kind: 'bus', lineId: 'line_1', fromStopId: 'stop_motel', toStopId: 'stop_market', boardAtMinute: 610, alightAtMinute: 625, minutes: 15 },
    { kind: 'walk', fromStopId: 'stop_market', toPlaceId: 'corner_mart', minutes: 5 },
  ],
  walkMinutes: 10,
  waitMinutes: 5,
  rideMinutes: 15,
  totalMinutes: 30,
  fare: 2,
  transferCount: 0,
  busLineIds: ['line_1'],
};

describe('SimulationEngine transit persistence (#35)', () => {
  it('round-trips the exact active journey without re-committing or losing progress identity', () => {
    const original = new SimulationEngine();
    const committed = commitTravelPlan('player', plan, 600, 'buy_groceries');
    original.setActiveTravel(committed);

    const snapshot = original.exportSnapshot();
    expect(snapshot.activeTravel).toEqual(committed);

    const restored = new SimulationEngine();
    restored.loadSnapshot(snapshot);

    const active = restored.getActiveTravel();
    expect(active).toEqual(committed);
    expect(active).not.toBe(committed);
    expect(travelStateAtMinute(active!, 617)).toMatchObject({ status: 'active', currentLegIndex: 2 });
    expect(restored.exportSnapshot().activeTravel).toEqual(committed);
  });

  it('loads older snapshots that predate active-travel persistence as no active journey', () => {
    const legacy = new SimulationEngine().exportSnapshot() as unknown as Record<string, unknown>;
    delete legacy.activeTravel;

    const restored = new SimulationEngine();
    restored.loadSnapshot(legacy as never);

    expect(restored.getActiveTravel()).toBeNull();
  });
});
