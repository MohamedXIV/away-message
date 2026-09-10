import { describe, expect, it } from 'vitest';
import { CONTENT_SCHEMA } from '../../src/tools/content/schema';
import { validateContent, type ContentTables } from '../../src/tools/content/codegen';

function worldFixture(): ContentTables {
  return {
    archetypes: {
      regular: {
        label: 'Regular',
        typingSpeedWpm: 70,
        vocabulary: '[]',
        defaultInterests: '[]',
      },
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
        displayName: 'Line 1',
        stopIds: '["motel_stop","downtown_stop"]',
        segmentMinutes: '[12]',
        serviceStartMinute: 360,
        serviceEndMinute: 1380,
        headwayMinutes: 20,
        fareCents: 125,
      },
    },
  };
}

describe('world content geography contract', () => {
  it('declares TinyBase tables for districts, places, stops, and bus lines', () => {
    const schema = CONTENT_SCHEMA as Record<string, unknown>;
    expect(schema['districtDefinitions']).toBeDefined();
    expect(schema['placeDefinitions']).toBeDefined();
    expect(schema['transitStopDefinitions']).toBeDefined();
    expect(schema['busLineDefinitions']).toBeDefined();
  });

  it('accepts a valid two-district route fixture', () => {
    expect(validateContent(worldFixture())).toEqual([]);
  });

  it('rejects broken geography references and invalid transit timing', () => {
    const tables = worldFixture();
    tables['placeDefinitions']!['room_104']!['districtId'] = 'missing_district';
    tables['transitStopDefinitions']!['motel_stop']!['placeId'] = 'missing_place';
    tables['busLineDefinitions']!['line_1']!['stopIds'] = '["motel_stop","missing_stop"]';
    tables['busLineDefinitions']!['line_1']!['segmentMinutes'] = '[0, 4]';
    tables['busLineDefinitions']!['line_1']!['headwayMinutes'] = 0;

    const errors = validateContent(tables);
    expect(errors.some((error) => error.includes('room_104') && error.includes('missing_district'))).toBe(true);
    expect(errors.some((error) => error.includes('motel_stop') && error.includes('missing_place'))).toBe(true);
    expect(errors.some((error) => error.includes('line_1') && error.includes('missing_stop'))).toBe(true);
    expect(errors.some((error) => error.includes('segmentMinutes'))).toBe(true);
    expect(errors.some((error) => error.includes('headwayMinutes'))).toBe(true);
  });
});
