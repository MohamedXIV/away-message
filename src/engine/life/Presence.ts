import type {
  BuddyLifecycleStatus,
  BuddyPresence,
  BuddyPresenceStatus,
} from '../types';
import type { NpcPlaceQuery } from '../transit/NpcTrips';
import type { TravelLeg } from '../transit/types';

export type CharacterCommunicationStatus =
  | 'online_active'
  | 'online_idle'
  | 'away'
  | 'busy'
  | 'offline';

export type CharacterPhysicalPresence =
  | { kind: 'at_place'; placeId: string }
  | {
      kind: 'in_transit';
      originPlaceId: string;
      destinationPlaceId: string;
      legIndex: number;
      legKind: TravelLeg['kind'];
    }
  | { kind: 'remote' }
  | { kind: 'unknown'; failureReason?: string };

export interface CharacterPresenceProjection {
  actorId: string;
  physical: CharacterPhysicalPresence;
  communication: {
    status: CharacterCommunicationStatus;
    legacyStatus: BuddyPresenceStatus;
    awayMessage: string;
    customAwayMessage?: string;
  };
  availability: {
    canMessage: boolean;
    canCall: boolean;
    canInteractInPerson: boolean;
  };
  reasonCodes: string[];
}

export interface CharacterPresenceInput {
  actorId: string;
  place: NpcPlaceQuery;
  legacyPresence: BuddyPresence;
  reach: 'local' | 'remote';
  lifecycleStatus?: BuddyLifecycleStatus;
  playerPlaceId?: string;
  hasPortableMessagingDevice?: boolean;
}

export interface CharacterPresenceResolveOptions {
  atMinute?: number;
  playerPlaceId?: string;
  hasPortableMessagingDevice?: boolean;
}

export interface CharacterPresenceSimulationSource {
  social: {
    getBuddy(actorId: string): {
      reach?: 'local' | 'remote';
      status?: BuddyLifecycleStatus;
    } | undefined;
    getPresence(actorId: string): BuddyPresence | undefined;
  };
  getNpcPlaceState(actorId: string, atMinute?: number): NpcPlaceQuery;
}

const isLifecycleUnavailable = (status?: BuddyLifecycleStatus): boolean =>
  status === 'distant' || status === 'gone' || status === 'blocked';

function projectPhysical(input: CharacterPresenceInput, reasonCodes: string[]): CharacterPhysicalPresence {
  switch (input.place.status) {
    case 'at_place':
      return { kind: 'at_place', placeId: input.place.placeId };
    case 'planned':
      reasonCodes.push('departure_planned');
      return { kind: 'at_place', placeId: input.place.originPlaceId };
    case 'in_transit':
      reasonCodes.push('in_transit');
      return {
        kind: 'in_transit',
        originPlaceId: input.place.originPlaceId,
        destinationPlaceId: input.place.destinationPlaceId,
        legIndex: input.place.legIndex,
        legKind: input.place.legKind,
      };
    case 'failed':
      reasonCodes.push('mobility_failed');
      return input.reach === 'remote'
        ? { kind: 'remote' }
        : { kind: 'unknown', failureReason: input.place.failureReason };
    case 'unknown':
    default:
      return input.reach === 'remote' ? { kind: 'remote' } : { kind: 'unknown' };
  }
}

function projectCommunication(
  input: CharacterPresenceInput,
  physical: CharacterPhysicalPresence,
  reasonCodes: string[],
): CharacterCommunicationStatus {
  if (isLifecycleUnavailable(input.lifecycleStatus)) {
    reasonCodes.push('lifecycle_unavailable');
    return 'offline';
  }

  switch (input.legacyPresence.status) {
    case 'offline':
      return 'offline';
    case 'away':
      return 'away';
    case 'busy':
      return 'busy';
    case 'online':
      if (physical.kind === 'in_transit' && !input.hasPortableMessagingDevice) {
        reasonCodes.push('transit_suppresses_active_device');
        return 'online_idle';
      }
      return 'online_active';
  }
}

export function resolveCharacterPresence(
  input: CharacterPresenceInput,
): CharacterPresenceProjection {
  const reasonCodes: string[] = [];
  const physical = projectPhysical(input, reasonCodes);
  const status = projectCommunication(input, physical, reasonCodes);
  const lifecycleUnavailable = isLifecycleUnavailable(input.lifecycleStatus);

  const canMessage = !lifecycleUnavailable && status !== 'offline';
  const canCall =
    !lifecycleUnavailable &&
    status !== 'offline' &&
    physical.kind !== 'in_transit';
  const canInteractInPerson =
    !lifecycleUnavailable &&
    physical.kind === 'at_place' &&
    (input.playerPlaceId === undefined || input.playerPlaceId === physical.placeId);

  return {
    actorId: input.actorId,
    physical,
    communication: {
      status,
      legacyStatus: input.legacyPresence.status,
      awayMessage: input.legacyPresence.awayMessage,
      ...(input.legacyPresence.customAwayMessage !== undefined
        ? { customAwayMessage: input.legacyPresence.customAwayMessage }
        : {}),
    },
    availability: {
      canMessage,
      canCall,
      canInteractInPerson,
    },
    reasonCodes,
  };
}

/**
 * Compatibility adapter over the real Away authorities. This is deliberately
 * a narrow read-only source contract rather than a new SimulationEngine-owned
 * presence state: #37 supplies physical truth and SocialEngine supplies the
 * legacy messenger input while consumers migrate to the coherent projection.
 */
export function resolveCharacterPresenceFromSimulation(
  source: CharacterPresenceSimulationSource,
  actorId: string,
  options: CharacterPresenceResolveOptions = {},
): CharacterPresenceProjection | null {
  const buddy = source.social.getBuddy(actorId);
  if (!buddy) return null;

  const legacyPresence = source.social.getPresence(actorId) ?? {
    status: 'offline',
    awayMessage: '',
  };

  return resolveCharacterPresence({
    actorId,
    place: source.getNpcPlaceState(actorId, options.atMinute),
    legacyPresence,
    reach: buddy.reach === 'remote' ? 'remote' : 'local',
    ...(buddy.status !== undefined ? { lifecycleStatus: buddy.status } : {}),
    ...(options.playerPlaceId !== undefined ? { playerPlaceId: options.playerPlaceId } : {}),
    ...(options.hasPortableMessagingDevice !== undefined
      ? { hasPortableMessagingDevice: options.hasPortableMessagingDevice }
      : {}),
  });
}
