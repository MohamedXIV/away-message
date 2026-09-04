// src/engine/OutingDirector.ts
// P6.3 city outings — pure rules for diner/canal/laundromat outings:
// specs, encounter odds, rumor builder. The engine orchestrates
// (cash/time/body/memories/messages); NOTHING here touches AI or state.

export type OutingId = 'diner_soup' | 'diner_platter' | 'diner_pie' | 'canal_walk' | 'laundromat';

export interface OutingSpec {
  label: string;
  cost: number;
  minutes: number;
  energyDelta: number; // + restore / - consume
  hungerDelta: number; // + hungrier / - fed
  healthDelta: number;
}

export const OUTINGS: Record<OutingId, OutingSpec> = {
  diner_soup: { label: 'diner soup', cost: 5, minutes: 40, energyDelta: 6, hungerDelta: -45, healthDelta: 0 },
  diner_platter: { label: 'diner platter', cost: 11, minutes: 60, energyDelta: 10, hungerDelta: -80, healthDelta: 2 },
  diner_pie: { label: 'diner pie', cost: 4, minutes: 25, energyDelta: 6, hungerDelta: -25, healthDelta: 0 },
  canal_walk: { label: 'canal walk', cost: 0, minutes: 45, energyDelta: 6, hungerDelta: 4, healthDelta: 2 },
  laundromat: { label: 'laundromat', cost: 4, minutes: 40, energyDelta: -3, hungerDelta: 3, healthDelta: 0 },
};

/** Minimum energy to head out (lenient — the displeased alternative is staying home). */
export const MIN_OUTING_ENERGY = 15;

export function isValidOutingId(value: unknown): value is OutingId {
  return typeof value === 'string' && (value as string) in OUTINGS;
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** Deterministic 0..99 roll for outings (stable across reloads). */
export function outingRoll(seed: string): number {
  return hashText(seed) % 100;
}

/** Maya works the diner 11:00–20:00; encounter odds per day-seed. */
export function mayaDinerEncounter(hour: number, day: number): boolean {
  if (hour < 11 || hour >= 20) return false;
  return outingRoll(`diner:${day}`) < 45;
}

/** Nora walks the canal late; rain makes her likelier. */
export function noraCanalEncounter(hour: number, day: number, raining: boolean): boolean {
  if (!(hour >= 22 || hour < 2)) return false;
  return outingRoll(`canal:${day}`) < (raining ? 65 : 50);
}

export interface RumorPair {
  aName: string;
  bName: string;
  affinity: number;
}

/**
 * Laundromat rumor: the tensest known pair first, else a world clipping,
 * else dryer folklore. Always returns something (the dryers demand it).
 */
export function buildLaundromatRumor(
  pairs: RumorPair[],
  worldTitles: string[],
  seed: string
): string {
  let worst: RumorPair | null = null;
  for (const pair of pairs) {
    if (!worst || pair.affinity < worst.affinity) worst = pair;
  }
  if (worst && worst.affinity <= -10) {
    return `word around the dryers: ${worst.aName} and ${worst.bName} aren't really talking anymore...`;
  }
  const titles = worldTitles.map((t) => t.trim()).filter((t) => t.length > 3);
  if (titles.length > 0) {
    const title = titles[hashText(`${seed}:rumor`) % titles.length]!;
    return `someone left a clipping about "${title}" on top of dryer #3.`;
  }
  return 'the dryers eat one sock per load. that is just science.';
}
