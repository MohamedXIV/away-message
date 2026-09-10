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
  TravelPlanFailure,
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

  const busPlan = searchEarliestArrival(network, request, true);

  if (policy === 'fastest') {
    return busPlan ? { ok: true, plan: busPlan } : { ok: false, reason: classifyNoPlan(network, request, service) };
  }

  if (policy === 'cheapest') {
    // Zero-fare walking wins when it reaches the destination at all.
    const walkPlan = searchEarliestArrival(network, request, false);
    if (walkPlan) return { ok: true, plan: walkPlan };
    return busPlan ? { ok: true, plan: busPlan } : { ok: false, reason: classifyNoPlan(network, request, service) };
  }

  // prefer_bus: take the bus unless walking arrives at least 15 minutes sooner.
  const walkPlan = searchEarliestArrival(network, request, false);
  if (busPlan && walkPlan) {
    return { ok: true, plan: walkPlan.arriveAtMinute <= busPlan.arriveAtMinute - 15 ? walkPlan : busPlan };
  }
  const fallback = busPlan ?? walkPlan;
  return fallback
    ? { ok: true, plan: fallback }
    : { ok: false, reason: classifyNoPlan(network, request, service) };
}

/**
 * Failure classification when no plan exists. service_ended applies when bus
 * travel is allowed and no boarding remains anywhere after departure while
 * the network runs service at all; stop/line closure reasons land with the
 * service-modifier slice.
 */
function classifyNoPlan(
  network: TransitNetwork,
  request: TravelRequest,
  service: TransitServiceState,
): TravelPlanFailure {
  if (network.lines.size > 0 && !anyBoardingAtOrAfter(network, request.departAtMinute, service)) {
    return 'service_ended';
  }
  return 'no_route';
}

/** True when any line offers any boarding at or after the given minute. */
function anyBoardingAtOrAfter(
  network: TransitNetwork,
  minute: number,
  service: TransitServiceState,
): boolean {
  for (const line of network.lines.values()) {
    if (service.closedLineIds.includes(line.id)) continue;
    const delay = service.lineDelayMinutes[line.id] ?? 0;
    const headway = Math.max(1, line.headwayMinutes * Math.max(1, service.headwayMultiplier[line.id] ?? 1));
    const cumulated = cumulativeSegments(line.segmentMinutes);
    const total = cumulated[cumulated.length - 1] ?? 0;
    for (let base = line.serviceStartMinute; base + total <= line.serviceEndMinute; base += headway) {
      for (let index = 0; index < line.stopIds.length; index++) {
        if (service.closedStopIds.includes(line.stopIds[index]!)) continue;
        if (base + delay + cumulated[index]! >= minute) return true;
      }
    }
  }
  return false;
}

/** Cumulative ride minutes from the first stop to each stop index. */
function cumulativeSegments(segmentMinutes: number[]): number[] {
  const cumulated: number[] = [0];
  for (const minutes of segmentMinutes) cumulated.push(cumulated[cumulated.length - 1]! + minutes);
  return cumulated;
}

interface Boarding {
  boardAtMinute: number;
  baseDeparture: number;
}

function nextBoarding(
  line: { serviceStartMinute: number; serviceEndMinute: number; headwayMinutes: number; segmentMinutes: number[] },
  fromIndex: number,
  earliestMinute: number,
  delayMinutes: number,
  headwayMultiplier: number,
): Boarding | null {
  const cumulated = cumulativeSegments(line.segmentMinutes);
  const total = cumulated[cumulated.length - 1] ?? 0;
  const headway = Math.max(1, line.headwayMinutes * Math.max(1, headwayMultiplier));
  const maxIterations = Math.floor((line.serviceEndMinute - line.serviceStartMinute) / headway) + 2;
  for (let k = 0; k <= maxIterations; k++) {
    const base = line.serviceStartMinute + k * headway;
    if (base + total > line.serviceEndMinute) break;
    const boardAt = base + delayMinutes + cumulated[fromIndex]!;
    if (boardAt >= earliestMinute) return { boardAtMinute: boardAt, baseDeparture: base };
  }
  return null;
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
  const raining = request.raining ?? false;
  const service: TransitServiceState = request.service ?? emptyTransitServiceState();
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

    // Prune only states that cannot improve a completion: same node with
    // the same bus/fare history and no earlier arrival. Later arrivals with
    // identical history are dominated because all edge costs are non-negative.
    const busLegsSoFar = current.legs.filter((leg) => leg.kind === 'bus').length;
    const key = `${nodeKey(current.node)}|bus:${busLegsSoFar}|fare:${current.fare}`;
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
      if (busAllowed) {
        expandBusBoardings(network, service, queue, current);
      }
      // Stop node: reverse access walks to nearby places.
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

/**
 * Bus boarding edges from a stop state: for every line serving the stop in
 * the forward direction, board the next valid run and offer alighting at
 * every downstream open stop. Closed lines/stops contribute no edges.
 */
function expandBusBoardings(
  network: TransitNetwork,
  service: TransitServiceState,
  queue: SearchState[],
  current: SearchState,
): void {
  if (current.node.kind !== 'stop') return;
  const fromStopId = current.node.id;
  if (service.closedStopIds.includes(fromStopId)) return;
  for (const { lineId, stopIndex } of network.linesAtStop(fromStopId)) {
    if (service.closedLineIds.includes(lineId)) continue;
    const line = network.lines.get(lineId);
    if (!line || stopIndex >= line.stopIds.length - 1) continue;
    const delay = service.lineDelayMinutes[lineId] ?? 0;
    const multiplier = service.headwayMultiplier[lineId] ?? 1;
    const boarding = nextBoarding(line, stopIndex, current.arrivalMinute, delay, multiplier);
    if (!boarding) continue;
    const cumulated = cumulativeSegments(line.segmentMinutes);
    const wait = boarding.boardAtMinute - current.arrivalMinute;
    for (let j = stopIndex + 1; j < line.stopIds.length; j++) {
      const toStopId = line.stopIds[j]!;
      if (service.closedStopIds.includes(toStopId)) continue;
      const ride = cumulated[j]! - cumulated[stopIndex]!;
      const legs: TravelLeg[] = [...current.legs];
      if (wait > 0) {
        legs.push({ kind: 'wait', stopId: fromStopId, lineId, minutes: wait, boardAtMinute: boarding.boardAtMinute });
      }
      const alightAtMinute = boarding.boardAtMinute + ride;
      legs.push({
        kind: 'bus',
        lineId,
        fromStopId,
        toStopId,
        boardAtMinute: boarding.boardAtMinute,
        alightAtMinute,
        minutes: ride,
      });
      queue.push({
        node: { kind: 'stop', id: toStopId },
        arrivalMinute: alightAtMinute,
        legs,
        walkMinutes: current.walkMinutes,
        waitMinutes: current.waitMinutes + wait,
        rideMinutes: current.rideMinutes + ride,
        fare: current.fare,
        transferCount: current.transferCount,
      });
    }
  }
}
