// src/engine/transit/NpcTrips.ts
// Deterministic NPC mobility execution (#37): departure → transit → arrival.
//
// Consumes #44 CharacterIntent (WHY/WHERE/window) and #35 route truth
// (planTravel/commit/travelStateAtMinute). This module is pure: it plans,
// progresses, and reports facts. It never mutates relationships, jobs,
// appointments, economy, or messenger presence — owners act on receipts.
//
// One record per actor max. Departed trips are never replanned. Reads and
// repeated progression are idempotent; persistence reuses the validated
// ActiveTravel snapshot contract.

import {
  activeTravelLegWindows,
  commitTravelPlan,
  parseActiveTravel,
  travelStateAtMinute,
} from './ActiveTravel';
import { planTravel } from './TravelPlanner';
import { buildTransitNetwork, type TransitNetwork } from './TransitNetwork';
import {
  GENERATED_DISTRICTS,
  GENERATED_PLACES,
  GENERATED_TRANSIT_STOPS,
  GENERATED_BUS_LINES,
  type GeneratedPlaceDef,
} from '../worldContent.generated';
import type { CharacterIntent, CharacterIntentKind, ObligationSourceKind } from '../life/types';
import type {
  ActiveTravelState,
  TransitServiceState,
  TravelLeg,
  TravelPlan,
  TravelPlanFailure,
  TravelPolicy,
} from './types';

/** Bounded preparation lead before the desired arrival window. */
export const NPC_PREP_LEAD_MINUTES = 10;

export type NpcTripStatus = 'planned' | 'active' | 'arrived' | 'failed' | 'cancelled';

export type NpcTripFailureReason = TravelPlanFailure | 'unknown_origin';

export interface NpcTripRecord {
  trip: ActiveTravelState;
  intentKind: CharacterIntentKind;
  sourceKind?: ObligationSourceKind;
  sourceId?: string;
  originPlaceId: string;
  destinationPlaceId: string;
  desiredArrivalMinute?: number;
  plannedDepartureMinute: number;
  expectedArrivalMinute: number;
  policy: TravelPolicy;
  status: NpcTripStatus;
  failureReason?: NpcTripFailureReason;
  completedAtMinute?: number;
}

export interface NpcMobilityState {
  trips: Record<string, NpcTripRecord>;
  /** Canonical current place per actor. Written only on authoritative arrival. */
  places: Record<string, string>;
}

export interface NpcArrivalReceipt {
  actorId: string;
  sourceKind?: ObligationSourceKind;
  sourceId?: string;
  originPlaceId: string;
  destinationPlaceId: string;
  departedAtMinute: number;
  arrivedAtMinute: number;
  lateByMinutes: number;
}

export interface NpcFailureReceipt {
  actorId: string;
  sourceKind?: ObligationSourceKind;
  sourceId?: string;
  reason: NpcTripFailureReason;
}

export type NpcCoLocation =
  | {
      kind: 'stop_wait';
      actors: [string, string];
      stopId: string;
      overlapStartMinute: number;
      overlapEndMinute: number;
    }
  | {
      kind: 'bus_ride';
      actors: [string, string];
      lineId: string;
      overlapStartMinute: number;
      overlapEndMinute: number;
    }
  | {
      kind: 'destination';
      actors: [string, string];
      placeId: string;
      overlapStartMinute: number;
    };

export type NpcPlaceQuery =
  | { status: 'unknown' }
  | { status: 'at_place'; placeId: string }
  | {
      status: 'planned';
      originPlaceId: string;
      destinationPlaceId: string;
      plannedDepartureMinute: number;
    }
  | {
      status: 'in_transit';
      originPlaceId: string;
      destinationPlaceId: string;
      legIndex: number;
      legKind: TravelLeg['kind'];
    }
  | { status: 'failed'; originPlaceId?: string; failureReason: NpcTripFailureReason };

const TRIP_STATUSES: ReadonlySet<string> = new Set([
  'planned',
  'active',
  'arrived',
  'failed',
  'cancelled',
]);

