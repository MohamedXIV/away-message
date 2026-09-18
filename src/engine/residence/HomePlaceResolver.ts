import type { ResidenceTenancy } from '../ResidenceTenancy';

export interface CanonicalPlaceRef {
  id: string;
}

/**
 * Resolves the semantic `home` destination through the mutable tenancy root.
 * The authored place catalog remains the authority for whether that id is a
 * real canonical Place; this adapter never supplies a fallback residence.
 */
export function resolveSemanticHomePlace<TPlace extends CanonicalPlaceRef>(
  residence: Pick<ResidenceTenancy, 'resolveHomePlaceId'>,
  places: readonly TPlace[],
): TPlace | null {
  const placeId = residence.resolveHomePlaceId();
  if (!placeId) return null;
  return places.find((place) => place.id === placeId) ?? null;
}
