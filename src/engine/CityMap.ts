// src/engine/CityMap.ts
// P7 Oakhaven city map — pure graph of places + travel rules.
// Nodes: motel room (home), lobby, food cart, cafe, diner, canal, laundry.
// Travel is walk (free, slow, rain ×1.25, encounters) or bus ($2, ~half time).
// No state, no AI: the engine owns player.location and calls these helpers.

export type CityNodeId = 'home' | 'lobby' | 'cart' | 'cafe' | 'diner' | 'canal' | 'laundry';

export interface CityNode {
  id: CityNodeId;
  name: string;
  blurb: string;
  /** SVG schematic position (0..100 viewBox space). */
  x: number;
  y: number;
  icon: string;
  /** Headline-activity hours for display ([start, end), absent = always). */
  hours?: [number, number];
  /** Who you might find there (static flavor, matches real schedules). */
  hint: string;
}

export const CITY_NODES: Record<CityNodeId, CityNode> = {
  home: { id: 'home', name: 'Room 104', blurb: 'Your motel room. Bed, kettle, humming PC.', x: 50, y: 78, icon: '🛏️', hint: 'You live here.' },
  lobby: { id: 'lobby', name: 'Motel Lobby', blurb: 'Henderson’s front desk. Keys, ledgers, notices.', x: 50, y: 62, icon: '🛎️', hours: [8, 20], hint: 'Henderson holds court 8–20.' },
  cart: { id: 'cart', name: 'Food Cart', blurb: 'Ryan’s corner stand. Tacos, rush hours, overtime.', x: 22, y: 45, icon: '🚚', hours: [9, 23], hint: 'Ryan grills days, rush at night.' },
  cafe: { id: 'cafe', name: 'Starlight Café', blurb: 'Warm coffee across town. Maya’s orbit.', x: 78, y: 40, icon: '☕', hours: [8, 23], hint: 'Maya drifts through most days.' },
  diner: { id: 'diner', name: '4th St Diner', blurb: 'Blue plates and bottomless coffee. Maya works 11–22.', x: 70, y: 62, icon: '🍽️', hours: [11, 22], hint: 'Maya on shift 11–22.' },
  canal: { id: 'canal', name: 'Canal Walk', blurb: 'Water, wires and hum. Nora walks here late.', x: 30, y: 22, icon: '🌊', hint: 'Nora walks here after 22:00.' },
  laundry: { id: 'laundry', name: 'Suds & Spin', blurb: 'Warm dryers and the bulletin board of town gossip.', x: 50, y: 38, icon: '🧺', hours: [7, 23], hint: 'Gossip never closes. Almost.' },
};

/** Display-hours check (same wrap logic as place hours). */
export function isNodeOpen(node: CityNode, hour: number): boolean {
  if (!node.hours) return true;
  const [start, end] = node.hours;
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (start <= end) return h >= start && h < end;
  return h >= start || h < end;
}

export const CITY_NODE_IDS = Object.keys(CITY_NODES) as CityNodeId[];

export function isCityNodeId(value: unknown): value is CityNodeId {
  return typeof value === 'string' && (value as string) in CITY_NODES;
}

interface Edge {
  a: CityNodeId;
  b: CityNodeId;
  /** Walking minutes one-way. */
  walkMin: number;
  /** Bus available on this edge (half time, min 5, $2 flat per trip leg). */
  bus: boolean;
}

/** Street graph — home/lobby is the hub; cross-links keep trips sane. */
const EDGES: Edge[] = [  { a: 'home', b: 'lobby', walkMin: 2, bus: false },
  { a: 'lobby', b: 'cart', walkMin: 13, bus: false },
  { a: 'lobby', b: 'cafe', walkMin: 15, bus: true },
  { a: 'lobby', b: 'diner', walkMin: 18, bus: true },
  { a: 'lobby', b: 'canal', walkMin: 8, bus: false },
  { a: 'lobby', b: 'laundry', walkMin: 10, bus: false },
  { a: 'diner', b: 'cafe', walkMin: 10, bus: true },
  { a: 'cart', b: 'canal', walkMin: 8, bus: false },
  { a: 'canal', b: 'laundry', walkMin: 14, bus: false },
  { a: 'cart', b: 'diner', walkMin: 16, bus: true },
];

export type TravelMode = 'walk' | 'bus';
export const BUS_FARE = 2;

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

/** All street segments for map rendering (a/b node ids). */
export function streetSegments(): Array<{ a: CityNodeId; b: CityNodeId; bus: boolean }> {
  return EDGES.map((e) => ({ a: e.a, b: e.b, bus: e.bus }));
}

export function neighborsOf(node: CityNodeId): Array<{ to: CityNodeId; edge: Edge }> {
  const out: Array<{ to: CityNodeId; edge: Edge }> = [];
  for (const edge of EDGES) {
    if (edge.a === node) out.push({ to: edge.b, edge });
    else if (edge.b === node) out.push({ to: edge.a, edge });
  }
  return out;
}