const INTENT_KINDS: ReadonlySet<string> = new Set([
  'stay_current_activity',
  'prepare_to_leave',
  'travel_to_place',
  'perform_work',
  'attend_appointment',
  'shop_for_need',
  'visit_person',
  'return_home',
  'use_computer',
  'call_or_message',
  'rest_or_sleep',
  'pursue_personal_goal',
]);

/** Destination-bearing intents are the only ones that may start a trip. */
function isTravelIntent(intent: CharacterIntent): boolean {
  if (intent.targetPlaceId === undefined || intent.targetPlaceId.trim() === '') return false;
  if (intent.earliestAt === undefined || !Number.isFinite(intent.earliestAt)) return false;
  return (
    intent.kind === 'attend_appointment' ||
    intent.kind === 'perform_work' ||
    intent.kind === 'prepare_to_leave' ||
    intent.kind === 'travel_to_place'
  );
}

export function emptyNpcMobility(): NpcMobilityState {
  return { trips: {}, places: {} };
}

/** Legacy/appointment location ids mapped through authored place aliases. */
export function buildPlaceAliases(places: GeneratedPlaceDef[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const place of places) {
    if (!place || typeof place.id !== 'string') continue;
    for (const legacyId of place.legacyIds ?? []) {
      if (typeof legacyId === 'string' && legacyId !== '' && aliases[legacyId] === undefined) {
        aliases[legacyId] = place.id;
      }
    }
  }
  return aliases;
}

/**
 * Resolve any location id to a network place: transit ids pass through,
 * legacy ids resolve through authored aliases, everything else fails
 * closed (never invented).
 */
export function resolveTransitPlaceId(
  rawId: string,
  network: TransitNetwork,
  aliases: Record<string, string>,
): string | null {
  if (typeof rawId !== 'string' || rawId === '') return null;
  if (network.places.has(rawId)) return rawId;
  const mapped = aliases[rawId];
  if (typeof mapped === 'string' && network.places.has(mapped)) return mapped;
  return null;
}

let sharedNetwork: TransitNetwork | null | undefined;
let sharedAliases: Record<string, string> | undefined;

/** Process-wide read-only network built once from generated content. Null when content is invalid. */
export function getSharedTransitNetwork(): TransitNetwork | null {
  if (sharedNetwork !== undefined) return sharedNetwork;
  try {
    sharedNetwork = buildTransitNetwork({
      districts: GENERATED_DISTRICTS,
      places: GENERATED_PLACES,
      stops: GENERATED_TRANSIT_STOPS,
      lines: GENERATED_BUS_LINES,
    });
  } catch {
    sharedNetwork = null;
  }
  return sharedNetwork;
}

/** Content-authored legacy aliases for the shared network (empty until town content matures). */
export function getSharedPlaceAliases(): Record<string, string> {
  if (sharedAliases === undefined) sharedAliases = buildPlaceAliases(GENERATED_PLACES);
  return sharedAliases;
}

export interface PlanNpcTripArgs {
  actorId: string;
  intent: CharacterIntent;
  originPlaceId: string;
  nowMinute: number;
  network?: TransitNetwork;
  aliases?: Record<string, string>;
  service?: TransitServiceState;
}

export type PlanNpcTripResult =
  | { ok: true; record: NpcTripRecord }
  | { ok: false; reason: NpcTripFailureReason | 'already_there' };

function quote(
  network: TransitNetwork,
  origin: string,
  destination: string,
  departAtMinute: number,
  policy: TravelPolicy,
  service: TransitServiceState | undefined,
): ReturnType<typeof planTravel> {
  return planTravel(network, {
    originPlaceId: origin,
    destinationPlaceId: destination,
    departAtMinute,
    policy,
    ...(service === undefined ? {} : { service }),
  });
}

/**
 * Plan one NPC trip from a destination intent. Pure: same inputs always
 * yield the same record. Never moves the actor — the record starts
 * `planned` (or `active` when already late) and progresses only via
 * progressNpcTrips on the authoritative clock.
 */
