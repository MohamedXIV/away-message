import { buildCharacter, type BuildCharacterOptions } from '../CharacterEngine';
import {
  resolveCharacterPresenceFromSimulation,
  type CharacterPresenceProjection,
} from '../life/Presence';
import { getGeneratedPlaceEntryPosition } from '../spatial/GeneratedSpatialWorld';
import type { SpatialPosition } from '../spatial/SpatialPresence';
import type { BuddyCharacter, BuddyPresence } from '../types';
import type { NpcPlaceQuery } from '../transit/NpcTrips';
import type { VenueRoleAssignment, VenueRuntimeState } from './VenueOperations';

export interface VenueCharacterSimulationSource {
  social: {
    getBuddy(actorId: string): BuddyCharacter | undefined;
    registerBuddy(definition: BuddyCharacter): BuddyCharacter;
    getPresence(actorId: string): BuddyPresence | undefined;
  };
  getNpcPlaceState(actorId: string, atMinute?: number): NpcPlaceQuery;
  relocateActorSpatially(actorId: string, position: SpatialPosition): unknown;
  setVenueRoleAssignment(assignment: VenueRoleAssignment): void;
  getVenueRuntimeState(): VenueRuntimeState;
}

export interface EnsureVenueRoleCharacterOptions {
  character: BuildCharacterOptions;
  placeId: string;
  assignment: Omit<VenueRoleAssignment, 'actorId'>;
}

export interface InPersonVenueCharacterContext {
  actorId: string;
  displayName: string;
  handle: string;
  presence: CharacterPresenceProjection;
  sceneContext: string;
  personaSuffix: string;
}

/**
 * Ensures an ordinary SocialEngine character owns an authored venue role.
 * Character identity remains in SocialEngine, physical place truth remains in
 * the spatial system, and the venue runtime owns only the role/station link.
 */
export function ensureVenueRoleCharacter(
  source: VenueCharacterSimulationSource,
  options: EnsureVenueRoleCharacterOptions,
): BuddyCharacter {
  if (options.character.reach === 'remote') {
    throw new Error('Remote actors cannot hold a local venue role.');
  }
  const actorId = options.character.id;
  let buddy = source.social.getBuddy(actorId);
  if (!buddy) {
    buddy = source.social.registerBuddy(buildCharacter(options.character).definition);
  }
  if (buddy.reach === 'remote') {
    throw new Error('Remote actors cannot hold a local venue role.');
  }

  const place = source.getNpcPlaceState(actorId);
  if (place.status !== 'at_place' || place.placeId !== options.placeId) {
    const entry = getGeneratedPlaceEntryPosition(options.placeId);
    if (!entry) {
      throw new Error(`Venue character place '${options.placeId}' has no authored entry position.`);
    }
    source.relocateActorSpatially(actorId, entry);
  }

  source.setVenueRoleAssignment({
    ...options.assignment,
    actorId,
  });

  return buddy;
}

/**
 * Read-only handoff for physically present social interactions.
 * The context deliberately contains only actor identity, coherent presence,
 * and caller-supplied visible scene facts. It never exposes venue/shop state.
 */
export function resolveInPersonVenueCharacterContext(
  source: VenueCharacterSimulationSource,
  actorId: string,
  options: {
    playerPlaceId: string;
    placeName: string;
    viewName: string;
    visibleContext?: readonly string[];
    atMinute?: number;
  },
): InPersonVenueCharacterContext | null {
  const buddy = source.social.getBuddy(actorId);
  if (!buddy) return null;

  const presence = resolveCharacterPresenceFromSimulation(source, actorId, {
    playerPlaceId: options.playerPlaceId,
    ...(options.atMinute !== undefined ? { atMinute: options.atMinute } : {}),
    messagingDeviceContext: 'none',
  });
  if (!presence || !presence.availability.canInteractInPerson) return null;

  const visible = (options.visibleContext ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
  const visibleSuffix = visible.length > 0
    ? ` Visible here: ${visible.join(', ')}.`
    : '';

  return {
    actorId,
    displayName: buddy.displayName,
    handle: buddy.handle,
    presence,
    sceneContext:
      `In-person meeting at ${options.placeName}, ${options.viewName}.${visibleSuffix}`,
    personaSuffix:
      `You are physically present with the player at ${options.placeName}, speaking face to face rather than through Pulse. Refer only to what is visible or already known.`,
  };
}
