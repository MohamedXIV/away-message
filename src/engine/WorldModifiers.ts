// src/engine/WorldModifiers.ts
// Bounded cross-system world-event modifiers (#46).
//
// WorldEventsEngine remains the ONLY world-event source of truth. Triggered
// events publish typed semantic effects through a pure projection; each
// owning domain decides how to apply them. This module owns the contract,
// the per-domain kind vocabulary (also consumed by content validation and
// Content Studio authoring), the caps, and the deterministic projector.
//
// It never mutates event, delivery, relationship, or any consumer state,
// never schedules anything, and never touches AI/providers.

export const WORLD_MODIFIER_DOMAINS = [
  'transit',
  'place',
  'staffing',
  'delivery',
  'network',
  'life',
] as const;

export type WorldModifierDomain = (typeof WORLD_MODIFIER_DOMAINS)[number];

/**
 * Closed semantic kind per domain. New kinds need an engine + content +
 * Studio update together — never an open string from content alone.
 */
export const WORLD_MODIFIER_KINDS: Record<WorldModifierDomain, readonly string[]> = {
  transit: ['delay'],
  place: ['reduced_desirability'],
  staffing: ['reduced_availability'],
  delivery: ['courier_backlog'],
  network: ['slow_mirrors'],
  life: ['festival_opportunity', 'upgrade_opportunity'],
};

/** Active-window cap for authored specs: 3 days of game time. */
export const WORLD_MODIFIER_MAX_DURATION_MINUTES = 4320;
/** Cap for a single delivery backlog extra (enforced again by DeliveryEngine). */
export const WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES = 720;
/** Cap for summed delivery extras applied to one order. */
export const WORLD_MODIFIER_MAX_DELIVERY_TOTAL_EXTRA_MINUTES = 720;
/** Default life-opportunity priority hint when a spec leaves value empty. */
export const WORLD_MODIFIER_DEFAULT_OPPORTUNITY_PRIORITY = 50;

/** Authored effect template (one content-store row → one generated spec). */
export interface WorldModifierSpec {
  id: string;
  eventId: string;
  domain: WorldModifierDomain;
  kind: string;
  /** Active-window length in game minutes from the trigger; 0 = trigger minute only. */
  durationMinutes: number;
  targetIds: string[];
  value?: number | string | boolean;
}

/**
 * Active semantic effect. Provenance only: it references its source event,
 * it never copies event mutable status or consumer outcomes.
 */
export interface WorldModifier {
  id: string;
  sourceEventId: string;
  domain: WorldModifierDomain;
  kind: string;
  startsAtMinute: number;
  endsAtMinute?: number;
  targetIds?: string[];
  value?: number | string | boolean;
}

export interface WorldModifierFilter {
  domain?: WorldModifierDomain;
  kind?: string;
  /** Only modifiers applying to this place/stop/line id (domain-wide ones always match). */
  targetId?: string;
}

export interface TriggeredEventRef {
  id: string;
  triggeredAtMinute?: number;
}

function isDomain(value: unknown): value is WorldModifierDomain {
  return typeof value === 'string' && (WORLD_MODIFIER_DOMAINS as readonly string[]).includes(value);
}

/** Raw generated-registry row shape (domain/kind unchecked at the boundary). */
export interface GeneratedModifierRow {
  id: string;
  eventId: string;
  domain: string;
  kind: string;
  durationMinutes: number;
  targetIds: string[];
  value?: number | string | boolean;
}

/**
 * Narrow generated rows to valid specs. Invalid rows (unknown domain/kind)
 * are dropped so a stale registry can never publish an untyped effect.
 */
export function toModifierSpecs(rows: readonly GeneratedModifierRow[]): WorldModifierSpec[] {
  const specs: WorldModifierSpec[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || typeof row.eventId !== 'string') continue;
    if (!isDomain(row.domain)) continue;
    if (!WORLD_MODIFIER_KINDS[row.domain].includes(row.kind)) continue;
    specs.push({
      id: row.id,
      eventId: row.eventId,
      domain: row.domain,
      kind: row.kind,
      durationMinutes: Number.isFinite(row.durationMinutes) ? Math.floor(row.durationMinutes) : 0,
      targetIds: Array.isArray(row.targetIds) ? row.targetIds.filter((t) => typeof t === 'string') : [],
      ...(row.value !== undefined ? { value: row.value } : {}),
    });
  }
  return specs;
}

