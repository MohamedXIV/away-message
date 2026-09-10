// src/engine/transit/TravelPlanner.ts
// Deterministic earliest-arrival travel planner over a TransitNetwork (#35).
// Pure: same (network, origin, destination, departure, policy, service)
// always yields the same plan. Player and NPC callers share this contract.
// Slice 2 covers walking; bus/wait/transfer edges land in later slices.

import type { TransitNetwork } from './TransitNetwork';
import type {
  PlaceId,
  TransitServiceState,
  TransitStopId,
  TravelLeg,
  TravelPlan,
  TravelPlanResult,
  TravelPolicy,
  TravelRequest,
} from './types';
import { emptyTransitServiceState } from './types';

/** Rain walking multiplier, mirroring the legacy CityMap behavior. */
export const RAIN_WALK_MULTIPLIER = 1.25;

/** Flat fare per complete itinerary that uses any bus leg. */
export const BUS_ITINERARY_FARE = 2;

type NodeKey = string;

interface SearchNode {
  kind: 'place' | 'stop';
  id: string;
}

interface SearchState {
  node: SearchNode;
  arrivalMinute: number;
  legs: TravelLeg[];
  walkMinutes: number;
  waitMinutes: number;
  rideMinutes: number;
  fare: number;
  transferCount: number;
}

interface CandidatePlan extends SearchState {
  destinationPlaceId: PlaceId;
}

function nodeKey(node: SearchNode): NodeKey {
  return `${node.kind}:${node.id}`;
}

function walkMinutesFor(minutes: number, raining: boolean): number {
  return raining ? Math.ceil(minutes * RAIN_WALK_MULTIPLIER) : minutes;
}

/** Full deterministic ordering: arrival, fare, transfers, walk, lexical. */
function comparePlans(a: CandidatePlan, b: CandidatePlan): number {
  if (a.arrivalMinute !== b.arrivalMinute) return a.arrivalMinute - b.arrivalMinute;
  if (a.fare !== b.fare) return a.fare - b.fare;
  if (a.transferCount !== b.transferCount) return a.transferCount - b.transferCount;
  if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes;
  return JSON.stringify(a.legs).localeCompare(JSON.stringify(b.legs));
}

function toTravelPlan(
  originPlaceId: PlaceId,
  destinationPlaceId: PlaceId,
  departAtMinute: number,
  state: SearchState,
): TravelPlan {
  const busLegs = state.legs.filter((leg) => leg.kind === 'bus');
  const busLineIds: string[] = [];
  for (const leg of busLegs) {
    if (leg.kind === 'bus' && !busLineIds.includes(leg.lineId)) busLineIds.push(leg.lineId);
  }
  return {
    originPlaceId,
    destinationPlaceId,
    departAtMinute,
    arriveAtMinute: state.arrivalMinute,
    legs: state.legs,
    walkMinutes: state.walkMinutes,
    waitMinutes: state.waitMinutes,
    rideMinutes: state.rideMinutes,
    totalMinutes: state.arrivalMinute - departAtMinute,
    fare: busLegs.length > 0 ? BUS_ITINERARY_FARE : 0,
    transferCount: busLegs.length > 0 ? busLegs.length - 1 : 0,
    busLineIds,
  };
}

export function planTravel(network: TransitNetwork, request: TravelRequest): TravelPlanResult {
  const policy: TravelPolicy = request.policy ?? 'fastest';
  const service: TransitServiceState = request.service ?? emptyTransitServiceState();
  void service;

  if (!network.places.has(request.originPlaceId)) return { ok: false, reason: 'unknown_origin' };
  if (!network.places.has(request.destinationPlaceId)) return { ok: false, reason: 'unknown_destination' };

  if (request.originPlaceId === request.destinationPlaceId) {
    return {
      ok: true,
      plan: {
        originPlaceId: request.originPlaceId,
        destinationPlaceId: request.destinationPlaceId,
        departAtMinute: request.departAtMinute,
        arriveAtMinute: request.departAtMinute,
        legs: [],
        walkMinutes: 0,
        waitMinutes: 0,
        rideMinutes: 0,
        totalMinutes: 0,
        fare: 0,
        transferCount: 0,
        busLineIds: [],
      },
    };
  }

  if (policy === 'walk_only') {
    const plan = searchEarliestArrival(network, request, false);
    return plan ? { ok: true, plan } : { ok: false, reason: 'no_route' };
  }

  // fastest / cheapest / prefer_bus resolve onto bus-capable search in later
  // slices; walking-only search is the current fallback.
  const plan = searchEarliestArrival(network, request, true);
  return plan ? { ok: true, plan } : { ok: false, reason: 'no_route' };
}

