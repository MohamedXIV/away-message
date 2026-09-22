export interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}

export interface SpatialPoint2D {
  x: number;
  y: number;
}

export interface SpatialBounds {
  polygon: SpatialPoint2D[];
  minZ?: number;
  maxZ?: number;
}

export interface SpatialDistrictDefinition {
  districtId: string;
  bounds: SpatialBounds;
  priority?: number;
}

export interface SpatialPlaceDefinition {
  districtId: string;
  placeId: string;
  bounds: SpatialBounds;
  priority?: number;
}

export interface SpatialSpaceDefinition {
  districtId: string;
  placeId: string;
  spaceId: string;
  bounds: SpatialBounds;
  priority?: number;
}

export interface SpatialWorldDefinition {
  districts: SpatialDistrictDefinition[];
  places: SpatialPlaceDefinition[];
  spaces: SpatialSpaceDefinition[];
}

export interface SpatialMembership {
  districtId?: string;
  placeId?: string;
  spaceId?: string;
}

export type SpatialTransition =
  | {
      type: 'DistrictEntered' | 'DistrictExited';
      districtId: string;
    }
  | {
      type: 'PlaceEntered' | 'PlaceExited';
      districtId: string;
      placeId: string;
    }
  | {
      type: 'SpaceEntered' | 'SpaceExited';
      districtId: string;
      placeId: string;
      spaceId: string;
    };

function pointOnSegment(point: SpatialPoint2D, a: SpatialPoint2D, b: SpatialPoint2D): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > Number.EPSILON) return false;

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;

  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lengthSquared;
}

function pointInPolygon(point: SpatialPoint2D, polygon: SpatialPoint2D[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!;
    const b = polygon[i]!;

    if (pointOnSegment(point, a, b)) return true;

    const crosses =
      (b.y > point.y) !== (a.y > point.y) &&
      point.x < ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (crosses) inside = !inside;
  }

  return inside;
}

export function containsSpatialPosition(position: SpatialPosition, bounds: SpatialBounds): boolean {
  if (bounds.minZ !== undefined && position.z < bounds.minZ) return false;
  if (bounds.maxZ !== undefined && position.z > bounds.maxZ) return false;
  return pointInPolygon(position, bounds.polygon);
}

function selectUnambiguousMatch<T extends { priority?: number }>(
  matches: T[],
  level: string,
): T | undefined {
  if (matches.length === 0) return undefined;

  let highestPriority = Number.NEGATIVE_INFINITY;
  for (const match of matches) {
    highestPriority = Math.max(highestPriority, match.priority ?? 0);
  }

  const highestMatches = matches.filter((match) => (match.priority ?? 0) === highestPriority);
  if (highestMatches.length > 1) {
    throw new Error(`Ambiguous spatial containment at ${level}: ${highestMatches.length} matches.`);
  }

  return highestMatches[0];
}

export function resolveSpatialMembership(
  position: SpatialPosition,
  world: SpatialWorldDefinition,
): SpatialMembership {
  const district = selectUnambiguousMatch(
    world.districts.filter((candidate) => containsSpatialPosition(position, candidate.bounds)),
    'district',
  );
  if (!district) return {};

  const place = selectUnambiguousMatch(
    world.places.filter(
      (candidate) =>
        candidate.districtId === district.districtId && containsSpatialPosition(position, candidate.bounds),
    ),
    'place',
  );
  if (!place) return { districtId: district.districtId };

  const space = selectUnambiguousMatch(
    world.spaces.filter(
      (candidate) =>
        candidate.districtId === district.districtId &&
        candidate.placeId === place.placeId &&
        containsSpatialPosition(position, candidate.bounds),
    ),
    'space',
  );

  return {
    districtId: district.districtId,
    placeId: place.placeId,
    ...(space ? { spaceId: space.spaceId } : {}),
  };
}

export function deriveSpatialTransitions(
  previous: SpatialMembership,
  next: SpatialMembership,
): SpatialTransition[] {
  const districtChanged = previous.districtId !== next.districtId;
  const placeChanged = districtChanged || previous.placeId !== next.placeId;
  const spaceChanged = placeChanged || previous.spaceId !== next.spaceId;
  const transitions: SpatialTransition[] = [];

  if (spaceChanged && previous.districtId && previous.placeId && previous.spaceId) {
    transitions.push({
      type: 'SpaceExited',
      districtId: previous.districtId,
      placeId: previous.placeId,
      spaceId: previous.spaceId,
    });
  }

  if (placeChanged && previous.districtId && previous.placeId) {
    transitions.push({
      type: 'PlaceExited',
      districtId: previous.districtId,
      placeId: previous.placeId,
    });
  }

  if (districtChanged && previous.districtId) {
    transitions.push({
      type: 'DistrictExited',
      districtId: previous.districtId,
    });
  }

  if (districtChanged && next.districtId) {
    transitions.push({
      type: 'DistrictEntered',
      districtId: next.districtId,
    });
  }

  if (placeChanged && next.districtId && next.placeId) {
    transitions.push({
      type: 'PlaceEntered',
      districtId: next.districtId,
      placeId: next.placeId,
    });
  }

  if (spaceChanged && next.districtId && next.placeId && next.spaceId) {
    transitions.push({
      type: 'SpaceEntered',
      districtId: next.districtId,
      placeId: next.placeId,
      spaceId: next.spaceId,
    });
  }

  return transitions;
}
