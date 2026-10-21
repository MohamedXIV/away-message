import { buildCharacter, type BuiltCharacter } from '../CharacterEngine';
import type { SurfaceIdentityPromotion } from '../types';
import { resolveReachForMetVia } from './ReachPolicy';

function slugSurfaceHandle(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return /^[a-z]/.test(slug) ? slug : `pal_${slug}`;
}

/**
 * Build a new canonical actor from a surface identity. Reach comes from the
 * surface source, never from profile prose or visible page details. Identity
 * binding is resolved by owners before this builder is called.
 */
export function buildPromotedSurfaceCharacter(
  identity: SurfaceIdentityPromotion,
  fallbackDay = 1,
): BuiltCharacter {
  const username = String(identity.username ?? '').trim().slice(0, 40);
  const handle = String(identity.handle ?? '').trim().slice(0, 40) || username;
  if (!handle) throw new Error('A surface identity needs a username or handle.');
  const displayName = String(identity.displayName ?? '').trim().slice(0, 40)
    || handle.replace(/[_-]+/g, ' ');
  return buildCharacter({
    id: slugSurfaceHandle(handle),
    displayName,
    handle,
    ...(identity.archetype ? { archetype: identity.archetype } : {}),
    metVia: identity.source,
    createdDay: identity.createdDay ?? fallbackDay,
    status: 'acquaintance',
    reach: resolveReachForMetVia(identity.source),
  });
}
