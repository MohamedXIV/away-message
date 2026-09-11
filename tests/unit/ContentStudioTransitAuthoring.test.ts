import { describe, expect, it } from 'vitest';
import {
  buildBusLineRow,
  buildTransitStopRow,
  resizeSegmentMinutes,
} from '../../src/tools/studio/transitAuthoring';

describe('Content Studio transit authoring', () => {
  const districts = ['district_a', 'district_b'];
  const places = {
    place_a1: { districtId: 'district_a' },
    place_b1: { districtId: 'district_b' },
  };

  it('creates stops only against real districts and compatible optional places', () => {
    expect(buildTransitStopRow('Riverside Stop', 'district_a', 'place_a1', districts, places)).toEqual({
      districtId: 'district_a',
      name: 'Riverside Stop',
      placeId: 'place_a1',
      mapX: 50,
      mapY: 50,
    });

    expect(() => buildTransitStopRow('Bad Stop', 'district_a', 'place_b1', districts, places)).toThrow(
      "Place 'place_b1' belongs to district 'district_b'",
    );
  });

  it('creates a canonical bus-line row with readable service defaults', () => {
    expect(buildBusLineRow('Crosstown', ['stop_a', 'stop_b'], ['stop_a', 'stop_b'])).toEqual({
      name: 'Crosstown',
      stopIds: '["stop_a","stop_b"]',
      serviceStartMinute: 360,
      serviceEndMinute: 1380,
      headwayMinutes: 20,
      segmentMinutes: '[10]',
      fare: 2,
    });
  });

  it('keeps one segment duration per adjacent stop pair when stops change', () => {
    expect(resizeSegmentMinutes([12], 3)).toEqual([12, 10]);
    expect(resizeSegmentMinutes([12, 8], 2)).toEqual([12]);
    expect(resizeSegmentMinutes([], 1)).toEqual([]);
  });
});