export function planNpcTrip(args: PlanNpcTripArgs): PlanNpcTripResult {
  const { actorId, intent, originPlaceId, nowMinute } = args;
  const network = args.network ?? getSharedTransitNetwork();
  if (!network) return { ok: false, reason: 'no_route' };
  const aliases = args.aliases ?? getSharedPlaceAliases();
  if (typeof actorId !== 'string' || actorId === '') return { ok: false, reason: 'unknown_origin' };
  if (!Number.isFinite(nowMinute)) return { ok: false, reason: 'unknown_origin' };

  const destination = resolveTransitPlaceId(intent.targetPlaceId ?? '', network, aliases);
  if (!network.places.has(originPlaceId)) return { ok: false, reason: 'unknown_origin' };
  if (!destination) return { ok: false, reason: 'unknown_destination' };
  if (destination === originPlaceId) return { ok: false, reason: 'already_there' };
  const desired = intent.earliestAt;
  if (desired === undefined || !Number.isFinite(desired)) return { ok: false, reason: 'no_route' };

  const tryPolicies: TravelPolicy[] = ['fastest', 'walk_only'];
  let lastReason: NpcTripFailureReason = 'no_route';
  for (const policy of tryPolicies) {
    const probe = quote(network, originPlaceId, destination, Math.max(nowMinute, desired - NPC_PREP_LEAD_MINUTES), policy, args.service);
    if (!probe.ok) {
      lastReason = probe.reason;
      continue;
    }
    const departure = desired - NPC_PREP_LEAD_MINUTES - probe.plan.totalMinutes;
    if (departure <= nowMinute) {
      const late = quote(network, originPlaceId, destination, nowMinute, policy, args.service);
      if (!late.ok) {
        lastReason = late.reason;
        continue;
      }
      return {
        ok: true,
        record: commitRecord(actorId, intent, originPlaceId, destination, late.plan, nowMinute, desired, policy, 'active'),
      };
    }
    // The departure-time confirmation is authoritative. A failed confirm
    // must NEVER fall back to the later probe shifted backward — that shift
    // can move a bus itinerary into a window where it was never valid.
    const confirm = quote(network, originPlaceId, destination, departure, policy, args.service);
    if (!confirm.ok) {
      lastReason = confirm.reason;
      continue;
    }
    return {
      ok: true,
      record: commitRecord(actorId, intent, originPlaceId, destination, confirm.plan, departure, desired, policy, 'planned'),
    };
  }
  return { ok: false, reason: lastReason };
}

function commitRecord(
  actorId: string,
  intent: CharacterIntent,
  originPlaceId: string,
  destination: string,
  plan: TravelPlan,
  committedAtMinute: number,
  desired: number,
  policy: TravelPolicy,
  status: 'planned' | 'active',
): NpcTripRecord {
  return {
    trip: commitTravelPlan(actorId, plan, committedAtMinute, intent.sourceId),
    intentKind: intent.kind,
    ...(intent.sourceKind === undefined ? {} : { sourceKind: intent.sourceKind }),
    ...(intent.sourceId === undefined ? {} : { sourceId: intent.sourceId }),
    originPlaceId,
    destinationPlaceId: destination,
    desiredArrivalMinute: desired,
    plannedDepartureMinute: committedAtMinute,
    expectedArrivalMinute: committedAtMinute + plan.totalMinutes,
    policy,
    status,
  };
}

/** Point-in-time position derived from the authoritative minute. Pure. */
export function tripStatusAt(
  record: NpcTripRecord,
  minute: number,
): { status: NpcTripStatus; legIndex: number } {
  if (record.status === 'failed' || record.status === 'cancelled') {
    return { status: record.status, legIndex: record.trip.currentLegIndex };
  }
  if (record.status === 'arrived') {
    return { status: 'arrived', legIndex: record.trip.currentLegIndex };
  }
  if (minute < record.plannedDepartureMinute) {
    return { status: 'planned', legIndex: 0 };
  }
  const resolved = travelStateAtMinute(record.trip, minute);
  if (resolved.status === 'arrived') return { status: 'arrived', legIndex: resolved.currentLegIndex };
  return { status: 'active', legIndex: resolved.currentLegIndex };
}

export interface PlanDueResult {
  state: NpcMobilityState;
  planned: string[];
  failed: NpcFailureReceipt[];
  cancelled: string[];
}

