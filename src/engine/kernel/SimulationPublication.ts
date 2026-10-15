import type { GameTime } from '../types';

/**
 * Serializable #172 wire-safe publication seed. 'unknown' deliberately
 * means that this milestone cannot yet prove a bounded dirty-domain set;
 * never pretend the clock was the only domain changed during a time jump.
 */
export interface SimulationChange {
  revision: number;
  atMinute: number;
  changedDomains: readonly ['unknown'];
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
}

export interface SimulationConversationRead extends ReturnType<import('../SocialEngine').SocialEngine['getConversationPage']> {
  revision: number;
}
