// src/engine/transit/ActiveTravel.ts
// Transit-local committed-trip contract (#35).
// Pure helpers over an immutable ActiveTravelState snapshot: committing a
// quoted plan, resolving leg position at a clock minute, cancelling, and
// JSON serialization semantics. Global save wiring is a later slice owned
// outside this lane (PR #63 seam) — this module never touches shared state.

import type { ActiveTravelState, TravelLeg, TravelPlan } from './types';

export function commitTravelPlan(
  actorId: string,
  plan: TravelPlan,
  committedAtMinute: number,
  purposeRef?: string,
): ActiveTravelState {
  return {
    actorId,
    plan: JSON.parse(JSON.stringify(plan)) as TravelPlan,
    committedAtMinute,
    currentLegIndex: 0,
    farePaid: plan.fare,
    status: 'active',
    ...(purposeRef === undefined ? {} : { purposeRef }),
  };
}

interface LegWindow {
  startMinute: number;
  endMinute: number;
}

/**
 * Absolute time windows per leg, shifted when commit lags the quote.
 * Exported for read-only consumers (e.g. NPC co-location facts); the
 * position resolver below remains the single progression authority.
 */
export function activeTravelLegWindows(state: ActiveTravelState): LegWindow[] {
  const shift = state.committedAtMinute - state.plan.departAtMinute;
  const windows: LegWindow[] = [];
  let cursor = state.committedAtMinute;
  for (const leg of state.plan.legs) {
    const window = legWindow(leg, cursor, shift);
    windows.push(window);
    cursor = window.endMinute;
  }
  return windows;
}

function legWindow(leg: TravelLeg, cursor: number, shift: number): LegWindow {
  if (leg.kind === 'walk') {
    return { startMinute: cursor, endMinute: cursor + leg.minutes };
  }
  if (leg.kind === 'wait') {
    return { startMinute: cursor, endMinute: Math.max(cursor, leg.boardAtMinute + shift) };
  }
  return {
    startMinute: Math.max(cursor, leg.boardAtMinute + shift),
    endMinute: Math.max(cursor, leg.alightAtMinute + shift),
  };
}

/**
 * Resolves trip position at a clock minute without mutating the state.
 * Before commit time the trip is active at leg 0; past the final leg it
 * has arrived. Cancelled trips stay cancelled.
 */
export function travelStateAtMinute(
  state: ActiveTravelState,
  minute: number,
): Pick<ActiveTravelState, 'status' | 'currentLegIndex'> {
  if (state.status === 'cancelled') return { status: 'cancelled', currentLegIndex: state.currentLegIndex };
  if (state.plan.legs.length === 0 || minute < state.committedAtMinute) {
    return { status: 'active', currentLegIndex: 0 };
  }
  const windows = activeTravelLegWindows(state);
  for (let index = 0; index < windows.length; index++) {
    if (minute < windows[index]!.endMinute) {
      return { status: 'active', currentLegIndex: index };
    }
  }
  return { status: 'arrived', currentLegIndex: Math.max(0, windows.length - 1) };
}

export function cancelTravel(state: ActiveTravelState): ActiveTravelState {
  return { ...state, status: 'cancelled' };
}

export function serializeActiveTravel(state: ActiveTravelState): string {
  return JSON.stringify(state);
}

/** Validates an unknown decoded value back into an ActiveTravelState. */
export function parseActiveTravel(data: unknown): ActiveTravelState {
  const fail = (): never => {
    throw new Error('ActiveTravelState: decoded value is not a valid trip snapshot.');
  };
  if (!data || typeof data !== 'object') fail();
  const record = data as Record<string, unknown>;
  if (typeof record['actorId'] !== 'string') fail();
  if (!record['plan'] || typeof record['plan'] !== 'object') fail();
  if (!Number.isInteger(record['committedAtMinute'])) fail();
  if (!Number.isInteger(record['currentLegIndex'])) fail();
  if (typeof record['farePaid'] !== 'number') fail();
  if (record['status'] !== 'active' && record['status'] !== 'arrived' && record['status'] !== 'cancelled') fail();
  const plan = record['plan'] as Record<string, unknown>;
  if (!Array.isArray(plan['legs'])) fail();
  return {
    actorId: record['actorId'] as string,
    plan: JSON.parse(JSON.stringify(plan)) as TravelPlan,
    committedAtMinute: record['committedAtMinute'] as number,
    currentLegIndex: record['currentLegIndex'] as number,
    farePaid: record['farePaid'] as number,
    status: record['status'] as ActiveTravelState['status'],
    ...(typeof record['purposeRef'] === 'string' ? { purposeRef: record['purposeRef'] } : {}),
  };
}
