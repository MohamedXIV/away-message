import { describe, expect, it } from 'vitest';
import { resolveSpatialMembership, type SpatialWorldDefinition } from '../../src/engine/spatial/SpatialPresence';

const world: SpatialWorldDefinition = {
  districts: [
    {
      districtId: 'old_commercial',
      bounds: {
        polygon: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
      },
    },
  ],
  places: [
    {
      districtId: 'old_commercial',
      placeId: 'silver_cup',
      bounds: {
        polygon: [
          { x: 50, y: 65 },
          { x: 70, y: 65 },
          { x: 70, y: 85 },
          { x: 50, y: 85 },
        ],
      },
    },
  ],
  spaces: [
    {
      districtId: 'old_commercial',
      placeId: 'silver_cup',
      spaceId: 'main_floor',
      bounds: {
        polygon: [
          { x: 50, y: 65 },
          { x: 70, y: 65 },
          { x: 70, y: 85 },
          { x: 50, y: 85 },
        ],
      },
    },
  ],
};

describe('SpatialPresence (#93)', () => {
  it('resolves district, place, and space from one canonical XYZ position', () => {
    expect(resolveSpatialMembership({ x: 58.4, y: 73.1, z: 0 }, world)).toEqual({
      districtId: 'old_commercial',
      placeId: 'silver_cup',
      spaceId: 'main_floor',
    });
  });
});
