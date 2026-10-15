import type { GameTime } from '../types';

/**
 * Serializable #172 wire-safe publication seed. 'unknown' deliberately
 * means that this milestone cannot yet prove a bounded dirty-domain set;
 * never pretend the clock was the only domain changed during a time jump.
 */
export type ObservedSimulationDomain =
  | 'clock' | 'player' | 'hardware' | 'downloads' | 'vfs' | 'software'
  | 'social' | 'world' | 'environment' | 'mood' | 'telemetry'
  | 'transit' | 'venue';

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
