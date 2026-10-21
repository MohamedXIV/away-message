import type { BuddyMetVia } from '../types';

/** Sources that can only reveal an internet surface, never an in-person meeting. */
const ONLINE_ORIGIN_SOURCES: ReadonlySet<BuddyMetVia> = new Set([
  'nightboard',
  'myplace',
  'pulse-room',
]);

/**
 * Default physical scope for a newly admitted actor, derived from how the
 * player learned about them. Online surfaces start remote; work, introductions
 * and authored seeds stay local. Existing canonical actors keep their own
 * reach instead of passing through this default.
 */
export function resolveReachForMetVia(metVia: BuddyMetVia | undefined): 'local' | 'remote' {
  return metVia && ONLINE_ORIGIN_SOURCES.has(metVia) ? 'remote' : 'local';
}

export function isOnlineOriginSource(metVia: BuddyMetVia | undefined): boolean {
  return !!metVia && ONLINE_ORIGIN_SOURCES.has(metVia);
}
