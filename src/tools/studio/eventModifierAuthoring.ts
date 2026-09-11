// src/tools/studio/eventModifierAuthoring.ts
// Content Studio helpers for world-event modifier specs (#46). Pure row
// builders with the same closed domain/kind vocabulary the engine enforces,
// so the Studio can never author an effect the runtime cannot type.

import {
  WORLD_MODIFIER_DOMAINS,
  WORLD_MODIFIER_KINDS,
  WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES,
  WORLD_MODIFIER_MAX_DURATION_MINUTES,
  type WorldModifierDomain,
} from '../../engine/WorldModifiers';

export function listModifierDomains(): WorldModifierDomain[] {
  return [...WORLD_MODIFIER_DOMAINS];
}

export function listModifierKinds(domain: string): string[] {
  if (!(WORLD_MODIFIER_DOMAINS as readonly string[]).includes(domain)) return [];
  return [...WORLD_MODIFIER_KINDS[domain as WorldModifierDomain]];
}

export function buildEventModifierRow(
  eventId: string,
  domain: string,
  kind: string,
  durationMinutes: number,
  targetIds: readonly string[],
  value: string,
) {
  if (!/^[a-z0-9_]+$/.test(eventId)) {
    throw new Error(`Event id '${eventId}' must be snake_case.`);
  }
  if (!(WORLD_MODIFIER_DOMAINS as readonly string[]).includes(domain)) {
    throw new Error(
      `Unknown modifier domain '${domain}' (expected ${(WORLD_MODIFIER_DOMAINS as readonly string[]).join(', ')}).`
    );
  }
  const kinds = WORLD_MODIFIER_KINDS[domain as WorldModifierDomain];
  if (!kinds.includes(kind)) {
    throw new Error(`Unknown kind '${kind}' for domain '${domain}' (expected ${kinds.join(', ')}).`);
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > WORLD_MODIFIER_MAX_DURATION_MINUTES) {
    throw new Error(`durationMinutes must be an int 0..${WORLD_MODIFIER_MAX_DURATION_MINUTES}.`);
  }
  if (targetIds.length > 16) throw new Error('At most 16 target ids.');
  for (const target of targetIds) {
    if (typeof target !== 'string' || !target) throw new Error('Target ids must be non-empty strings.');
  }
  if (value.length > 80) throw new Error('value must be at most 80 chars.');
  if (domain === 'delivery' && kind === 'courier_backlog' && value.trim() !== '') {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || Math.round(minutes) < 0 || Math.round(minutes) > WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES) {
      throw new Error(`courier_backlog value must be empty or 0..${WORLD_MODIFIER_MAX_DELIVERY_EXTRA_MINUTES} minutes.`);
    }
  }

  return {
    eventId,
    domain,
    kind,
    durationMinutes,
    targetIds: JSON.stringify([...targetIds]),
    value,
  };
}
