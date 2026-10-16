import type { GameTime } from '../types';

/**
 * Serializable #172 wire-safe publication seed. 'unknown' deliberately
 * means that this milestone cannot yet prove a bounded dirty-domain set;
 * never pretend the clock was the only domain changed during a time jump.
 */
export type ObservedSimulationDomain =
  | 'clock' | 'player' | 'hardware' | 'downloads' | 'vfs' | 'software'
  | 'social' | 'world' | 'environment' | 'mood' | 'telemetry'
  | 'transit' | 'venue' | 'residence';

export interface SimulationChange {
  revision: number;
  atMinute: number;
  /**
   * Event-backed provenance. 'unknown' is always present until all owners
   * provide complete write attribution; no consumer may safely skip reads
   * by assuming omitted domains did not change.
   */
  changedDomains: readonly ('unknown' | ObservedSimulationDomain)[];
}

/** Source-event attribution only — never asserts complete dirty coverage. */
export function domainFromEmission(event: string): ObservedSimulationDomain | null {
  switch (event.split(':')[0]) {
    case 'time': return 'clock';
    case 'economy':
    case 'needs': return 'player';
    case 'hardware': return 'hardware';
    case 'download': return 'downloads';
    case 'vfs': return 'vfs';
    case 'software': return 'software';
    case 'social': return 'social';
    case 'world':
    case 'narrative': return 'world';
    case 'environment': return 'environment';
    case 'mood': return 'mood';
    case 'telemetry': return 'telemetry';
    case 'npc':
    case 'spatial': return 'transit';
    case 'venue': return 'venue';
    default: return null;
  }
}

export interface SimulationHudProjection {
  revision: number;
  time: GameTime;
  paused: boolean;
  cash: number;
  socialBattery: number;
  activeView: 'pc' | 'room' | 'cafe' | 'work' | 'city';
}

/** Render-specific dependencies, not a copy of the persisted world. */
export interface SimulationWorldRead {
  revision: number;
  time: GameTime;
  activeView: SimulationHudProjection['activeView'];
  residencePlaceId: string;
  playerLocation: import('../CityMap').CityNodeId;
  environment: import('../EnvironmentEngine').EnvironmentSnapshot;
  /** Only the room's active authored capability and explicitly used window flag. */
  pcBootState: import('./ComputerOwnershipRuntime').PcBootState;
  metInPerson: boolean;
}

/** Player-visible read of a single selected real actor. */
export interface SimulationActorRead {
  revision: number;
  actor: import('../semantic/ActorSemantics').ActorSemanticView;
  /** Only facts/claims the player has actually learned, not NPC private knowledge. */
  playerKnowledge: import('../semantic/KnowledgeLedger').ActorKnowledgeView;
  /** Public global-event influences applying to this actor, with source/window. */
  influences: import('../semantic/ActorSemantics').SemanticInfluenceView[];
}

export interface SimulationMessengerRead {
  revision: number;
  contacts: ReturnType<import('../SocialEngine').SocialEngine['getMessengerSummary']>;
  unreadCounts: Record<string, number>;
}

export interface SimulationConversationRead extends ReturnType<import('../SocialEngine').SocialEngine['getConversationPage']> {
  revision: number;
}

/** Small desktop chrome/tray input. Never ships the message history or VFS. */
export interface SimulationChromeRead {
  revision: number;
  time: GameTime;
  osVersion: import('../types').OsVersion | null;
  pulseVersion: string;
  pulseInstalled: boolean;
  connectionType: import('../types').HardwareState['connectionType'];
  connectionSpeedKbps: number;
  activeDownloadCount: number;
  unreadCount: number;
  unreadPreviews: ReturnType<import('../SocialEngine').SocialEngine['getUnreadTraySummary']>['previews'];
}