/** Parse an authored string cell into a kind-appropriate bounded payload. */
export function parseModifierValue(
  domain: WorldModifierDomain,
  kind: string,
  raw: string,
): number | string | boolean | undefined {
  const text = (raw ?? '').trim();
  if (domain === 'delivery' && kind === 'courier_backlog') {
    if (text === '') return undefined;
    const minutes = Math.round(Number(text));
    if (!Number.isFinite(minutes)) return undefined;
    return Math.max(0, Math.min(WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES, minutes));
  }
  if (domain === 'life' && (kind === 'festival_opportunity' || kind === 'upgrade_opportunity')) {
    if (text === '') return WORLD_MODIFIER_DEFAULT_OPPORTUNITY_PRIORITY;
    const priority = Math.round(Number(text));
    if (!Number.isFinite(priority)) return undefined;
    return Math.max(0, Math.min(100, priority));
  }
  if (text === '') return undefined;
  return text.slice(0, 80);
}

/**
 * Pure projection: authored specs × canonical triggered events × time.
 * Deterministic, idempotent, allocation-only (fresh frozen copies per call).
 * Window is inclusive on both ends: active while startsAt <= at <= endsAt.
 */
export function projectActiveModifiers(
  specs: readonly WorldModifierSpec[],
  triggered: readonly TriggeredEventRef[],
  atMinute: number,
  filter?: WorldModifierFilter,
): WorldModifier[] {
  // Non-finite time can never satisfy a window guard explicitly: NaN
  // comparisons are false on both sides, so reject up front instead of
  // letting triggered effects slip through.
  if (!Number.isFinite(atMinute)) return [];
  const fired = new Map<string, number>();
  for (const event of triggered) {
    if (event && typeof event.id === 'string' && Number.isFinite(event.triggeredAtMinute)) {
      if (!fired.has(event.id)) fired.set(event.id, event.triggeredAtMinute as number);
    }
  }

  const out: WorldModifier[] = [];
  for (const spec of specs) {
    if (!spec || typeof spec.id !== 'string' || !isDomain(spec.domain)) continue;
    const kinds = WORLD_MODIFIER_KINDS[spec.domain];
    if (!kinds.includes(spec.kind)) continue;
    if (filter?.domain !== undefined && spec.domain !== filter.domain) continue;
    if (filter?.kind !== undefined && spec.kind !== filter.kind) continue;
    const startsAt = fired.get(spec.eventId);
    if (startsAt === undefined) continue;
    const duration = Number.isFinite(spec.durationMinutes)
      ? Math.max(0, Math.min(WORLD_MODIFIER_MAX_DURATION_MINUTES, Math.floor(spec.durationMinutes)))
      : 0;
    const endsAt = startsAt + duration;
    if (atMinute < startsAt || atMinute > endsAt) continue;
    const targets = Array.isArray(spec.targetIds) ? spec.targetIds.filter((t) => typeof t === 'string') : [];
    if (filter?.targetId !== undefined && targets.length > 0 && !targets.includes(filter.targetId)) continue;
    out.push(Object.freeze({
      id: spec.id,
      sourceEventId: spec.eventId,
      domain: spec.domain,
      kind: spec.kind,
      startsAtMinute: startsAt,
      ...(duration > 0 ? { endsAtMinute: endsAt } : {}),
      ...(targets.length > 0 ? { targetIds: [...targets] } : {}),
      ...(spec.value !== undefined ? { value: spec.value } : {}),
    }));
  }

  out.sort((a, b) => a.startsAtMinute - b.startsAtMinute || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Sum of active delivery backlog extras for one order, bounded by the global cap. */
export function totalDeliveryBacklogExtra(modifiers: readonly WorldModifier[]): number {
  let total = 0;
  for (const modifier of modifiers) {
    if (modifier.domain !== 'delivery' || modifier.kind !== 'courier_backlog') continue;
    if (typeof modifier.value === 'number' && Number.isFinite(modifier.value)) {
      total += Math.max(0, Math.min(WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES, Math.floor(modifier.value)));
    }
  }
  return Math.max(0, Math.min(WORLD_MODIFIER_MAX_DELIVERY_TOTAL_EXTRA_MINUTES, total));
}
