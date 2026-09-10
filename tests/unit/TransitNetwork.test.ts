import { describe, expect, it } from 'vitest';
import {
  GENERATED_BUS_LINES,
  GENERATED_DISTRICTS,
  GENERATED_PLACES,
  GENERATED_TRANSIT_STOPS,
} from '../../src/engine/worldContent.generated';
import { buildTransitNetwork } from '../../src/engine/transit/TransitNetwork';
import { emptyTransitServiceState } from '../../src/engine/transit/types';
import { twoLineFixture } from './transitFixtures';

describe('TransitNetwork adaptation (#35 slice 1)', () => {
  it('adapts the live generated fixture', () => {
    const network = buildTransitNetwork({
      districts: GENERATED_DISTRICTS,
      places: GENERATED_PLACES,
      stops: GENERATED_TRANSIT_STOPS,
      lines: GENERATED_BUS_LINES,
    });

    expect(network.places.get('place_a1')?.districtId).toBe('district_a');
    expect(network.accessFromPlace('place_a1')).toEqual([{ stopId: 'stop_a', walkMinutes: 4 }]);
    expect(network.linesAtStop('stop_a')).toEqual([{ lineId: 'line_ab', stopIndex: 0 }]);
    expect(network.linesAtStop('stop_b')).toEqual([{ lineId: 'line_ab', stopIndex: 1 }]);
  });

  it('adapts an in-code two-line network with a shared transfer stop', () => {
    const network = buildTransitNetwork(twoLineFixture());
    const atB = network.linesAtStop('stop_b');
    expect(atB).toContainEqual({ lineId: 'line_ab', stopIndex: 1 });
    expect(atB).toContainEqual({ lineId: 'line_bc', stopIndex: 0 });
    expect(network.accessFromPlace('place_c1')).toEqual([{ stopId: 'stop_c', walkMinutes: 3 }]);
  });

  it('fails loudly on dangling references', () => {
    const broken = twoLineFixture();
    broken.places[0]!.districtId = 'district_ghost';
    expect(() => buildTransitNetwork(broken)).toThrow(/district_ghost/);

    const brokenLine = twoLineFixture();
    brokenLine.lines[0]!.stopIds = ['stop_a', 'stop_ghost'];
    expect(() => buildTransitNetwork(brokenLine)).toThrow(/stop_ghost/);
  });

  it('builds deterministically and exposes an empty service state', () => {
    const first = buildTransitNetwork(twoLineFixture());
    const second = buildTransitNetwork(twoLineFixture());
    expect([...first.districts.keys()]).toEqual([...second.districts.keys()]);
    expect([...first.places.entries()]).toEqual([...second.places.entries()]);
    expect([...first.stops.entries()]).toEqual([...second.stops.entries()]);
    expect([...first.lines.entries()]).toEqual([...second.lines.entries()]);
    expect(first.linesAtStop('stop_b')).toEqual(second.linesAtStop('stop_b'));
    expect(first.accessFromPlace('place_a1')).toEqual(second.accessFromPlace('place_a1'));
    expect(emptyTransitServiceState()).toEqual({
      closedStopIds: [],
      closedLineIds: [],
      lineDelayMinutes: {},
      headwayMultiplier: {},
    });
  });
});
