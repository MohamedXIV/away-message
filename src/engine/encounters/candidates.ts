// src/engine/encounters/candidates.ts
// #47 — pure candidate builders. Each candidate references authoritative
// facts by id; builders read inputs and return data. No engine imports,
// no writes of any kind (inputs are treated as read-only).

import { activeTravelLegWindows } from '../transit/ActiveTravel';
import { transitRunIdentity } from '../transit/NpcTrips';
import type {
  EncounterActorRead,
  EncounterCandidate,
  EncounterCandidateKind,
  EncounterDecisionInput,
} from './types';
import { ENCOUNTER_MOMENT_WINDOW_MINUTES } from './types';

const BASE_PRIORITY: Record<EncounterCandidateKind, number> = {
  place_overlap: 50,
  transit_stop_wait: 45,
  transit_bus_ride: 45,
  obligation_anchor: 0, // obligation carries its own authored priority
  event_opportunity: 55,
};

/** Bounded relationship weight from player↔actor dimensions: 0..5, read-only. */
function relationshipWeight(relationship: EncounterActorRead['relationship']): number {
  if (!relationship) return 0;
  const warmth = Math.max(0, relationship.familiarity) + Math.max(0, relationship.affection);
  return Math.max(0, Math.min(5, Math.round(warmth / 40)));
}

/** +10 when the actor's current intent already targets the candidate place. */
function intentAlignmentBonus(
  intent: EncounterActorRead['intent'],
  placeId: string,
): number {
  if (!intent || intent.targetPlaceId === undefined) return 0;
  return intent.targetPlaceId === placeId ? 10 : 0;
}

function overlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): { start: number; end: number } | null {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return start < end ? { start, end } : null;
}

function baseCandidate(
  init: Omit<EncounterCandidate, 'participantKnown'> & { participantKnown?: boolean },
): EncounterCandidate {
  return { participantKnown: true, ...init };
}

function momentWindow(nowMinute: number): { validFromMinute: number; validUntilMinute: number } {
  return { validFromMinute: nowMinute, validUntilMinute: nowMinute + ENCOUNTER_MOMENT_WINDOW_MINUTES };
}

/** Same generated place, both settled: the diner-work-obligation shape. */
export function buildPlaceOverlapCandidates(input: EncounterDecisionInput): EncounterCandidate[] {
  const { nowMinute, playerPlaceId, actors } = input;
  if (playerPlaceId === null || playerPlaceId === '') return [];
  const window = momentWindow(nowMinute);
  const found: EncounterCandidate[] = [];
  for (const actor of actors) {
    if (actor.place.status !== 'at_place' || actor.place.placeId !== playerPlaceId) continue;
    const priority =
      BASE_PRIORITY.place_overlap +
      relationshipWeight(actor.relationship) +
      intentAlignmentBonus(actor.intent, playerPlaceId);
    found.push(
      baseCandidate({
        id: `place:${playerPlaceId}:${actor.actorId}`,
        kind: 'place_overlap',
        participantIds: [actor.actorId],
        placeId: playerPlaceId,
        sourceIds: [`mobility:place:${actor.actorId}`],
        priority,
        cooldownKey: `place:${playerPlaceId}:${actor.actorId}`,
        ...window,
        participantKnown: actor.knownToPlayer,
      }),
    );
  }
  return found;
}

/**
 * Truthful transit overlap between the player's live wait/ride leg and an
 * NPC's committed trip legs. Bus rides require the same run identity (same
 * line + same runStart), so different runs never co-locate.
 */
export function buildTransitCandidates(input: EncounterDecisionInput): EncounterCandidate[] {
  const { nowMinute, playerTransit, actors, trips, network } = input;
  if (!playerTransit || !network) return [];
  const window = momentWindow(nowMinute);
  const found: EncounterCandidate[] = [];
  for (const actor of actors) {
    const record = trips[actor.actorId];
    if (!record || (record.status !== 'planned' && record.status !== 'active')) continue;
    const windows = activeTravelLegWindows(record.trip);
    const legs = record.trip.plan.legs;
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]!;
      const legWindow = windows[i];
      if (!legWindow) continue;
      if (playerTransit.kind === 'wait' && leg.kind === 'wait' && leg.stopId === playerTransit.stopId) {
        const span = overlap(
          legWindow.startMinute, legWindow.endMinute,
          playerTransit.windowStart, playerTransit.windowEnd,
        );
        if (!span || nowMinute < span.start || nowMinute >= span.end) continue;
        found.push(
          baseCandidate({
            id: `transit:wait:${leg.stopId}:${actor.actorId}`,
            kind: 'transit_stop_wait',
            participantIds: [actor.actorId],
            placeId: leg.stopId,
            sourceIds: [`mobility:trip:${actor.actorId}:leg:${i}`],
            priority: BASE_PRIORITY.transit_stop_wait + relationshipWeight(actor.relationship),
            cooldownKey: `transit:wait:${leg.stopId}:${actor.actorId}`,
            validFromMinute: span.start,
            validUntilMinute: Math.min(span.end, window.validUntilMinute),
            participantKnown: actor.knownToPlayer,
          }),
        );
      } else if (
        playerTransit.kind === 'bus' &&
        leg.kind === 'bus' &&
        leg.lineId === playerTransit.lineId
      ) {
        const span = overlap(
          legWindow.startMinute, legWindow.endMinute,
          playerTransit.windowStart, playerTransit.windowEnd,
        );
        if (!span || nowMinute < span.start || nowMinute >= span.end) continue;
        const npcRun = transitRunIdentity(network, leg.lineId, leg.fromStopId, leg.toStopId, legWindow.startMinute);
        const playerRun = transitRunIdentity(
          network, playerTransit.lineId, playerTransit.fromStopId, playerTransit.toStopId, playerTransit.boardMinute,
        );
        if (!npcRun || !playerRun || npcRun.runStartMinute !== playerRun.runStartMinute) continue;
        found.push(
          baseCandidate({
            id: `transit:ride:${leg.lineId}:${actor.actorId}`,
            kind: 'transit_bus_ride',
            participantIds: [actor.actorId],
            placeId: leg.toStopId,
            sourceIds: [`mobility:trip:${actor.actorId}:leg:${i}`],
            priority: BASE_PRIORITY.transit_bus_ride + relationshipWeight(actor.relationship),
            cooldownKey: `transit:ride:${leg.lineId}:${actor.actorId}`,
            validFromMinute: span.start,
            validUntilMinute: Math.min(span.end, window.validUntilMinute),
            participantKnown: actor.knownToPlayer,
          }),
        );
      }
    }
  }
  return found;
}

