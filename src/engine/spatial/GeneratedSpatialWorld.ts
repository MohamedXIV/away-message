import {
  GENERATED_DISTRICTS,
  GENERATED_PLACES,
  GENERATED_SPACES,
  type GeneratedDistrictDef,
  type GeneratedPlaceDef,
  type GeneratedSpaceDef,
  type GeneratedSpatialBounds,
  type GeneratedSpatialPosition,
} from '../worldContent.generated';
import type {
  SpatialBounds,
  SpatialWorldDefinition,
} from './SpatialPresence';

export interface GeneratedSpatialDistrictSource {
  id: string;
  spatialBounds?: GeneratedSpatialBounds;
}

export interface GeneratedSpatialPlaceSource {
  id: string;
  districtId: string;
  spatialBounds?: GeneratedSpatialBounds;
  entryPosition?: GeneratedSpatialPosition;
}

export interface GeneratedSpatialSpaceSource {
  id: string;
  placeId: string;
  spatialBounds?: GeneratedSpatialBounds;
  entryPosition?: GeneratedSpatialPosition;
}

export interface GeneratedSpatialContentSource {
  districts: readonly GeneratedSpatialDistrictSource[];
  places: readonly GeneratedSpatialPlaceSource[];
  spaces: readonly GeneratedSpatialSpaceSource[];
}

function toBounds(bounds: GeneratedSpatialBounds): SpatialBounds {
  return {
    polygon: bounds.polygon.map((point) => ({ x: point.x, y: point.y })),
    ...(bounds.minZ === undefined ? {} : { minZ: bounds.minZ }),
    ...(bounds.maxZ === undefined ? {} : { maxZ: bounds.maxZ }),
  };
}

/**
 * Project canonical generated content into the pure spatial resolver contract.
 * Rows without authored geometry are intentionally omitted: absence never
 * invents a fallback position or membership.
 */
export function spatialWorldFromGenerated(
  source: GeneratedSpatialContentSource,
): SpatialWorldDefinition {
  const placeById = new Map(source.places.map((place) => [place.id, place] as const));

  return {
    districts: source.districts
      .filter(
        (district): district is GeneratedSpatialDistrictSource & { spatialBounds: GeneratedSpatialBounds } =>
          district.spatialBounds !== undefined,
      )
      .map((district) => ({
        districtId: district.id,
        bounds: toBounds(district.spatialBounds),
        ...(district.spatialBounds.priority === undefined
          ? {}
          : { priority: district.spatialBounds.priority }),
      })),
    places: source.places
      .filter(
        (place): place is GeneratedSpatialPlaceSource & { spatialBounds: GeneratedSpatialBounds } =>
          place.spatialBounds !== undefined,
      )
      .map((place) => ({
        districtId: place.districtId,
        placeId: place.id,
        bounds: toBounds(place.spatialBounds),
        ...(place.spatialBounds.priority === undefined
          ? {}
          : { priority: place.spatialBounds.priority }),
      })),
    spaces: source.spaces
      .filter(
        (space): space is GeneratedSpatialSpaceSource & { spatialBounds: GeneratedSpatialBounds } =>
          space.spatialBounds !== undefined,
      )
      .flatMap((space) => {
        const place = placeById.get(space.placeId);
        if (!place) return [];
        return [{
          districtId: place.districtId,
          placeId: space.placeId,
          spaceId: space.id,
          bounds: toBounds(space.spatialBounds),
          ...(space.spatialBounds.priority === undefined
            ? {}
            : { priority: space.spatialBounds.priority }),
        }];
      }),
  };
}

export const GENERATED_SPATIAL_WORLD = spatialWorldFromGenerated({
  districts: GENERATED_DISTRICTS,
  places: GENERATED_PLACES,
  spaces: GENERATED_SPACES,
});

export function getGeneratedPlaceEntryPosition(placeId: string): GeneratedSpatialPosition | undefined {
  const place = (GENERATED_PLACES as readonly GeneratedPlaceDef[]).find((candidate) => candidate.id === placeId);
  return place?.entryPosition;
}

export function getGeneratedSpaceEntryPosition(spaceId: string): GeneratedSpatialPosition | undefined {
  const space = (GENERATED_SPACES as readonly GeneratedSpaceDef[]).find((candidate) => candidate.id === spaceId);
  return space?.entryPosition;
}

// Compile-time guards: generated arrays satisfy the structural source contract.
const _districtSource: readonly GeneratedSpatialDistrictSource[] = GENERATED_DISTRICTS as readonly GeneratedDistrictDef[];
void _districtSource;