/**
 * Dijkstra-style earliest-arrival search. `busAllowed` gates bus edges
 * (walk_only disables them). Returns the best plan by the deterministic
 * comparePlans ordering, or null when the destination is unreachable.
 */
function searchEarliestArrival(
  network: TransitNetwork,
  request: TravelRequest,
  busAllowed: boolean,
): TravelPlan | null {
  void busAllowed;
  const raining = request.raining ?? false;
  const start: SearchState = {
    node: { kind: 'place', id: request.originPlaceId },
    arrivalMinute: request.departAtMinute,
    legs: [],
    walkMinutes: 0,
    waitMinutes: 0,
    rideMinutes: 0,
    fare: 0,
    transferCount: 0,
  };

  const bestByNode = new Map<NodeKey, number>();
  const queue: SearchState[] = [start];
  const bestRef: { current: CandidatePlan | null } = { current: null };

  while (queue.length > 0) {
    queue.sort((a, b) => a.arrivalMinute - b.arrivalMinute);
    const current = queue.shift()!;
    const best = bestRef.current;
    if (best && current.arrivalMinute > best.arrivalMinute) break;

    const key = nodeKey(current.node);
    const seen = bestByNode.get(key);
    if (seen !== undefined && seen <= current.arrivalMinute) continue;
    bestByNode.set(key, current.arrivalMinute);

    if (current.node.kind === 'place' && current.node.id === request.destinationPlaceId) {
      const candidate: CandidatePlan = { ...current, destinationPlaceId: request.destinationPlaceId };
      if (!bestRef.current || comparePlans(candidate, bestRef.current) < 0) bestRef.current = candidate;
      continue;
    }

    if (current.node.kind === 'place') {
      for (const access of network.accessFromPlace(current.node.id)) {
        const minutes = walkMinutesFor(access.walkMinutes, raining);
        queue.push({
          node: { kind: 'stop', id: access.stopId },
          arrivalMinute: current.arrivalMinute + minutes,
          legs: [
            ...current.legs,
            { kind: 'walk', fromPlaceId: current.node.id, toStopId: access.stopId, minutes },
          ],
          walkMinutes: current.walkMinutes + minutes,
          waitMinutes: current.waitMinutes,
          rideMinutes: current.rideMinutes,
          fare: current.fare,
          transferCount: current.transferCount,
        });
      }
    } else {
      // Stop node: reverse access walks to nearby places. Bus boarding
      // edges land here in the bus slice.
      for (const place of network.places.values()) {
        const access = place.transitAccess.find((entry) => entry.stopId === current.node.id);
        if (!access) continue;
        const minutes = walkMinutesFor(access.walkMinutes, raining);
        queue.push({
          node: { kind: 'place', id: place.id },
          arrivalMinute: current.arrivalMinute + minutes,
          legs: [
            ...current.legs,
            { kind: 'walk', fromStopId: current.node.id as TransitStopId, toPlaceId: place.id, minutes },
          ],
          walkMinutes: current.walkMinutes + minutes,
          waitMinutes: current.waitMinutes,
          rideMinutes: current.rideMinutes,
          fare: current.fare,
          transferCount: current.transferCount,
        });
      }
    }
  }

  return bestRef.current
    ? toTravelPlan(request.originPlaceId, request.destinationPlaceId, request.departAtMinute, bestRef.current)
    : null;
}
