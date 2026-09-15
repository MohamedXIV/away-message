import { GENERATED_PLACES } from '../worldContent.generated';

export interface ResidenceState {
  currentResidencePlaceId: string;
  tenancyId: string;
  moveInMinute: number;
  currentRent: number;
}

const STARTER_RESIDENCE_PLACE_ID = 'room_104';
const STARTER_TENANCY_ID = 'tenancy:starter';

function isCanonicalPlaceId(value: unknown): value is string {
  return typeof value === 'string' && GENERATED_PLACES.some((place) => place.id === value);
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function createInitialResidenceState(currentRent: number, moveInMinute = 480): ResidenceState {
  return {
    currentResidencePlaceId: STARTER_RESIDENCE_PLACE_ID,
    tenancyId: STARTER_TENANCY_ID,
    moveInMinute,
    currentRent,
  };
}

export function hydrateResidenceState(
  raw: unknown,
  fallbackRent: number,
  fallbackMoveInMinute = 480,
): ResidenceState {
  const fallback = createInitialResidenceState(fallbackRent, fallbackMoveInMinute);
  if (!raw || typeof raw !== 'object') return fallback;

  const candidate = raw as Partial<ResidenceState>;
  return {
    currentResidencePlaceId: isCanonicalPlaceId(candidate.currentResidencePlaceId)
      ? candidate.currentResidencePlaceId
      : fallback.currentResidencePlaceId,
    tenancyId: typeof candidate.tenancyId === 'string' && candidate.tenancyId.trim().length > 0
      ? candidate.tenancyId
      : fallback.tenancyId,
    moveInMinute: finiteNonNegative(candidate.moveInMinute, fallback.moveInMinute),
    currentRent: finiteNonNegative(candidate.currentRent, fallback.currentRent),
  };
}

export function cloneResidenceState(state: ResidenceState): ResidenceState {
  return { ...state };
}

export function resolveCurrentHomePlaceId(state: ResidenceState): string {
  return state.currentResidencePlaceId;
}
