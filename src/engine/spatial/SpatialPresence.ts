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

export function resolveSpatialMembership(
  _position: SpatialPosition,
  _world: SpatialWorldDefinition,
): SpatialMembership {
  throw new Error('Spatial containment is not implemented yet.');
}