/** Shortest walk path (Dijkstra, 7 nodes — trivially cheap). Returns node list incl. endpoints. */
export function shortestPath(from: CityNodeId, to: CityNodeId): CityNodeId[] {
  if (from === to) return [from];
  const dist = new Map<CityNodeId, number>();
  const prev = new Map<CityNodeId, CityNodeId | null>();
  const done = new Set<CityNodeId>();
  for (const id of CITY_NODE_IDS) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(from, 0);
  for (;;) {
    let current: CityNodeId | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === null || current === to) break;
    done.add(current);
    for (const { to: next, edge } of neighborsOf(current)) {
      const alt = (dist.get(current) ?? Infinity) + edge.walkMin;
      if (alt < (dist.get(next) ?? Infinity)) {
        dist.set(next, alt);
        prev.set(next, current);
      }
    }
  }
  const path: CityNodeId[] = [];
  let cursor: CityNodeId | null = to;
  while (cursor !== null) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  if (path[0] !== from) return [from, to];
  return path;
}

export interface TravelQuote {
  from: CityNodeId;
  to: CityNodeId;
  mode: TravelMode;
  path: CityNodeId[];
  /** One-way minutes actually charged. */
  minutes: number;
  cost: number;
  busUsed: boolean;
}

/**
 * Quote a one-way trip. Walk = shortest path (+25% in rain), bus = half time
 * (min 5) + $2 flat — but only when EVERY leg of the path runs a bus line.
 */
export function quoteTravel(from: CityNodeId, to: CityNodeId, mode: TravelMode, raining: boolean): TravelQuote {
  const path = shortestPath(from, to);
  let walkMin = 0;
  let busOk = path.length > 1;
  for (let i = 0; i < path.length - 1; i++) {
    const leg = EDGES.find(
      (e) => (e.a === path[i] && e.b === path[i + 1]) || (e.b === path[i] && e.a === path[i + 1])
    );
    walkMin += leg ? leg.walkMin : 15;
    if (!leg || !leg.bus) busOk = false;
  }
  if (from === to) return { from, to, mode: 'walk', path, minutes: 0, cost: 0, busUsed: false };
  if (mode === 'bus' && busOk) {
    return { from, to, mode: 'bus', path, minutes: Math.max(5, Math.round(walkMin / 2)), cost: BUS_FARE, busUsed: true };
  }
  // Walk (or bus requested where lines don't run → feet it is)
  const minutes = raining ? Math.ceil(walkMin * 1.25) : walkMin;
  return { from, to, mode: 'walk', path, minutes, cost: 0, busUsed: false };
}

/** Walk energy cost: 1 per 15 min, lenient. */
export function walkEnergyCost(minutes: number): number {
  return Math.floor(Math.max(0, minutes) / 15);
}

// ==========================================
// STREET ENCOUNTERS (one roll per trip leg-group, deterministic)
// ==========================================

export interface StreetEncounter {
  kind: 'coins' | 'greeting' | 'soaked' | 'quiet';
  text: string;
  cashDelta: number;
  energyDelta: number;
  familiarityBuddyId?: string;
}

export interface EncounterCandidate {
  id: string;
  name: string;
}

const QUIET_LINES = [
  'An uneventful walk. The city minds its own business.',
  'You walk. A dog judges you briefly, then moves on.',
  'Streetlights, distant traffic, your own footsteps. Fine.',
];

/**
 * One encounter per trip (not per leg — capped by design).Coins for the
 * observant, greetings that warm a random visible buddy, rain that soaks.
 */
export function rollStreetEncounter(
  from: CityNodeId,
  to: CityNodeId,
  day: number,
  raining: boolean,
  candidates: EncounterCandidate[]
): StreetEncounter | null {
  if (from === to) return null;
  const roll = hashText(`street:${from}:${to}:${day}`) % 100;
  if (roll >= 40) {
    return { kind: 'quiet', text: QUIET_LINES[hashText(`q:${from}:${to}:${day}`) % QUIET_LINES.length]!, cashDelta: 0, energyDelta: 0 };
  }
  if (raining && roll < 12) {
    return { kind: 'soaked', text: 'No umbrella, no mercy — you arrive soaked. (-5 energy)', cashDelta: 0, energyDelta: -5 };
  }
  if (roll < 22 && candidates.length > 0) {
    const buddy = candidates[hashText(`who:${from}:${to}:${day}`) % candidates.length]!;
    return {
      kind: 'greeting', text: `You bump into someone who knows ${buddy.name} — small talk, warm feelings all around.`,
      cashDelta: 0, energyDelta: 0, familiarityBuddyId: buddy.id,
    };
  }
  const coins = 1 + (hashText(`coins:${from}:${to}:${day}`) % 5);
  return { kind: 'coins', text: `Glint on the pavement — $${coins}.00 in dropped change. Finders keepers.`, cashDelta: coins, energyDelta: 0 };
}
