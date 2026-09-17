import { describe, expect, it } from 'vitest';
import {
  deriveSpatialTransitions,
  resolveSpatialMembership,
  type SpatialWorldDefinition,
} from '../../src/engine/spatial/SpatialPresence';

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

  it('uses authored z ranges without requiring floors in current content', () => {
    const elevatedWorld: SpatialWorldDefinition = {
      ...world,
      places: world.places.map((place) => ({
        ...place,
        bounds: { ...place.bounds, minZ: -1, maxZ: 1 },
      })),
      spaces: world.spaces.map((space) => ({
        ...space,
        bounds: { ...space.bounds, minZ: -1, maxZ: 1 },
      })),
    };

    expect(resolveSpatialMembership({ x: 58.4, y: 73.1, z: 2 }, elevatedWorld)).toEqual({
      districtId: 'old_commercial',
    });
  });

  it('rejects equal-priority overlapping places instead of using array order as truth', () => {
    const ambiguousWorld: SpatialWorldDefinition = {
      ...world,
      places: [
        world.places[0]!,
        {
          ...world.places[0]!,
          placeId: 'copy_shop',
        },
      ],
    };

    expect(() => resolveSpatialMembership({ x: 58.4, y: 73.1, z: 0 }, ambiguousWorld)).toThrow(
      /Ambiguous spatial containment/,
    );
  });

  it('uses explicit authored priority to resolve intentional overlaps', () => {
    const prioritizedWorld: SpatialWorldDefinition = {
      ...world,
      places: [
        { ...world.places[0]!, priority: 1 },
        {
          ...world.places[0]!,
          placeId: 'copy_shop',
          priority: 2,
        },
      ],
      spaces: [],
    };

    expect(resolveSpatialMembership({ x: 58.4, y: 73.1, z: 0 }, prioritizedWorld)).toEqual({
      districtId: 'old_commercial',
      placeId: 'copy_shop',
    });
  });

  it('derives one deterministic exit/enter sequence when membership changes', () => {
    expect(
      deriveSpatialTransitions(
        {
          districtId: 'old_commercial',
          placeId: 'silver_cup',
          spaceId: 'main_floor',
        },
        {
          districtId: 'old_commercial',
          placeId: 'copy_shop',
          spaceId: 'front_room',
        },
      ),
    ).toEqual([
      {
        type: 'SpaceExited',
        districtId: 'old_commercial',
        placeId: 'silver_cup',
        spaceId: 'main_floor',
      },
      {
        type: 'PlaceExited',
        districtId: 'old_commercial',
        placeId: 'silver_cup',
      },
      {
        type: 'PlaceEntered',
        districtId: 'old_commercial',
        placeId: 'copy_shop',
      },
      {
        type: 'SpaceEntered',
        districtId: 'old_commercial',
        placeId: 'copy_shop',
        spaceId: 'front_room',
      },
    ]);
  });
});
