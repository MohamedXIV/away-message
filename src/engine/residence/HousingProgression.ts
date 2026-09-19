import type { ResidenceTenancy } from '../ResidenceTenancy';

export interface HousingOffer {
  id: string;
  placeId: string;
  available: boolean;
  monthlyRent: number;
  moveInCost: number;
}

export type HousingCommitFailure = 'unavailable' | 'unaffordable' | 'already-current-tenancy';
export type HousingCommitResult = { ok: true } | { ok: false; reason: HousingCommitFailure };

export function listEligibleHousingOffers(
  offers: readonly HousingOffer[],
  availableCash: number,
): HousingOffer[] {
  return offers.filter((offer) => offer.available && offer.moveInCost <= availableCash);
}

export function commitHousingOffer(input: {
  offer: Readonly<HousingOffer>;
  residence: ResidenceTenancy;
  tenancyId: string;
  moveInMinute: number;
  spendMoveInCost: (amount: number) => boolean;
}): HousingCommitResult {
  const { offer, residence, tenancyId, moveInMinute, spendMoveInCost } = input;

  if (!offer.available) return { ok: false, reason: 'unavailable' };

  const current = residence.getState();
  if (current?.tenancyId === tenancyId) {
    return { ok: false, reason: 'already-current-tenancy' };
  }

  if (!spendMoveInCost(offer.moveInCost)) {
    return { ok: false, reason: 'unaffordable' };
  }

  residence.setCurrentResidence({
    placeId: offer.placeId,
    tenancyId,
    moveInMinute,
    currentRent: offer.monthlyRent,
  });

  return { ok: true };
}