/**
 * Plan trips for actors holding destination intents. Pure and idempotent:
 * stable commitments (same source + resolved destination + window) are
 * kept, departed trips are never replanned, arrived trips replan only for
 * a NEW intent (same intent after arrival is a no-op), superseded planned
 * trips are replaced or cancelled. Destination comparison always uses the
 * resolved canonical place — never the raw (possibly aliased) intent id —
 * so planned trips stay stable across ticks.
 *
 * Departure protection is by authoritative time boundary, not the mutable
 * status flag: once nowMinute reaches plannedDepartureMinute the commitment
 * is due and can no longer be replaced, even if it still reads `planned`
 * because progression runs after planning on the same tick.
 */
export function planDueNpcTrips(
  state: NpcMobilityState,
  intents: ReadonlyMap<string, CharacterIntent | null>,
  nowMinute: number,
  deps: { network: TransitNetwork | null; aliases: Record<string, string>; service?: TransitServiceState },
): PlanDueResult {
  const trips: Record<string, NpcTripRecord> = {};
  for (const [actorId, record] of Object.entries(state.trips)) {
    trips[actorId] = cloneRecord(record);
  }
  const places: Record<string, string> = { ...state.places };
  const planned: string[] = [];
  const failed: NpcFailureReceipt[] = [];
  const cancelled: string[] = [];

  for (const [actorId, intent] of intents) {
    const existing = trips[actorId];
    // Due commitments are never replanned: once the authoritative clock
    // reaches plannedDepartureMinute the trip is leaving, even if its
    // stored status still reads `planned` (progression runs after planning
    // on the same tick). Failed/cancelled records stay replannable below.
    const dueByTime = existing !== undefined &&
      (existing.status === 'planned' || existing.status === 'active') &&
      nowMinute >= existing.plannedDepartureMinute;
    // Resolve once for stability: raw intent ids may be legacy aliases.
    const resolvedDestination = intent === null || deps.network === null
      ? null
      : resolveTransitPlaceId(intent.targetPlaceId ?? '', deps.network, deps.aliases);
    const sameTrip = existing !== undefined &&
      intent !== null &&
      existing.status !== 'failed' &&
      existing.status !== 'cancelled' &&
      existing.sourceId === intent.sourceId &&
      resolvedDestination !== null &&
      existing.destinationPlaceId === resolvedDestination &&
      existing.desiredArrivalMinute === intent.earliestAt;
    // A due/departed trip is never rerolled. A stable commitment — including
    // an arrived record for the same intent — is kept as is.
    if (dueByTime || sameTrip) continue;

    if (intent === null || !isTravelIntent(intent)) {
      if (existing !== undefined && existing.status === 'planned') {
        trips[actorId] = { ...existing, status: 'cancelled' };
        cancelled.push(actorId);
      }
      continue;
    }

    const origin = places[actorId];
    if (origin === undefined) {
      const receipt: NpcFailureReceipt = {
        actorId,
        ...(intent.sourceKind === undefined ? {} : { sourceKind: intent.sourceKind }),
        ...(intent.sourceId === undefined ? {} : { sourceId: intent.sourceId }),
        reason: 'unknown_origin',
      };
      if (
        existing?.status !== 'failed' ||
        existing.failureReason !== 'unknown_origin' ||
        existing.sourceId !== intent.sourceId
      ) {
        trips[actorId] = failedRecord(actorId, intent, receipt.reason, '');
        failed.push(receipt);
      }
      continue;
    }

    const plannedTrip = deps.network === null
      ? { ok: false as const, reason: 'no_route' as const }
      : planNpcTrip({
        actorId,
        intent,
        originPlaceId: origin,
        nowMinute,
        network: deps.network,
        aliases: deps.aliases,
        ...(deps.service === undefined ? {} : { service: deps.service }),
      });
    if (!plannedTrip.ok) {
      if (plannedTrip.reason === 'already_there') {
        if (existing !== undefined && existing.status === 'planned') {
          trips[actorId] = { ...existing, status: 'cancelled' };
          cancelled.push(actorId);
        }
        continue;
      }
      const receipt: NpcFailureReceipt = {
        actorId,
        ...(intent.sourceKind === undefined ? {} : { sourceKind: intent.sourceKind }),
        ...(intent.sourceId === undefined ? {} : { sourceId: intent.sourceId }),
        reason: plannedTrip.reason,
      };
      if (
        existing?.status !== 'failed' ||
        existing.failureReason !== plannedTrip.reason ||
        existing.sourceId !== intent.sourceId
      ) {
        // Known origin is preserved: the actor never left, so physical
        // place truth survives the failure for the #45 handoff.
        trips[actorId] = failedRecord(actorId, intent, plannedTrip.reason, origin);
        failed.push(receipt);
      }
      continue;
    }
    trips[actorId] = plannedTrip.record;
    planned.push(actorId);
  }

  return { state: { trips, places }, planned, failed, cancelled };
}

