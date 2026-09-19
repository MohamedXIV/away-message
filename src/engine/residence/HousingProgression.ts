import type { ResidenceTenancy } from '../ResidenceTenancy';

export interface HousingPropertyPackage {
  id: string;
  /** Economic effect of the property-supplied fixture/service package only. */
  rentAdjustment: number;
  /** Authored summary for offer/economy UI; runtime affordances stay on concrete objects. */
  suppliedObjectDefIds: readonly string[];
}

export interface HousingRentTerms {
  baseRent: number;
  propertyPackage: Readonly<HousingPropertyPackage>;
}

export interface HousingOffer {
  id: string;
  placeId: string;
  available: boolean;
  monthlyRent: number;
  moveInCost: number;
}

export type HousingCommitFailure = 'unavailable' | 'unaffordable' | 'already-current-tenancy';
export type HousingCommitResult = { ok: true } | { ok: false; reason: HousingCommitFailure };

export function calculateHousingRent(terms: Readonly<HousingRentTerms>): number {
  const { baseRent, propertyPackage } = terms;
  if (!Number.isFinite(baseRent) || baseRent < 0) {
    throw new Error('Housing baseRent must be a non-negative finite number');
  }
  if (!Number.isFinite(propertyPackage.rentAdjustment)) {
    throw new Error('Housing property package rentAdjustment must be finite');
  }

  const rent = baseRent + propertyPackage.rentAdjustment;
  if (rent < 0) throw new Error('Housing calculated rent must be non-negative');
  return rent;
}

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
