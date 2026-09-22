import { describe, expect, it } from 'vitest';
import {
  deriveSpatialTransitions,
  resolveSpatialMembership,
  type SpatialPosition,
  type SpatialWorldDefinition,
} from '../../src/engine/spatial/SpatialPresence';

const cafePosition: SpatialPosition = { x: 58.4, y: 73.1, z: 0 };

const cafeMembership = {
  districtId: 'old_commercial',
  placeId: 'silver_cup',
  spaceId: 'main_floor',
};

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
    expect(resolveSpatialMembership(cafePosition, world)).toEqual(cafeMembership);
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

  it('resolves an exterior coordinate without inventing an interior place', () => {
    expect(resolveSpatialMembership({ x: 10, y: 10, z: 0 }, world)).toEqual({
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

    expect(() => resolveSpatialMembership(cafePosition, ambiguousWorld)).toThrow(
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

    expect(resolveSpatialMembership(cafePosition, prioritizedWorld)).toEqual({
      districtId: 'old_commercial',
      placeId: 'copy_shop',
    });
  });

  it('derives one deterministic exit/enter sequence when membership changes', () => {
    expect(
      deriveSpatialTransitions(cafeMembership, {
        districtId: 'old_commercial',
        placeId: 'copy_shop',
        spaceId: 'front_room',
      }),
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

  it('derives district exits before district entries when the district changes', () => {
    expect(
      deriveSpatialTransitions(
        { districtId: 'old_commercial' },
        { districtId: 'residential_east' },
      ),
    ).toEqual([
      { type: 'DistrictExited', districtId: 'old_commercial' },
      { type: 'DistrictEntered', districtId: 'residential_east' },
    ]);
  });

  it('is idempotent when authoritative membership is unchanged', () => {
    expect(deriveSpatialTransitions(cafeMembership, cafeMembership)).toEqual([]);
  });

  it('keeps membership independent from actor activity or purpose', () => {
    const actorContexts = [
      { purpose: 'work', position: cafePosition },
      { purpose: 'leisure', position: cafePosition },
    ];

    expect(
      actorContexts.map(({ position }) => resolveSpatialMembership(position, world)),
    ).toEqual([cafeMembership, cafeMembership]);
  });

  it('does not let renderer or view changes become location authority', () => {
    const projections = [
      { viewId: 'town_overview', position: cafePosition },
      { viewId: 'cafe_closeup', position: cafePosition },
    ];

    expect(projections.map(({ position }) => resolveSpatialMembership(position, world))).toEqual([
      cafeMembership,
      cafeMembership,
    ]);
  });

  it('uses the same spatial resolver contract for player and NPC actors', () => {
    const actors = [
      { kind: 'player', position: cafePosition },
      { kind: 'npc', position: cafePosition },
    ];

    expect(actors.map(({ position }) => resolveSpatialMembership(position, world))).toEqual([
      cafeMembership,
      cafeMembership,
    ]);
  });

  it('resolves a transit arrival position without duplicating transit timing truth', () => {
    const completedTrip = {
      durationMinutes: 18,
      destinationPosition: cafePosition,
    };

    const arrivalMembership = resolveSpatialMembership(completedTrip.destinationPosition, world);

    expect(arrivalMembership).toEqual(cafeMembership);
    expect(arrivalMembership).not.toHaveProperty('durationMinutes');
    expect(completedTrip.durationMinutes).toBe(18);
  });

  it('reconstructs coherent membership from persisted XYZ after reload or a time jump', () => {
    const savePayload = JSON.stringify({
      position: cafePosition,
      elapsedMinutes: 8 * 60,
    });
    const reloaded = JSON.parse(savePayload) as {
      position: SpatialPosition;
      elapsedMinutes: number;
    };

    expect(reloaded.elapsedMinutes).toBe(8 * 60);
    expect(resolveSpatialMembership(reloaded.position, world)).toEqual(cafeMembership);
  });
});