function failedRecord(
  actorId: string,
  intent: CharacterIntent,
  reason: NpcTripFailureReason,
  originPlaceId: string,
): NpcTripRecord {
  return {
    trip: commitTravelPlan(actorId, {
      originPlaceId: '',
      destinationPlaceId: intent.targetPlaceId ?? '',
      departAtMinute: 0,
      arriveAtMinute: 0,
      legs: [],
      walkMinutes: 0,
      waitMinutes: 0,
      rideMinutes: 0,
      totalMinutes: 0,
      fare: 0,
      transferCount: 0,
      busLineIds: [],
    }, 0),
    intentKind: intent.kind,
    ...(intent.sourceKind === undefined ? {} : { sourceKind: intent.sourceKind }),
    ...(intent.sourceId === undefined ? {} : { sourceId: intent.sourceId }),
    originPlaceId,
    destinationPlaceId: intent.targetPlaceId ?? '',
    plannedDepartureMinute: 0,
    expectedArrivalMinute: 0,
    policy: 'fastest',
    status: 'failed',
    failureReason: reason,
  };
}

function cloneRecord(record: NpcTripRecord): NpcTripRecord {
  return {
    ...record,
    trip: {
      ...record.trip,
      plan: JSON.parse(JSON.stringify(record.trip.plan)) as NpcTripRecord['trip']['plan'],
    },
  };
}

export interface ProgressResult {
  state: NpcMobilityState;
  arrivals: NpcArrivalReceipt[];
  departed: string[];
}

/**
 * Progress every trip to the authoritative minute. Pure: transitions happen
 * exactly once (status flags persist), so repeated calls and reloads never
 * duplicate arrivals. Places update only on authoritative arrival.
 */
export function progressNpcTrips(state: NpcMobilityState, nowMinute: number): ProgressResult {
  const trips: Record<string, NpcTripRecord> = {};
  for (const [actorId, record] of Object.entries(state.trips)) {
    trips[actorId] = cloneRecord(record);
  }
  const places: Record<string, string> = { ...state.places };
  const arrivals: NpcArrivalReceipt[] = [];
  const departed: string[] = [];

  for (const [actorId, record] of Object.entries(trips)) {
    if (record.status === 'arrived' || record.status === 'failed' || record.status === 'cancelled') {
      continue;
    }
    if (record.status === 'planned' && nowMinute >= record.plannedDepartureMinute) {
      record.status = 'active';
      departed.push(actorId);
    }
    if (record.status !== 'active') continue;
    const resolved = travelStateAtMinute(record.trip, nowMinute);
    record.trip = { ...record.trip, ...resolved };
    if (resolved.status === 'arrived') {
      // Authoritative boundary from the committed itinerary — never the
      // outer tick endpoint — so jumps and steps record identical times.
      const boundary = Math.min(nowMinute, record.expectedArrivalMinute);
      record.status = 'arrived';
      record.completedAtMinute = boundary;
      places[actorId] = record.destinationPlaceId;
      arrivals.push({
        actorId,
        ...(record.sourceKind === undefined ? {} : { sourceKind: record.sourceKind }),
        ...(record.sourceId === undefined ? {} : { sourceId: record.sourceId }),
        originPlaceId: record.originPlaceId,
        destinationPlaceId: record.destinationPlaceId,
        departedAtMinute: record.plannedDepartureMinute,
        arrivedAtMinute: boundary,
        lateByMinutes: record.desiredArrivalMinute === undefined
          ? 0
          : Math.max(0, boundary - record.desiredArrivalMinute),
      });
    }
  }

  return { state: { trips, places }, arrivals, departed };
}