/** Minimal desktop shell input: no file bodies, full VFS map or raw inventory. */
export interface SimulationDesktopRead {
  revision: number;
  osVersion: import('../types').OsVersion | null;
  pcBootState: import('./ComputerOwnershipRuntime').PcBootState;
  monitor: ReturnType<import('../HardwareEngine').HardwareEngine['getDisplayState']>['monitor'];
  bootMediaItems: import('../types').OwnedItem[];
  desktopFiles: Array<Pick<import('../types').FileRecord,
    'id' | 'name' | 'path' | 'parentPath' | 'kind' | 'appAssociation'>>;
}

/** UI-readable presence projection. Omits relationships, memories and chat history. */
export interface SimulationPresenceRead {
  revision: number;
  presence: ReturnType<import('../SocialEngine').SocialEngine['getPresenceSummary']>;
}

/** Legacy desktop app dependencies, projected only from the relevant owners. */
export interface SimulationAppRead {
  revision: number;
  computer: Pick<import('../types').ComputerSetupState, 'assembled' | 'poweredOn'>;
  downloads: import('../types').DownloadTask[];
  hardware: import('../types').HardwareState;
  os: ReturnType<import('../OsEngine').OsEngine['getState']>;
  installedSoftware: import('../types').InstalledSoftwareRecord[];
}

/** Per-directory visible metadata; file contents are requested separately. */
export interface SimulationDirectoryRead {
  revision: number;
  path: string;
  files: import('../types').FileRecord[];
  totalDiskBytes: number;
  baseSystemBytes: number;
  freeDiskBytes: number;
}

/** An explicit one-file editor/document read, not a whole VFS snapshot. */
export interface SimulationFileRead {
  revision: number;
  file: import('../types').FileRecord | null;
}

/** Shop UI only, no equipment list or WorldState transport. */
export interface SimulationShopRead {
  revision: number;
  cash: number;
  hardware: import('../types').HardwareState;
  osVersion: import('../types').OsVersion | null;
  purchaseCounts: Record<string, number>;
  legacyRecovery?: import('../types').LegacyRecoveryState;
  roomPackageCount: number;
}

/** Internet sites get a player-visible world feed, not private NPC state. */
export interface SimulationWebsiteRead {
  revision: number;
  time: GameTime;
  cash: number;
  /** Compatibility with published site helper shapes; private banks are empty. */
  world: import('../types').WorldState;
  narrativeFlags: Record<string, boolean | number | string>;
  myplace: ReturnType<import('../MyPlaceEngine').MyPlaceEngine['getState']>;
}

/** One opened Pulse profile card. No other actors' memories or event knowledge. */
export interface SimulationPulseProfileRead {
  revision: number;
  buddyKnowledge: import('../types').BuddyEventKnowledge[];
  worldEvents: import('../types').GlobalEvent[];
  photoMemories: import('../types').CoreMemory[];
  /** Player-safe reach, relationship and explainable chat/meeting eligibility. */
  semantics: import('../semantic/ActorSemantics').ActorSemanticView | null;
  influences: import('../semantic/ActorSemantics').SemanticInfluenceView[];
}

/** Current public Situation derived from canonical event/typed-influence truth. */
export interface SimulationSituationRead {
  revision: number;
  atMinute: number;
  activeEventIds: string[];
  influences: Array<import('../WorldModifiers').WorldModifier>;
}

/** One canonical tenancy and currently authored housing offers, not the physical-world graph. */
export interface SimulationResidenceRead {
  revision: number;
  tenancy: import('../ResidenceTenancy').ResidenceState;
  offers: ReturnType<import('./PhysicalSimulationRuntime').PhysicalSimulationRuntime['getHousingOffers']>;
}

/** Player's active journey only: no NPC trips, all-actor positions or transit network. */
export interface SimulationTransitRead {
  revision: number;
  atMinute: number;
  active: null | {
    status: import('../transit/types').ActiveTravelState['status'];
    originPlaceId: string;
    destinationPlaceId: string;
    currentLegIndex: number;
    currentLeg: import('../transit/types').TravelLeg | null;
    arriveAtMinute: number;
    minutesRemaining: number;
  };
}
