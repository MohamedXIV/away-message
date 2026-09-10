import { describe, expect, it } from 'vitest';
import type { ContentTables } from '../../src/tools/content/codegen';
import { generateWorldRegistrySource } from '../../src/tools/content/worldCodegen';

function fixture(): ContentTables {
  return {
    districtDefinitions: {
      motel_strip: { displayName: 'Motel Strip', mapX: 20, mapY: 40 },
      downtown: { displayName: 'Downtown', mapX: 70, mapY: 35 },
    },
    placeDefinitions: {
      room_104: { displayName: 'Room 104', districtId: 'motel_strip', accessStops: '[{"stopId":"motel_stop","walkMinutes":3}]' },
      downtown_plaza: { displayName: 'Downtown Plaza', districtId: 'downtown', accessStops: '[{"stopId":"downtown_stop","walkMinutes":2}]' },
    },
    transitStopDefinitions: {
      motel_stop: { displayName: 'Motel Stop', districtId: 'motel_strip', placeId: 'room_104' },
      downtown_stop: { displayName: 'Downtown Stop', districtId: 'downtown', placeId: 'downtown_plaza' },
    },
    busLineDefinitions: {
      line_1: {
        displayName: 'Line 1', stopIds: '["motel_stop","downtown_stop"]', segmentMinutes: '[12]',
        serviceStartMinute: 360, serviceEndMinute: 1380, headwayMinutes: 20, fareCents: 125,
      },
    },
  };
}

describe('world content codegen', () => {
  it('generates deterministic typed registries from authored geography', () => {
    const first = generateWorldRegistrySource(fixture());
    const second = generateWorldRegistrySource(JSON.parse(JSON.stringify(fixture())) as ContentTables);

    expect(first).toBe(second);
    expect(first).toContain('GENERATED_DISTRICTS');
    expect(first).toContain('GENERATED_PLACES');
    expect(first).toContain('GENERATED_TRANSIT_STOPS');
    expect(first).toContain('GENERATED_BUS_LINES');
    expect(first).toContain('motel_strip');
    expect(first).toContain('segmentMinutes: [12]');
  });
});
