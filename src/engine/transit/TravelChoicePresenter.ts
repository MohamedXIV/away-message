// src/engine/transit/TravelChoicePresenter.ts
// Formats authoritative TransitNetwork and TravelPlanner quotes into human-readable,
// player-friendly navigation choices (#36). Never invents or mutates routing truth.

import { planTravel } from './TravelPlanner';
import type { TransitNetwork } from './TransitNetwork';
import type {
  PlaceId,
  TransitServiceState,
  TravelLeg,
  TravelPlan,
  TravelPlanFailure,
  TravelRequest,
} from './types';

export interface WalkChoicePresentation {
  available: boolean;
  minutes: number;
  fare: 0;
  summary: string;
  plan: TravelPlan | null;
  reason?: TravelPlanFailure;
}

export interface BusChoicePresentation {
  available: boolean;
  waitMinutes: number;
  rideMinutes: number;
  walkMinutes: number;
  totalMinutes: number;
  fare: number;
  transferCount: number;
  summary: string;
  itinerarySteps: string[];
  transferSummary: string;
  conditions: {
    isLastBus?: boolean;
    serviceDisrupted?: boolean;
    delayMinutes?: number;
    reducedService?: boolean;
    note?: string;
  };
  plan: TravelPlan | null;
  reason?: TravelPlanFailure | 'no_line';
}

export interface TravelChoicesPresentation {
  originPlaceId: PlaceId;
  destinationPlaceId: PlaceId;
  originPlaceName: string;
  destinationPlaceName: string;
  departAtMinute: number;
  walk: WalkChoicePresentation;
  bus: BusChoicePresentation;
}

export function formatItinerarySteps(network: TransitNetwork, plan: TravelPlan): string[] {
  const steps: string[] = [];
  let busLegCount = 0;

  for (const leg of plan.legs) {
    if (leg.kind === 'walk') {
      if (leg.toStopId) {
        const stopName = network.stops.get(leg.toStopId)?.name ?? leg.toStopId;
        steps.push(`Walk to ${stopName} (${leg.minutes} min)`);
      } else if (leg.toPlaceId) {
        const placeName = network.places.get(leg.toPlaceId)?.name ?? leg.toPlaceId;
        steps.push(`Walk to ${placeName} (${leg.minutes} min)`);
      }
    } else if (leg.kind === 'wait') {
      const lineName = network.lines.get(leg.lineId)?.name ?? leg.lineId;
      const stopName = network.stops.get(leg.stopId)?.name ?? leg.stopId;
      if (busLegCount > 0) {
        steps.push(`Transfer to ${lineName} at ${stopName} (wait ${leg.minutes} min)`);
      } else {
        steps.push(`Wait for ${lineName} at ${stopName} (${leg.minutes} min)`);
      }
    } else if (leg.kind === 'bus') {
      busLegCount++;
      const lineName = network.lines.get(leg.lineId)?.name ?? leg.lineId;
      const toStopName = network.stops.get(leg.toStopId)?.name ?? leg.toStopId;
      steps.push(`${lineName} to ${toStopName} (${leg.minutes} min ride)`);
    }
  }

  return steps;
}

export function formatTransferSummary(network: TransitNetwork, plan: TravelPlan): string {
  const parts: string[] = [];
  const busLegs = plan.legs.filter((leg): leg is Extract<TravelLeg, { kind: 'bus' }> => leg.kind === 'bus');

  if (busLegs.length === 0) {
    return 'Direct walk';
  }

  const firstWalk = plan.legs.find((leg) => leg.kind === 'walk' && leg.toStopId);
  if (firstWalk && firstWalk.kind === 'walk' && firstWalk.toStopId) {
    parts.push(`Walk to ${network.stops.get(firstWalk.toStopId)?.name ?? firstWalk.toStopId}`);
  }

  busLegs.forEach((busLeg, index) => {
    const lineName = network.lines.get(busLeg.lineId)?.name ?? busLeg.lineId;
    const toStopName = network.stops.get(busLeg.toStopId)?.name ?? busLeg.toStopId;
    if (index === 0) {
      parts.push(`${lineName} to ${toStopName}`);
    } else {
      parts.push(`transfer to ${lineName} → ${toStopName}`);
    }
  });

  const lastWalk = plan.legs.find((leg) => leg.kind === 'walk' && leg.toPlaceId && leg !== firstWalk);
  if (lastWalk && lastWalk.kind === 'walk' && lastWalk.toPlaceId) {
    parts.push(`walk to ${network.places.get(lastWalk.toPlaceId)?.name ?? lastWalk.toPlaceId}`);
  }

  return parts.join(' → ');
}

