// src/world/phaser/environment/puddles.ts

export interface PuddleZoneDef {
  id: string;
  x: number; // 0..1 normalized or world px
  y: number;
  width: number;
  height: number;
  threshold: number; // Wetness accumulation 0..1 required before pooling starts
  fillRate: number; // Wetness increase per minute at rain intensity 1.0
  drainRate: number; // Wetness decrease per minute when rain stops
  maxCapacity: number; // Max pool fill depth 0..1
  rippleIntensity?: number;
}

export interface PuddleZoneState {
  id: string;
  wetness: number; // 0..1
  poolFill: number; // 0..maxCapacity
  hasRipples: boolean;
}

/**
 * Computes deterministic puddle accumulation, pooling threshold, fill cap,
 * draining, and ripple state for a single puddle zone.
 */
export function updatePuddleZone(
  def: PuddleZoneDef,
  state: PuddleZoneState,
  rainIntensity: number,
  deltaMinutes: number
): PuddleZoneState {
  const dt = Math.max(0, deltaMinutes);
  let nextWetness = state.wetness;

  if (rainIntensity > 0) {
    nextWetness = Math.min(1.0, state.wetness + def.fillRate * rainIntensity * dt);
  } else {
    nextWetness = Math.max(0.0, state.wetness - def.drainRate * dt);
  }

  let nextPoolFill = 0;
  if (nextWetness > def.threshold) {
    const denominator = Math.max(0.0001, 1.0 - def.threshold);
    const fraction = (nextWetness - def.threshold) / denominator;
    nextPoolFill = Math.min(def.maxCapacity, Math.max(0, fraction * def.maxCapacity));
  }

  const hasRipples = rainIntensity > 0 && nextPoolFill > 0;

  return {
    id: def.id,
    wetness: nextWetness,
    poolFill: nextPoolFill,
    hasRipples,
  };
}

/**
 * Batch update helper for multiple puddle zones.
 */
export function updatePuddleZones(
  defs: readonly PuddleZoneDef[],
  states: ReadonlyMap<string, PuddleZoneState>,
  rainIntensity: number,
  deltaMinutes: number
): Map<string, PuddleZoneState> {
  const result = new Map<string, PuddleZoneState>();

  for (const def of defs) {
    const currentState = states.get(def.id) ?? {
      id: def.id,
      wetness: 0,
      poolFill: 0,
      hasRipples: false,
    };
    result.set(def.id, updatePuddleZone(def, currentState, rainIntensity, deltaMinutes));
  }

  return result;
}
