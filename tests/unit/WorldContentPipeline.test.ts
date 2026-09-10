import { describe, expect, it } from 'vitest';
import type { ContentTables } from '../../src/tools/content/codegen';
import { buildContentArtifacts } from '../../src/tools/content/pipeline';

function tables(): ContentTables {
  return {
    archetypes: {
      regular: { label: 'Regular', typingSpeedWpm: 70, vocabulary: '[]', defaultInterests: '[]' },
    },
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

describe('content build pipeline', () => {
  it('builds character and world artifacts from one validated source', () => {
    const result = buildContentArtifacts(tables());
    expect(result.errors).toEqual([]);
    expect(result.coreSource).toContain('GENERATED_ARCHETYPES');
    expect(result.worldSource).toContain('GENERATED_BUS_LINES');
  });

  it('fails the shared pipeline when authored world references are invalid', () => {
    const broken = tables();
    broken['transitStopDefinitions']!['motel_stop']!['districtId'] = 'ghost_district';
    const result = buildContentArtifacts(broken);
    expect(result.errors.some((error) => error.includes('ghost_district'))).toBe(true);
  });
});
