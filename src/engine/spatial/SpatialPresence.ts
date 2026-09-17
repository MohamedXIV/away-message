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
    const a = polygon[j];
    const b = polygon[i];

    if (pointOnSegment(point, a, b)) return true;

    const crosses =
      (b.y > point.y) !== (a.y > point.y) &&
      point.x < ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y) + b.x;
    if (crosses) inside = !inside;
  }

  return inside;
}

function containsPosition(position: SpatialPosition, bounds: SpatialBounds): boolean {
  if (bounds.minZ !== undefined && position.z < bounds.minZ) return false;
  if (bounds.maxZ !== undefined && position.z > bounds.maxZ) return false;
  return pointInPolygon(position, bounds.polygon);
}

export function resolveSpatialMembership(
  position: SpatialPosition,
  world: SpatialWorldDefinition,
): SpatialMembership {
  const district = world.districts.find((candidate) => containsPosition(position, candidate.bounds));
  if (!district) return {};

  const place = world.places.find(
    (candidate) =>
      candidate.districtId === district.districtId && containsPosition(position, candidate.bounds),
  );
  if (!place) return { districtId: district.districtId };

  const space = world.spaces.find(
    (candidate) =>
      candidate.districtId === district.districtId &&
      candidate.placeId === place.placeId &&
      containsPosition(position, candidate.bounds),
  );

  return {
    districtId: district.districtId,
    placeId: place.placeId,
    ...(space ? { spaceId: space.spaceId } : {}),
  };
}
