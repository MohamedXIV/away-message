import { describe, expect, it } from 'vitest';
import {
  generateWorldRegistrySource,
  validateWorldSpatialContent,
  type ContentTables,
} from '../../src/tools/content/codegen';
import {
  spatialWorldFromGenerated,
  type GeneratedSpatialContentSource,
} from '../../src/engine/spatial/GeneratedSpatialWorld';
import { resolveSpatialMembership } from '../../src/engine/spatial/SpatialPresence';

function spatialTables(): ContentTables {
  return {
    districts: {
      district_test: {
        name: 'Test District',
        mapX: 50,
        mapY: 50,
        tags: [],
        spatialBounds: {
          polygon: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          minZ: 0,
          maxZ: 0,
          priority: 0,
        },
      },
    },
    places: {
      place_test: {
        districtId: 'district_test',
        name: 'Test Place',
        transitAccess: [],
        legacyIds: [],
        spatialBounds: {
          polygon: [
            { x: 20, y: 20 },
            { x: 40, y: 20 },
            { x: 40, y: 40 },
            { x: 20, y: 40 },
          ],
          minZ: 0,
          maxZ: 0,
          priority: 0,
        },
        entryPosition: { x: 30, y: 22, z: 0 },
      },
    },
    spaces: {
      space_test: {
        placeId: 'place_test',
        name: 'Test Space',
        tags: [],
        spatialBounds: {
          polygon: [
            { x: 22, y: 22 },
            { x: 38, y: 22 },
            { x: 38, y: 38 },
            { x: 22, y: 38 },
          ],
          minZ: 0,
          maxZ: 0,
          priority: 0,
        },
        entryPosition: { x: 30, y: 24, z: 0 },
      },
    },
  };
}

describe('generated spatial content integration (#93)', () => {
  it('accepts optional canonical spatial geometry on district/place/space rows', () => {
    expect(validateWorldSpatialContent(spatialTables())).toEqual([]);
  });

  it('rejects incomplete polygons and inverted z ranges', () => {
    const tables = spatialTables();
    (tables['places']!['place_test']! as Record<string, unknown>)['spatialBounds'] = {
      polygon: [
        { x: 20, y: 20 },
        { x: 40, y: 20 },
      ],
      minZ: 1,
      maxZ: 0,
    };

    const errors = validateWorldSpatialContent(tables);
    expect(errors.some((error) => error.includes('places/place_test.spatialBounds.polygon'))).toBe(true);
    expect(errors.some((error) => error.includes('places/place_test.spatialBounds') && error.includes('minZ'))).toBe(true);
  });

  it('requires parent geometry instead of creating a second containment authority', () => {
    const tables = spatialTables();
    delete (tables['districts']!['district_test']! as Record<string, unknown>)['spatialBounds'];

    const errors = validateWorldSpatialContent(tables);
    expect(errors.some((error) => error.includes('places/place_test.spatialBounds') && error.includes('district_test'))).toBe(true);
  });

  it('rejects child geometry that escapes its canonical parent bounds', () => {
    const tables = spatialTables();
    (tables['places']!['place_test']! as Record<string, unknown>)['spatialBounds'] = {
      polygon: [
        { x: 90, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 40 },
        { x: 90, y: 40 },
      ],
      minZ: 0,
      maxZ: 0,
      priority: 0,
    };
    (tables['places']!['place_test']! as Record<string, unknown>)['entryPosition'] = {
      x: 95,
      y: 22,
      z: 0,
    };

    const errors = validateWorldSpatialContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('places/place_test.spatialBounds') &&
          error.includes("parent district 'district_test'"),
      ),
    ).toBe(true);
  });

  it('requires an authored entry position to resolve inside its own place/space bounds', () => {
    const tables = spatialTables();
    (tables['places']!['place_test']! as Record<string, unknown>)['entryPosition'] = {
      x: 90,
      y: 90,
      z: 0,
    };

    const errors = validateWorldSpatialContent(tables);
    expect(errors.some((error) => error.includes('places/place_test.entryPosition') && error.includes('inside'))).toBe(true);
  });

  it('emits optional spatial geometry without inventing it for un-authored rows', () => {
    const tables = spatialTables();
    tables['places']!['place_without_geometry'] = {
      districtId: 'district_test',
      name: 'No Geometry',
      transitAccess: [],
      legacyIds: [],
    };

    const source = generateWorldRegistrySource(tables);
    expect(source).toContain('spatialBounds?: GeneratedSpatialBounds;');
    expect(source).toContain('entryPosition?: GeneratedSpatialPosition;');
    expect(source).toContain('id: "place_test"');
    expect(source).toContain('entryPosition: { x: 30, y: 22, z: 0 }');
    expect(source).toContain('id: "place_without_geometry"');
  });

  it('builds the pure SpatialWorldDefinition from generated canonical rows only', () => {
    const source: GeneratedSpatialContentSource = {
      districts: [
        {
          id: 'district_test',
          spatialBounds: spatialTables()['districts']!['district_test']!['spatialBounds'] as never,
        },
      ],
      places: [
        {
          id: 'place_test',
          districtId: 'district_test',
          spatialBounds: spatialTables()['places']!['place_test']!['spatialBounds'] as never,
          entryPosition: { x: 30, y: 22, z: 0 },
        },
        {
          id: 'place_without_geometry',
          districtId: 'district_test',
        },
      ],
      spaces: [
        {
          id: 'space_test',
          placeId: 'place_test',
          spatialBounds: spatialTables()['spaces']!['space_test']!['spatialBounds'] as never,
          entryPosition: { x: 30, y: 24, z: 0 },
        },
      ],
    };

    const world = spatialWorldFromGenerated(source);
    expect(world.places.map((place) => place.placeId)).toEqual(['place_test']);
    expect(resolveSpatialMembership({ x: 30, y: 30, z: 0 }, world)).toEqual({
      districtId: 'district_test',
      placeId: 'place_test',
      spaceId: 'space_test',
    });
  });
});
