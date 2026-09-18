import {
  deriveSpatialTransitions,
  resolveSpatialMembership,
  type SpatialMembership,
  type SpatialPosition,
  type SpatialTransition,
  type SpatialWorldDefinition,
} from './SpatialPresence';

export type ActorSpatialPositions = Record<string, SpatialPosition>;

export interface ActorSpatialProjection {
  position: SpatialPosition;
  membership: SpatialMembership;
}

export interface ActorSpatialRelocation {
  positions: ActorSpatialPositions;
  previousMembership: SpatialMembership;
  membership: SpatialMembership;
  transitions: SpatialTransition[];
}

function isFinitePosition(value: unknown): value is SpatialPosition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['x'] === 'number' &&
    Number.isFinite(record['x']) &&
    typeof record['y'] === 'number' &&
    Number.isFinite(record['y']) &&
    typeof record['z'] === 'number' &&
    Number.isFinite(record['z'])
  );
}

function clonePosition(position: SpatialPosition): SpatialPosition {
  return { x: position.x, y: position.y, z: position.z };
}

export function emptyActorSpatialPositions(): ActorSpatialPositions {
  return {};
}

/**
 * Current-format hydration keeps only irreducible XYZ truth.
 * Any cached/legacy membership properties on decoded rows are ignored.
 */
export function hydrateActorSpatialPositions(data: unknown): ActorSpatialPositions {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const result: ActorSpatialPositions = {};
  for (const [actorId, value] of Object.entries(data as Record<string, unknown>)) {
    if (!actorId || !isFinitePosition(value)) continue;
    result[actorId] = clonePosition(value);
  }
  return result;
}

export function cloneActorSpatialPositions(
  positions: ActorSpatialPositions,
): ActorSpatialPositions {
  return Object.fromEntries(
    Object.entries(positions).map(([actorId, position]) => [
      actorId,
      clonePosition(position),
    ]),
  );
}

export function getActorSpatialProjection(
  positions: ActorSpatialPositions,
  actorId: string,
  world: SpatialWorldDefinition,
): ActorSpatialProjection | null {
  const position = positions[actorId];
  if (!position) return null;

  return {
    position: clonePosition(position),
    membership: resolveSpatialMembership(position, world),
  };
}

export function relocateActorSpatialPosition(
  positions: ActorSpatialPositions,
  actorId: string,
  position: SpatialPosition,
  world: SpatialWorldDefinition,
): ActorSpatialRelocation {
  if (!actorId) throw new Error('Actor spatial relocation requires a non-empty actor id.');
  if (!isFinitePosition(position)) {
    throw new Error('Actor spatial relocation requires finite x/y/z coordinates.');
  }

  const previousPosition = positions[actorId];
  const previousMembership = previousPosition
    ? resolveSpatialMembership(previousPosition, world)
    : {};
  const membership = resolveSpatialMembership(position, world);

  return {
    positions: {
      ...cloneActorSpatialPositions(positions),
      [actorId]: clonePosition(position),
    },
    previousMembership,
    membership,
    transitions: deriveSpatialTransitions(previousMembership, membership),
  };
}
