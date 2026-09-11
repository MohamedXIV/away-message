// src/engine/transit/types.ts
// Renderer-neutral transit domain contracts (#35).
// The network is adapted from generated #51 content definitions; the planner
// consumes only these contracts plus caller inputs (origin, destination,
// departure minute, policy, service state). No actor identity, no rendering,
// no persistence lives here.

import type {
  GeneratedBusLineDef,
  GeneratedDistrictDef,
  GeneratedPlaceDef,
  GeneratedTransitStopDef,
} from '../worldContent.generated';

export type DistrictId = string;
export type PlaceId = string;
export type TransitStopId = string;
export type BusLineId = string;

export interface TransitNetworkInput {
  districts: GeneratedDistrictDef[];
  places: GeneratedPlaceDef[];
  stops: GeneratedTransitStopDef[];
  lines: GeneratedBusLineDef[];
}

/** Bounded dynamic service modifiers. Simulation state, never content. */
export interface TransitServiceState {
  closedStopIds: TransitStopId[];
  closedLineIds: BusLineId[];
  lineDelayMinutes: Record<BusLineId, number>;
  headwayMultiplier: Record<BusLineId, number>;
}

export function emptyTransitServiceState(): TransitServiceState {
  return {
    closedStopIds: [],
    closedLineIds: [],
    lineDelayMinutes: {},
    headwayMultiplier: {},
  };
}

export type TravelLeg =
  | {
      kind: 'walk';
      fromPlaceId?: PlaceId;
      toPlaceId?: PlaceId;
      fromStopId?: TransitStopId;
      toStopId?: TransitStopId;
      minutes: number;
    }
  | {
      kind: 'wait';
      stopId: TransitStopId;
      lineId: BusLineId;
      minutes: number;
      boardAtMinute: number;
    }
  | {
      kind: 'bus';
      lineId: BusLineId;
      fromStopId: TransitStopId;
      toStopId: TransitStopId;
      boardAtMinute: number;
      alightAtMinute: number;
      minutes: number;
    };

export interface TravelPlan {
  originPlaceId: PlaceId;
  destinationPlaceId: PlaceId;
  departAtMinute: number;
  arriveAtMinute: number;
  legs: TravelLeg[];
  walkMinutes: number;
  waitMinutes: number;
  rideMinutes: number;
  totalMinutes: number;
  fare: number;
  transferCount: number;
  busLineIds: BusLineId[];
}

export type TravelPolicy = 'fastest' | 'cheapest' | 'walk_only' | 'prefer_bus';

export type TravelPlanFailure =
  | 'unknown_origin'
  | 'unknown_destination'
  | 'no_route'
  | 'service_ended'
  | 'stop_closed'
  | 'line_closed';

export type TravelPlanResult = { ok: true; plan: TravelPlan } | { ok: false; reason: TravelPlanFailure };

export interface TravelRequest {
  originPlaceId: PlaceId;
  destinationPlaceId: PlaceId;
  departAtMinute: number;
  policy?: TravelPolicy;
  raining?: boolean;
  service?: TransitServiceState;
}

/** Transit-local active-trip contract (serialization only; global save wiring is a later slice). */
export interface ActiveTravelState {
  actorId: string;
  plan: TravelPlan;
  committedAtMinute: number;
  currentLegIndex: number;
  farePaid: number;
  status: 'active' | 'arrived' | 'cancelled';
  purposeRef?: string;
}