function checkIsLastBus(network: TransitNetwork, plan: TravelPlan, service?: TransitServiceState): boolean {
  for (const leg of plan.legs) {
    if (leg.kind !== 'bus') continue;
    const line = network.lines.get(leg.lineId);
    if (!line) continue;
    const headway = Math.max(1, line.headwayMinutes * Math.max(1, service?.headwayMultiplier[line.id] ?? 1));
    const nextPossibleBase = leg.boardAtMinute + headway;
    if (nextPossibleBase > line.serviceEndMinute) {
      return true;
    }
  }
  return false;
}

export function presentTravelChoices(
  network: TransitNetwork,
  request: TravelRequest,
): TravelChoicesPresentation {
  const originPlace = network.places.get(request.originPlaceId);
  const destinationPlace = network.places.get(request.destinationPlaceId);
  const originPlaceName = originPlace?.name ?? request.originPlaceId;
  const destinationPlaceName = destinationPlace?.name ?? request.destinationPlaceId;

  // 1. Resolve Walk Choice
  const walkResult = planTravel(network, { ...request, policy: 'walk_only' });
  let walkChoice: WalkChoicePresentation;

  if (walkResult.ok) {
    walkChoice = {
      available: true,
      minutes: walkResult.plan.totalMinutes,
      fare: 0,
      summary: `Walk — ${walkResult.plan.totalMinutes} min — free`,
      plan: walkResult.plan,
    };
  } else {
    walkChoice = {
      available: false,
      minutes: 0,
      fare: 0,
      summary: 'No direct walking route',
      plan: null,
      reason: walkResult.reason,
    };
  }

  // 2. Resolve Bus Choice
  const busResult = planTravel(network, { ...request, policy: 'fastest' });
  let busChoice: BusChoicePresentation;

  if (busResult.ok && busResult.plan.busLineIds.length > 0) {
    const plan = busResult.plan;
    const waitPart = plan.waitMinutes > 0 ? `${plan.waitMinutes} min wait + ` : '';
    const summary = `Bus — ${waitPart}${plan.rideMinutes} min ride — $${plan.fare}`;

    let maxDelay = 0;
    let reduced = false;
    for (const lineId of plan.busLineIds) {
      if (request.service?.lineDelayMinutes[lineId]) {
        maxDelay = Math.max(maxDelay, request.service.lineDelayMinutes[lineId]!);
      }
      if (request.service?.headwayMultiplier[lineId] && request.service.headwayMultiplier[lineId]! > 1) {
        reduced = true;
      }
    }

    const isLastBus = checkIsLastBus(network, plan, request.service);

    busChoice = {
      available: true,
      waitMinutes: plan.waitMinutes,
      rideMinutes: plan.rideMinutes,
      walkMinutes: plan.walkMinutes,
      totalMinutes: plan.totalMinutes,
      fare: plan.fare,
      transferCount: plan.transferCount,
      summary,
      itinerarySteps: formatItinerarySteps(network, plan),
      transferSummary: formatTransferSummary(network, plan),
      conditions: {
        ...(isLastBus ? { isLastBus: true, note: 'Last bus of the day' } : {}),
        ...(maxDelay > 0 ? { serviceDisrupted: true, delayMinutes: maxDelay } : {}),
        ...(reduced ? { reducedService: true } : {}),
      },
      plan,
    };
  } else if (busResult.ok && busResult.plan.busLineIds.length === 0) {
    busChoice = {
      available: false,
      waitMinutes: 0,
      rideMinutes: 0,
      walkMinutes: 0,
      totalMinutes: 0,
      fare: 0,
      transferCount: 0,
      summary: 'No bus line connects these places',
      itinerarySteps: [],
      transferSummary: '',
      conditions: {},
      plan: null,
      reason: 'no_line',
    };
  } else {
    const failureReason = !busResult.ok ? busResult.reason : 'no_route';
    let summary = 'No bus service available';
    if (failureReason === 'service_ended') {
      summary = 'Service ended for the night';
    } else if (failureReason === 'stop_closed') {
      summary = 'Transit stop is closed';
    } else if (failureReason === 'line_closed') {
      summary = 'Bus line is closed';
    }

    busChoice = {
      available: false,
      waitMinutes: 0,
      rideMinutes: 0,
      walkMinutes: 0,
      totalMinutes: 0,
      fare: 0,
      transferCount: 0,
      summary,
      itinerarySteps: [],
      transferSummary: '',
      conditions: {
        note: summary,
      },
      plan: null,
      reason: failureReason,
    };
  }

  return {
    originPlaceId: request.originPlaceId,
    destinationPlaceId: request.destinationPlaceId,
    originPlaceName,
    destinationPlaceName,
    departAtMinute: request.departAtMinute,
    walk: walkChoice,
    bus: busChoice,
  };
}
