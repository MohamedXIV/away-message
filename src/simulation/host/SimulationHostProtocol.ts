import type { ActionResult, SimulationAction, SimulationState } from '../../engine/types';
import type { InitialSimulationState } from '../../engine/kernel/PhysicalSimulationRuntime';
import type { SlotPulseMetadata, SlotSummary } from '../../persistence/slots';
import type {
  SimulationActorRead, SimulationChange, SimulationChromeRead,
  SimulationConversationRead, SimulationDirectoryRead, SimulationFileRead,
  SimulationHudProjection, SimulationMessengerRead, SimulationPlayerStatusRead,
  SimulationPresenceRead, SimulationResidenceRead, SimulationSituationRead,
  SimulationTransitRead, SimulationWorldRead,
} from '../../engine/kernel/SimulationPublication';

/** #175: Only whitelisted, bounded semantic/read models cross postMessage. */
export interface SimulationQueryResults {
  hud: SimulationHudProjection;
  world: SimulationWorldRead;
  playerStatus: SimulationPlayerStatusRead;
  chrome: SimulationChromeRead;
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
  | { kind: 'hud' | 'world' | 'playerStatus' | 'chrome' | 'presence' | 'situation' | 'residence' | 'transit' }
  | { kind: 'messenger'; maxContacts?: number }
  | { kind: 'actor'; actorId: string }
  | { kind: 'conversation'; actorId: string; offset?: number; limit?: number }
  | { kind: 'directory'; path: string; offset?: number; limit?: number }
  | { kind: 'file'; path: string };

export type SimulationQueryResult<Q extends SimulationQuery> = SimulationQueryResults[Q['kind']];

export type SimulationWorkerRequest =
  | { id: number; op: 'init'; initialState?: InitialSimulationState }
  | { id: number; op: 'initSlot'; slotId: string }
  | { id: number; op: 'dispatch'; action: SimulationAction }
  | { id: number; op: 'advance'; minutes: number; reason?: string }
  | { id: number; op: 'realtime'; seconds: number }
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
  | { type: 'change'; change: SimulationChange };

export interface SimulationHost {
  dispatch(action: SimulationAction): Promise<ActionResult>;
  advanceGameMinutes(minutes: number, reason?: string): Promise<void>;
  advanceRealTime(seconds: number): Promise<void>;
  query<Q extends SimulationQuery>(query: Q): Promise<SimulationQueryResult<Q>>;
  exportSnapshot(): Promise<SimulationState>;
  loadSnapshot(snapshot: SimulationState): Promise<void>;
  saveSlot(slotId: string, pulse: SlotPulseMetadata, saveName?: string): Promise<SlotSummary>;
  subscribe(listener: (change: Readonly<SimulationChange>) => void): () => void;
  dispose(): void;
}
