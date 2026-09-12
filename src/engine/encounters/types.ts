// src/engine/encounters/types.ts
// #47 — Encounter Director contracts. Surfacing layer only: candidates are
// semantic references to authoritative facts (mobility, obligations, world
// modifiers). Nothing here owns relationships, appointments, transit timing,
// events, items, or presence. `none` is always a valid outcome.

import type { NpcTripRecord } from '../transit/NpcTrips';
import type { NpcPlaceQuery } from '../transit/NpcTrips';
import type { TransitNetwork } from '../transit/TransitNetwork';
import type {
  CharacterIntent,
  CharacterObligation,
  LifeWorldModifierView,
} from '../life/types';
import type { RelationshipDimensions } from '../types';
import type { WorldModifier } from '../WorldModifiers';

export type EncounterCandidateKind =
  | 'place_overlap'
  | 'transit_stop_wait'
  | 'transit_bus_ride'
  | 'obligation_anchor'
  | 'event_opportunity';

/**
 * Bounded semantic candidate. Every id/sourceId points at an owning record
 * (mobility place, trip leg, obligation, modifier); no outcome, wage, timing,
 * or relationship value is ever copied here.
 */
export interface EncounterCandidate {
  id: string;
  kind: EncounterCandidateKind;
  participantIds: string[];
  placeId: string;
  sourceIds: string[];
  priority: number;
  cooldownKey: string;
  validFromMinute: number;
  validUntilMinute: number;
  /** True when the moment must never resurface once shown (fixed obligations). */
  oneShot?: boolean;
  /** False when the player does not know a participant: presentation-only gate. */
  participantKnown: boolean;
}

/**
 * The only persisted Encounter Director state: cooldown identity/timestamps
 * plus surfaced one-shot identities. Candidates are always recomputed from
 * canonical authorities after reload. Both collections are hard-bounded.
 */
export interface EncounterDirectorState {
  cooldowns: Record<string, number>;
  surfacedOneShots: string[];
}

export type EncounterDecision =
  | { kind: 'encounter'; candidate: EncounterCandidate }
  | { kind: 'none'; reason: string };

/** Documented hard evaluation cap per decision cycle (slice-1 decision). */
export const MAX_CANDIDATES_PER_CYCLE = 8;

/** Minutes before the same cooldown key becomes eligible again. */
export const ENCOUNTER_COOLDOWN_MINUTES = 120;

/** Hard bound for each persisted director collection (oldest evicted first). */
export const MAX_DIRECTOR_STATE_ENTRIES = 64;

/** How long a point-in-time co-location fact stays a valid moment. */
export const ENCOUNTER_MOMENT_WINDOW_MINUTES = 30;

/** Read-only per-actor truth assembled by the caller (facade or tests). */
export interface EncounterActorRead {
  actorId: string;
  /** Authoritative place truth (getNpcPlaceState). */
  place: NpcPlaceQuery;
  /** Current intent, if any (selection input only, never executed here). */
  intent: CharacterIntent | null;
  /** Source-backed obligations (references only). */
  obligations: CharacterObligation[];
  /** Player↔actor dimensions for priority weighting (never mutated). */
  relationship: RelationshipDimensions | null;
  /** Player-knowledge gate for presentation (fact persists regardless). */
  knownToPlayer: boolean;
  /** Active event effects on this actor (provenance views, never persisted). */
  eventEffects: LifeWorldModifierView[];
}

export type EncounterPlayerTransitRead =
  | { kind: 'wait'; stopId: string; windowStart: number; windowEnd: number }
  | {
      kind: 'bus';
      lineId: string;
      fromStopId: string;
      toStopId: string;
      boardMinute: number;
      windowStart: number;
      windowEnd: number;
    };

/** Read-only decision input. Built from canonical systems; never written back. */
export interface EncounterDecisionInput {
  nowMinute: number;
  /** Player place in generated-namespace ids; null when unknown/in-transit. */
  playerPlaceId: string | null;
  /** Player wait/ride leg when travelling; null when settled. */
  playerTransit: EncounterPlayerTransitRead | null;
  actors: EncounterActorRead[];
  /** Committed trip records (transit truth for leg windows). */
  trips: Record<string, NpcTripRecord>;
  /** Transit network for same-run identity; null disables transit candidates. */
  network: TransitNetwork | null;
  /** Active world modifiers (queryActiveModifiers provenance). */
  activeModifiers: WorldModifier[];
}
