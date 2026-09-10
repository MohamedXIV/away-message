import type { CharacterObligation, LifeMatrixSnapshot } from './types';

/**
 * Pure obligation projection boundary. Source mappings are added incrementally;
 * an empty Life Matrix snapshot has no obligations and never creates storage.
 */
export function buildCharacterObligations(
  snapshot: LifeMatrixSnapshot,
): CharacterObligation[] {
  void snapshot;
  return [];
}
