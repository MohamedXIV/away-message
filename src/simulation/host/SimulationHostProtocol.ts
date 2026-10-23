import type { ActionResult, GlobalEvent, SimulationAction, SimulationState } from '../../engine/types';
import type { InitialSimulationState } from '../../engine/kernel/PhysicalSimulationRuntime';
import type { MinuteAdvanceGranularity } from '../../engine/kernel/TimeAdvancement';
import type { OsInstallPlan } from '../../engine/kernel/ComputerOwnershipRuntime';
import type { OsRelease, OsFamily } from '../../engine/OsCatalog';
import type { BuddyMetVia, CharacterArchetype } from '../../engine/types';
import type { SlotPulseMetadata, SlotSummary } from '../../persistence/slots';
import type {
  SimulationActorRead, SimulationAppRead, SimulationChange, SimulationChromeRead, SimulationDesktopRead,
  SimulationConversationRead, SimulationDirectoryRead, SimulationFileRead,
  SimulationHudProjection, SimulationGameViewRead, SimulationInstallerRead, SimulationArchiveRead, SimulationJobBoardRead, SimulationMailboxRead,
  SimulationMessengerRead, SimulationPlayerStatusRead, SimulationWeatherBuddyRead,
  SimulationPresenceRead, SimulationResidenceRead, SimulationSituationRead,
  SimulationTransitRead, SimulationWebsiteRead, SimulationWorldRead, SimulationInstalledProgramsRead,
  SimulationLabPageRead, SimulationCafeGuestRead,
} from '../../engine/kernel/SimulationPublication';

/** #175: Only whitelisted, bounded semantic/read models cross postMessage. */
export interface SimulationQueryResults {
  gameView: SimulationGameViewRead;
  cafeGuest: SimulationCafeGuestRead;
  hud: SimulationHudProjection;
  world: SimulationWorldRead;
  playerStatus: SimulationPlayerStatusRead;
  chrome: SimulationChromeRead;
  desktop: SimulationDesktopRead;
  installedPrograms: SimulationInstalledProgramsRead;
  labPage: SimulationLabPageRead;
  apps: SimulationAppRead;
  website: SimulationWebsiteRead;
  weatherBuddy: SimulationWeatherBuddyRead;
  jobBoard: SimulationJobBoardRead;
  mailbox: SimulationMailboxRead;
  installer: SimulationInstallerRead;
  archive: SimulationArchiveRead;
  presence: SimulationPresenceRead;
  messenger: SimulationMessengerRead;
  actor: SimulationActorRead | null;
  conversation: SimulationConversationRead;
  directory: SimulationDirectoryRead;
  file: SimulationFileRead;
  situation: SimulationSituationRead;
  residence: SimulationResidenceRead;
  transit: SimulationTransitRead;
}
export type SimulationQuery =
  | { kind: 'gameView' | 'hud' | 'world' | 'playerStatus' | 'chrome' | 'desktop' | 'apps' | 'installedPrograms' | 'presence' | 'situation' | 'residence' | 'transit' | 'website' | 'jobBoard' | 'mailbox' | 'weatherBuddy' }
  | { kind: 'cafeGuest' }
  | { kind: 'messenger'; maxContacts?: number }
  | { kind: 'labPage'; actorPage?: number; meetingPage?: number }
  | { kind: 'actor'; actorId: string }
  | { kind: 'conversation'; actorId: string; offset?: number; limit?: number }
  | { kind: 'directory'; path: string; offset?: number; limit?: number }
  | { kind: 'file'; path: string }
  | { kind: 'installer'; filePath: string }
  | { kind: 'archive'; archivePath: string };

export type SimulationQueryResult<Q extends SimulationQuery> = SimulationQueryResults[Q['kind']];

/** Developer-only offline procedural generator. No provider keys or world graph cross IPC. */
export type LabProceduralCategory = 'mixed' | 'city_news' | 'site_launch' | 'economy' | 'culture' | 'system' | 'os_release';
export interface LabProceduralCommand {
  mode: 'preview' | 'inject';
  seed: string;
  count: number;
  category: LabProceduralCategory;
  /** Mandatory on injection: reject worlds changed since the approved preview. */
  expectedRevision?: number;
}
export interface LabProceduralResult {
  revision: number;
  mode: LabProceduralCommand['mode'];
  events: Array<Pick<GlobalEvent, 'id' | 'title' | 'description' | 'category' | 'triggerDay' | 'triggerHour' | 'knowledgePrompt'>>;
  injectedIds: string[];
}

/** Worker-owned, deterministic OS generator; only a bounded release card crosses IPC. */
export interface LabOsCommand {
  mode: 'preview' | 'inject';
  seed: string;
  family: Extract<OsFamily, '5.x' | '6.x' | '7.x'>;
  expectedRevision?: number;
}
export interface LabOsResult {
  revision: number;
  mode: LabOsCommand['mode'];
  release: Pick<OsRelease, 'id' | 'version' | 'build' | 'displayName' | 'family' | 'kind' |
    'channel' | 'releaseDay' | 'changelog' | 'requirements' | 'installSizeGB' |
    'ramOverheadMB' | 'bootTimeSeconds' | 'theme' | 'price' | 'blurb'>;
  registered: boolean;
}