function legKindAt(record: NpcTripRecord, legIndex: number): TravelLeg['kind'] {
  return record.trip.plan.legs[Math.min(legIndex, Math.max(0, record.trip.plan.legs.length - 1))]?.kind ?? 'walk';
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

function cumulativeMinutes(segmentMinutes: number[]): number[] {
  const cumulated: number[] = [0];
  for (const minutes of segmentMinutes) {
    cumulated.push((cumulated[cumulated.length - 1] ?? 0) + minutes);
  }
  return cumulated;
}

interface BusRideIdentity {
  /** Terminus departure minute of the scheduled run (base-schedule authority). */
  runStart: number;
  /** Shared-track bounds as stop indices along the line. */
  lo: number;
  hi: number;
  /** Cumulative ride minutes from the line start to each stop index. */
  cum: number[];
}

/**
 * Identify the scheduled service run a bus leg actually rides, from the
 * authoritative line timetable (first-stop departures at
 * serviceStartMinute + k * headwayMinutes). The boarding time is the leg's
 * absolute window start, so commit lag resolves to the run truly caught.
 * Returns null when the leg matches no scheduled run — including upstream
 * legs, which the planner never quotes — so unmatched rides never
 * co-locate. Base schedule only (no disruption state exists yet).
 */
function busRideIdentity(
  network: TransitNetwork,
  lineId: string,
  fromStopId: string,
  toStopId: string,
  boardMinute: number,
): BusRideIdentity | null {
  const line = network.lines.get(lineId);
  if (!line) return null;
  const fromIndex = line.stopIds.indexOf(fromStopId);
  const toIndex = line.stopIds.indexOf(toStopId);
  if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return null;
  if (!Number.isFinite(boardMinute)) return null;
  const cum = cumulativeMinutes(line.segmentMinutes);
  const total = cum[cum.length - 1] ?? 0;
  const headway = line.headwayMinutes;
  if (!Number.isInteger(headway) || headway <= 0) return null;
  const runStart = boardMinute - (cum[fromIndex] ?? 0);
  if (!Number.isInteger(runStart) || runStart < line.serviceStartMinute) return null;
  if ((runStart - line.serviceStartMinute) % headway !== 0) return null;
  if (runStart + total > line.serviceEndMinute) return null;
  return { runStart, lo: fromIndex, hi: toIndex, cum };
}

/**
 * Factual co-location facts for later consumers (#47 decides surfacing).
 * Pure query over committed trip intervals: shared stop waits, same-run
 * shared segment-time rides, shared arrived destinations. Never invents
 * encounters.
 */
export function findNpcCoLocation(
  trips: Record<string, NpcTripRecord>,
  network: TransitNetwork,
): NpcCoLocation[] {
  const facts: NpcCoLocation[] = [];
  const live = Object.entries(trips).filter(
    ([, record]) => record.status === 'planned' || record.status === 'active',
  );
  const arrived = Object.entries(trips).filter(([, record]) => record.status === 'arrived');

  const windowsOf = (record: NpcTripRecord): Array<{ startMinute: number; endMinute: number }> =>
    activeTravelLegWindows(record.trip);

  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const [actorA, recordA] = live[i] as [string, NpcTripRecord];
      const [actorB, recordB] = live[j] as [string, NpcTripRecord];
      const actors: [string, string] = actorA < actorB ? [actorA, actorB] : [actorB, actorA];
      const windowsA = windowsOf(recordA);
      const windowsB = windowsOf(recordB);
      const legsA = recordA.trip.plan.legs;
      const legsB = recordB.trip.plan.legs;
      for (let a = 0; a < legsA.length; a++) {
        for (let b = 0; b < legsB.length; b++) {
          const legA = legsA[a]!;
          const legB = legsB[b]!;
          const window = overlap(
            windowsA[a]?.startMinute ?? 0,
            windowsA[a]?.endMinute ?? 0,
            windowsB[b]?.startMinute ?? 0,
            windowsB[b]?.endMinute ?? 0,
          );
          if (!window) continue;
          if (legA.kind === 'wait' && legB.kind === 'wait' && legA.stopId === legB.stopId) {
            facts.push({
              kind: 'stop_wait',
              actors,
              stopId: legA.stopId,
              overlapStartMinute: window.start,
              overlapEndMinute: window.end,
            });
          } else if (legA.kind === 'bus' && legB.kind === 'bus' && legA.lineId === legB.lineId) {
            // Same run, same shared segment-time — or no fact. Whole-window
            // plus whole-range overlap alone would falsely co-locate actors
            // on different runs sharing only part of the route.
            const rideA = busRideIdentity(
              network, legA.lineId, legA.fromStopId, legA.toStopId,
              windowsA[a]?.startMinute ?? NaN,
            );
            const rideB = busRideIdentity(
              network, legB.lineId, legB.fromStopId, legB.toStopId,
              windowsB[b]?.startMinute ?? NaN,
            );
            if (rideA !== null && rideB !== null && rideA.runStart === rideB.runStart) {
              const lo = Math.max(rideA.lo, rideB.lo);
              const hi = Math.min(rideA.hi, rideB.hi);
              if (lo < hi) {
                const start = Math.max(
                  rideA.runStart + (rideA.cum[lo] ?? 0),
                  rideB.runStart + (rideB.cum[lo] ?? 0),
                );
                const end = Math.min(
                  rideA.runStart + (rideA.cum[hi] ?? 0),
                  rideB.runStart + (rideB.cum[hi] ?? 0),
                );
                if (start < end && window.start < window.end) {
                  facts.push({
                    kind: 'bus_ride',
                    actors,
                    lineId: legA.lineId,
                    overlapStartMinute: start,
                    overlapEndMinute: end,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < arrived.length; i++) {
    for (let j = i + 1; j < arrived.length; j++) {
      const [actorA, recordA] = arrived[i] as [string, NpcTripRecord];
      const [actorB, recordB] = arrived[j] as [string, NpcTripRecord];
      if (recordA.destinationPlaceId !== recordB.destinationPlaceId) continue;
      const actors: [string, string] = actorA < actorB ? [actorA, actorB] : [actorB, actorA];
      facts.push({
        kind: 'destination',
        actors,
        placeId: recordA.destinationPlaceId,
        overlapStartMinute: Math.max(
          recordA.completedAtMinute ?? 0,
          recordB.completedAtMinute ?? 0,
        ),
      });
    }
  }

  facts.sort((a, b) =>
    a.overlapStartMinute - b.overlapStartMinute ||
    a.kind.localeCompare(b.kind) ||
    a.actors[0].localeCompare(b.actors[0]),
  );
  return facts;
}

/**
 * Authoritative place truth for #45 presence resolution. While a trip is
 * live the actor is NOT at either endpoint — callers must reject
 * contradictory physical presence from this answer.
 */
export function getNpcPlaceState(
  state: NpcMobilityState,
  actorId: string,
  atMinute: number,
): NpcPlaceQuery {
  const record = state.trips[actorId];
  if (!record) {
    const placeId = state.places[actorId];
    return placeId === undefined ? { status: 'unknown' } : { status: 'at_place', placeId };
  }
  if (record.status === 'failed') {
    return record.originPlaceId !== ''
      ? { status: 'at_place', placeId: record.originPlaceId }
      : { status: 'failed', failureReason: record.failureReason ?? 'no_route' };
  }
  if (record.status === 'cancelled') {
    return { status: 'at_place', placeId: record.originPlaceId };
  }
  if (record.status === 'arrived') {
    return { status: 'at_place', placeId: record.destinationPlaceId };
  }
  if (atMinute < record.plannedDepartureMinute) {
    return {
      status: 'planned',
      originPlaceId: record.originPlaceId,
      destinationPlaceId: record.destinationPlaceId,
      plannedDepartureMinute: record.plannedDepartureMinute,
    };
  }
  const resolved = tripStatusAt(record, atMinute);
  if (resolved.status === 'arrived') {
    return { status: 'at_place', placeId: record.destinationPlaceId };
  }
  return {
    status: 'in_transit',
    originPlaceId: record.originPlaceId,
    destinationPlaceId: record.destinationPlaceId,
    legIndex: resolved.legIndex,
    legKind: legKindAt(record, resolved.legIndex),
  };
}

/**
 * Hydrate persisted mobility with validation. Malformed entries are dropped;
 * a stored trip whose key does not match its own actorId is always dropped
 * so one actor can never inject travel under another identity.
 */
export function hydrateNpcMobility(data: unknown): NpcMobilityState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyNpcMobility();
  const raw = data as Record<string, unknown>;
  const trips: Record<string, NpcTripRecord> = {};
  const rawTrips = raw['trips'];
  if (rawTrips && typeof rawTrips === 'object' && !Array.isArray(rawTrips)) {
    for (const [actorId, rawRecord] of Object.entries(rawTrips as Record<string, unknown>)) {
      if (typeof actorId !== 'string' || actorId === '') continue;
      if (!rawRecord || typeof rawRecord !== 'object') continue;
      const entry = rawRecord as Record<string, unknown>;
      let trip: ActiveTravelState;
      try {
        trip = parseActiveTravel(entry['trip']);
      } catch {
        continue;
      }
      if (trip.actorId !== actorId) continue;
      const status = entry['status'];
      if (typeof status !== 'string' || !TRIP_STATUSES.has(status)) continue;
      const intentKind = entry['intentKind'];
      if (typeof intentKind !== 'string' || !INTENT_KINDS.has(intentKind)) continue;
      const originPlaceId = entry['originPlaceId'];
      const destinationPlaceId = entry['destinationPlaceId'];
      if (typeof originPlaceId !== 'string' || typeof destinationPlaceId !== 'string') continue;
      const plannedDepartureMinute = entry['plannedDepartureMinute'];
      const expectedArrivalMinute = entry['expectedArrivalMinute'];
      if (!Number.isFinite(plannedDepartureMinute) || !Number.isFinite(expectedArrivalMinute)) continue;
      const policy = entry['policy'];
      if (policy !== 'fastest' && policy !== 'cheapest' && policy !== 'walk_only' && policy !== 'prefer_bus') {
        continue;
      }
      const sourceKind = entry['sourceKind'];
      const sourceId = entry['sourceId'];
      const desiredArrivalMinute = entry['desiredArrivalMinute'];
      const failureReason = entry['failureReason'];
      const completedAtMinute = entry['completedAtMinute'];
      trips[actorId] = {
        trip,
        intentKind: intentKind as NpcTripRecord['intentKind'],
        ...(typeof sourceKind === 'string' ? { sourceKind: sourceKind as NpcTripRecord['sourceKind'] } : {}),
        ...(typeof sourceId === 'string' ? { sourceId } : {}),
        originPlaceId,
        destinationPlaceId,
        ...(typeof desiredArrivalMinute === 'number' && Number.isFinite(desiredArrivalMinute)
          ? { desiredArrivalMinute }
          : {}),
        plannedDepartureMinute: plannedDepartureMinute as number,
        expectedArrivalMinute: expectedArrivalMinute as number,
        policy,
        status: status as NpcTripStatus,
        ...(typeof failureReason === 'string' ? { failureReason: failureReason as NpcTripFailureReason } : {}),
        ...(typeof completedAtMinute === 'number' && Number.isFinite(completedAtMinute)
          ? { completedAtMinute }
          : {}),
      };
    }
  }
  const places: Record<string, string> = {};
  const rawPlaces = raw['places'];
  if (rawPlaces && typeof rawPlaces === 'object' && !Array.isArray(rawPlaces)) {
    for (const [actorId, placeId] of Object.entries(rawPlaces as Record<string, unknown>)) {
      if (typeof actorId === 'string' && actorId !== '' && typeof placeId === 'string' && placeId !== '') {
        places[actorId] = placeId;
      }
    }
  }
  return { trips, places };
}
