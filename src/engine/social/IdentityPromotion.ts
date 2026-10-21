import { buildCharacter, type BuiltCharacter } from '../CharacterEngine';
import { SEED_PROFILE_ALIASES } from '../MyPlaceEngine';
import type { BuddyCharacter, SurfaceIdentityPromotion } from '../types';
import { resolveReachForMetVia } from './ReachPolicy';

function identityTokens(identity: Pick<SurfaceIdentityPromotion,
  'username' | 'handle' | 'canonicalActorId' | 'knownAliases'>): Set<string> {
  const tokens = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== 'string') return;
    const token = value.trim().toLowerCase();
    if (token) tokens.add(token);
  };
  add(identity.username);
  add(identity.handle);
  add(identity.canonicalActorId);
  if (Array.isArray(identity.knownAliases)) {
    for (const alias of identity.knownAliases) add(alias);
  }
  return tokens;
}

/**
 * Resolve a surface profile/handle to an already canonical actor before any
 * promotion. MyPlace profile usernames may differ from the Pulse handle
 * (e.g. authored seed aliases), so both the authored profile binding and the
 * explicit aliases supplied by the caller count as identity evidence.
 */
export function findBoundSocialActor(
  actors: readonly BuddyCharacter[],
  identity: Pick<SurfaceIdentityPromotion,
    'username' | 'handle' | 'canonicalActorId' | 'knownAliases'>,
): BuddyCharacter | undefined {
  const tokens = identityTokens(identity);
  if (tokens.size === 0) return undefined;
  for (const actor of actors) {
    const profileBinding = SEED_PROFILE_ALIASES[actor.id] ?? SEED_PROFILE_ALIASES[actor.handle];
    const aliasCandidates = (actor.backstory?.candidates ?? []).map(candidate => candidate.handle);
    const aliases = [actor.id, actor.handle, profileBinding, ...aliasCandidates];
    if (aliases.some(alias => !!alias && tokens.has(alias.toLowerCase()))) return actor;
  }
  return undefined;
}

function slugSurfaceHandle(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return /^[a-z]/.test(slug) ? slug : `pal_${slug}`;
}

/**
 * Build a new canonical actor from a surface identity. Reach comes from the
 * surface source, never from profile prose or visible page details.
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