/** Offline authored newcomer creation. Caller cannot supply canonical actor state. */
export interface LabCharacterCommand {
  mode: 'preview' | 'inject';
  seed: string;
  metVia: Extract<BuddyMetVia, 'nightboard' | 'myplace' | 'pulse-room' | 'work'>;
  archetype: 'random' | Extract<CharacterArchetype, 'coworker' | 'nightowl' | 'student' | 'trader' | 'artist' | 'regular'>;
  expectedRevision?: number;
}
export interface LabCharacterResult {
  revision: number;
  mode: LabCharacterCommand['mode'];
  actor: {
    id: string;
    displayName: string;
    handle: string;
    archetype: string;
    metVia: LabCharacterCommand['metVia'];
    reach: 'local' | 'remote';
    introText: string;
  };
  registered: boolean;
}

/** Only authored choice index crosses IPC; the Worker selects the real guest. */
export type SimulationCafeNarrativeCommand =
  | { kind: 'startCafe' }
  | { kind: 'current' }
  | { kind: 'choose'; choiceIndex: number }
  | { kind: 'end' };
export interface SimulationCafeNarrativeResult {
  active: boolean;
  actor: { actorId: string; displayName: string } | null;
  frame: { text: string; tags: string[]; choices: Array<{ id: string; text: string }>; canContinue: boolean } | null;
}

export type SimulationHardwareCommand =
  | { kind: 'setup' }
  | { kind: 'power'; poweredOn: boolean }
  | { kind: 'insertMedia'; instanceId: string }
  | { kind: 'ejectMedia' }
  | { kind: 'prepareOs' }
  | { kind: 'commitOs'; plan: OsInstallPlan };


export type SimulationWorkerRequest =
  | { id: number; op: 'init'; initialState?: InitialSimulationState }
  | { id: number; op: 'initSlot'; slotId: string }
  | { id: number; op: 'dispatch'; action: SimulationAction }
  | { id: number; op: 'hardware'; command: SimulationHardwareCommand }
  | { id: number; op: 'cafeNarrative'; command: SimulationCafeNarrativeCommand }
  | { id: number; op: 'labProcedural'; command: LabProceduralCommand }
  | { id: number; op: 'labOs'; command: LabOsCommand }
  | { id: number; op: 'labCharacter'; command: LabCharacterCommand }
  | { id: number; op: 'advance'; minutes: number; reason?: string; granularity?: MinuteAdvanceGranularity }
  | { id: number; op: 'realtime'; seconds: number }
  | { id: number; op: 'clock'; running: boolean }
  | { id: number; op: 'query'; query: SimulationQuery }
  | { id: number; op: 'export' }
  | { id: number; op: 'saveSlot'; slotId: string; saveName?: string; pulse: SlotPulseMetadata }
  | { id: number; op: 'load'; snapshot: SimulationState };

// Omit<T> on a union collapses its variant members unless distributed.
export type SimulationWorkerCommand = SimulationWorkerRequest extends infer T
  ? T extends SimulationWorkerRequest ? Omit<T, 'id'> : never
  : never;

export type SimulationWorkerReply =
  | { type: 'result'; id: number; ok: true; value: unknown }
  | { type: 'result'; id: number; ok: false; error: { code: string; message: string } }
  | { type: 'change'; change: SimulationChange }
  | { type: 'fatal'; error: { code: string; message: string } };

export interface SimulationHost {
  dispatch(action: SimulationAction): Promise<ActionResult>;
  hardware(command: SimulationHardwareCommand): Promise<ActionResult<OsInstallPlan>>;
  cafeNarrative(command: SimulationCafeNarrativeCommand): Promise<SimulationCafeNarrativeResult>;
  labProcedural(command: LabProceduralCommand): Promise<LabProceduralResult>;
  labOs(command: LabOsCommand): Promise<LabOsResult>;
  labCharacter(command: LabCharacterCommand): Promise<LabCharacterResult>;
  advanceGameMinutes(minutes: number, reason?: string, granularity?: MinuteAdvanceGranularity): Promise<void>;
  advanceRealTime(seconds: number): Promise<void>;
  setClockRunning(running: boolean): Promise<void>;
  query<Q extends SimulationQuery>(query: Q): Promise<SimulationQueryResult<Q>>;
  exportSnapshot(): Promise<SimulationState>;
  loadSnapshot(snapshot: SimulationState): Promise<void>;
  saveSlot(slotId: string, pulse: SlotPulseMetadata, saveName?: string): Promise<SlotSummary>;
  subscribe(listener: (change: Readonly<SimulationChange>) => void): () => void;
  dispose(): void;
}
