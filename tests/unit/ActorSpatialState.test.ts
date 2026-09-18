import { describe, expect, it } from 'vitest';
import {
  clearActorSpatialPosition,
  emptyActorSpatialPositions,
  getActorSpatialProjection,
  hydrateActorSpatialPositions,
  relocateActorSpatialPosition,
} from '../../src/engine/spatial/ActorSpatialState';
import type { SpatialWorldDefinition } from '../../src/engine/spatial/SpatialPresence';

const world: SpatialWorldDefinition = {
  districts: [
    {
      districtId: 'district_test',
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
      districtId: 'district_test',
      placeId: 'place_a',
      bounds: {
        polygon: [
          { x: 10, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 40 },
          { x: 10, y: 40 },
        ],
      },
    },
    {
      districtId: 'district_test',
      placeId: 'place_b',
      bounds: {
        polygon: [
          { x: 60, y: 10 },
          { x: 90, y: 10 },
          { x: 90, y: 40 },
          { x: 60, y: 40 },
        ],
      },
    },
  ],
  spaces: [],
};

describe('actor spatial state (#93)', () => {
  it('uses one XYZ contract for player and NPC actors', () => {
    let positions = emptyActorSpatialPositions();
    positions = relocateActorSpatialPosition(
      positions,
      'player',
      { x: 20, y: 20, z: 0 },
      world,
    ).positions;
    positions = relocateActorSpatialPosition(
      positions,
      'npc_a',
      { x: 20, y: 20, z: 0 },
      world,
    ).positions;

    expect(getActorSpatialProjection(positions, 'player', world)).toEqual(
      getActorSpatialProjection(positions, 'npc_a', world),
    );
  });

  it('stores only irreducible XYZ and derives membership on read', () => {
    const result = relocateActorSpatialPosition(
      emptyActorSpatialPositions(),
      'actor_a',
      { x: 20, y: 20, z: 0 },
      world,
    );

    expect(result.positions).toEqual({
      actor_a: { x: 20, y: 20, z: 0 },
    });
    expect(result).not.toHaveProperty('placeId');
    expect(getActorSpatialProjection(result.positions, 'actor_a', world)).toEqual({
      position: { x: 20, y: 20, z: 0 },
      membership: { districtId: 'district_test', placeId: 'place_a' },
    });
  });

  it('derives exit/enter transitions from relocation instead of storing membership', () => {
    const first = relocateActorSpatialPosition(
      emptyActorSpatialPositions(),
      'actor_a',
      { x: 20, y: 20, z: 0 },
      world,
    );
    const second = relocateActorSpatialPosition(
      first.positions,
      'actor_a',
      { x: 70, y: 20, z: 0 },
      world,
    );

    expect(second.transitions).toEqual([
      { type: 'PlaceExited', districtId: 'district_test', placeId: 'place_a' },
      { type: 'PlaceEntered', districtId: 'district_test', placeId: 'place_b' },
    ]);
  });

  it('hydrates only finite XYZ rows and does not persist derived membership', () => {
    expect(
      hydrateActorSpatialPositions({
        player: { x: 1, y: 2, z: 0, placeId: 'stale_place' },
        npc_ok: { x: 3, y: 4, z: 0 },
        npc_bad: { x: Number.NaN, y: 4, z: 0 },
        malformed: { x: 1, y: 2 },
      }),
    ).toEqual({
      player: { x: 1, y: 2, z: 0 },
      npc_ok: { x: 3, y: 4, z: 0 },
    });
  });

  it('clears local XYZ during transit and derives exit transitions once', () => {
    const settled = relocateActorSpatialPosition(
      emptyActorSpatialPositions(),
      'actor_a',
      { x: 20, y: 20, z: 0 },
      world,
    );
    const departed = clearActorSpatialPosition(settled.positions, 'actor_a', world);

    expect(departed.positions).toEqual({});
    expect(departed.membership).toEqual({});
    expect(departed.transitions).toEqual([
      { type: 'PlaceExited', districtId: 'district_test', placeId: 'place_a' },
      { type: 'DistrictExited', districtId: 'district_test' },
    ]);
    expect(clearActorSpatialPosition(departed.positions, 'actor_a', world).transitions).toEqual([]);
  });

  it('returns unknown projection when no canonical position exists', () => {
    expect(getActorSpatialProjection({}, 'missing', world)).toBeNull();
  });
});