/**
 * Source-backed obligations anchoring an actor at the player's place.
 * The candidate references the owning record (sourceId ?? id) and copies no
 * outcome. Fixed obligations are one-shot: a shown appointment never returns.
 */
export function buildObligationCandidates(input: EncounterDecisionInput): EncounterCandidate[] {
  const { nowMinute, playerPlaceId, actors } = input;
  if (playerPlaceId === null || playerPlaceId === '') return [];
  const found: EncounterCandidate[] = [];
  for (const actor of actors) {
    if (actor.place.status !== 'at_place' || actor.place.placeId !== playerPlaceId) continue;
    for (const obligation of actor.obligations) {
      if (obligation.actorId !== actor.actorId) continue;
      if (obligation.destinationPlaceId !== playerPlaceId) continue;
      if (obligation.status !== 'pending' && obligation.status !== 'planned' && obligation.status !== 'in_progress') continue;
      const from = Math.max(nowMinute, obligation.earliestAt ?? nowMinute);
      const until = obligation.latestAt ?? nowMinute + ENCOUNTER_MOMENT_WINDOW_MINUTES;
      if (from >= until) continue;
      found.push(
        baseCandidate({
          id: `obligation:${obligation.id}`,
          kind: 'obligation_anchor',
          participantIds: [actor.actorId],
          placeId: playerPlaceId,
          sourceIds: [obligation.sourceId ?? obligation.id],
          priority: obligation.priority + intentAlignmentBonus(actor.intent, playerPlaceId),
          cooldownKey: `obligation:${obligation.id}`,
          validFromMinute: from,
          validUntilMinute: until,
          oneShot: true,
          participantKnown: actor.knownToPlayer,
        }),
      );
    }
  }
  return found;
}

/**
 * World-event opportunities (e.g. a festival making a quiet place busy).
 * Requires a real co-located actor: an opportunity with nobody present
 * creates no candidate. References the modifier + source event by id only.
 */
export function buildEventOpportunityCandidates(input: EncounterDecisionInput): EncounterCandidate[] {
  const { nowMinute, playerPlaceId, actors, activeModifiers } = input;
  if (playerPlaceId === null || playerPlaceId === '') return [];
  const window = momentWindow(nowMinute);
  const found: EncounterCandidate[] = [];
  for (const modifier of activeModifiers) {
    if (modifier.domain !== 'life' || !modifier.kind.endsWith('_opportunity')) continue;
    if (!Number.isFinite(modifier.startsAtMinute)) continue;
    if (modifier.targetIds !== undefined && !modifier.targetIds.includes(playerPlaceId)) continue;
    const from = Math.max(nowMinute, modifier.startsAtMinute);
    const until = Math.min(modifier.endsAtMinute ?? window.validUntilMinute, window.validUntilMinute);
    if (from >= until) continue;
    const valueBoost =
      typeof modifier.value === 'number' && Number.isFinite(modifier.value)
        ? Math.max(0, Math.min(20, Math.round(modifier.value)))
        : 0;
    for (const actor of actors) {
      if (actor.place.status !== 'at_place' || actor.place.placeId !== playerPlaceId) continue;
      found.push(
        baseCandidate({
          id: `event:${modifier.id}:${actor.actorId}`,
          kind: 'event_opportunity',
          participantIds: [actor.actorId],
          placeId: playerPlaceId,
          sourceIds: [modifier.id, modifier.sourceEventId],
          priority:
            BASE_PRIORITY.event_opportunity +
            valueBoost +
            relationshipWeight(actor.relationship) +
            intentAlignmentBonus(actor.intent, playerPlaceId),
          cooldownKey: `event:${modifier.id}:${actor.actorId}`,
          validFromMinute: from,
          validUntilMinute: until,
          participantKnown: actor.knownToPlayer,
        }),
      );
    }
  }
  return found;
}

/** All slice-1 candidate sources. Pure collection: no filtering, no marking. */
export function collectEncounterCandidates(input: EncounterDecisionInput): EncounterCandidate[] {
  return [
    ...buildPlaceOverlapCandidates(input),
    ...buildTransitCandidates(input),
    ...buildObligationCandidates(input),
    ...buildEventOpportunityCandidates(input),
  ];
}
