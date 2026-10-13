import type { CoreDomainOwners } from './CoreDomainOwners';
import { ResidenceTenancy, type ResidenceState } from '../ResidenceTenancy';
import { commitHousingOffer, resolveStarterHousingOffer } from '../residence/HousingProgression';
import { GENERATED_HOUSING_OFFERS, GENERATED_PLACES } from '../worldContent.generated';

export function fallbackResidenceState(): ResidenceState {
  const offer = GENERATED_HOUSING_OFFERS.find((candidate) => candidate.starterDefault)
    ?? GENERATED_HOUSING_OFFERS.find((candidate) => candidate.starterEligible && candidate.available)
    ?? GENERATED_HOUSING_OFFERS[0];
  if (!offer) throw new Error('Generated world has no authored housing offer for residence recovery.');
  return {
    currentResidencePlaceId: offer.placeId,
    tenancyId: `starter:${offer.id}`,
    moveInMinute: 0,
    currentRent: offer.monthlyRent,
  };
}

/**
 * Canonical tenancy instance and housing transaction policy; does not shadow
 * cash, clock, or physical ownership. Reanchoring player inventory after a
 * move is supplied by the one Physical World owner.
 */
export class ResidenceCoordination {
  private readonly residence: ResidenceTenancy;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'economy' | 'clock' | 'telemetry'>,
    private readonly reanchorOwnedItems: () => void,
    initial?: ResidenceState,
    starterHousingOfferId?: string,
  ) {
    this.residence = new ResidenceTenancy(initial);
    if (!initial) {
      const offer = resolveStarterHousingOffer(
        GENERATED_HOUSING_OFFERS,
        owners.economy.getCash(),
        starterHousingOfferId,
      );
      const committed = commitHousingOffer({
        offer,
        residence: this.residence,
        tenancyId: `starter:${offer.id}`,
        moveInMinute: owners.clock.getTotalMinutes(),
        spendMoveInCost: (amount) => owners.economy.spendCash(amount, 'Starter residence move-in'),
        setRecurringRentAmount: (amount) => owners.economy.setRecurringRentAmount(amount),
      });
      if (!committed.ok) {
        throw new Error(`Could not commit starter residence '${offer.id}': ${committed.reason}.`);
      }
    }
  }

  public loadState(state?: ResidenceState): void {
    this.residence.restore(state ?? fallbackResidenceState());
  }

  public resolveHomePlaceId(): string {
    return this.residence.resolveHomePlaceId();
  }

  public getResidenceState(): ResidenceState {
    const state = this.residence.getState();
    if (!state) throw new Error('Simulation has no current residence tenancy.');
    return state;
  }

  public getCurrentResidencePlaceId(): string {
    return this.getResidenceState().currentResidencePlaceId;
  }

  public getHousingOffers(): Array<{
    id: string;
    placeId: string;
    placeName: string;
    available: boolean;
    monthlyRent: number;
    moveInCost: number;
    starterEligible: boolean;
    starterDefault: boolean;
    current: boolean;
    affordable: boolean;
  }> {
    const currentPlaceId = this.getCurrentResidencePlaceId();
    const cash = this.owners.economy.getCash();
    return GENERATED_HOUSING_OFFERS
      .map((offer) => ({
        ...offer,
        placeName: GENERATED_PLACES.find((place) => place.id === offer.placeId)?.name ?? offer.placeId,
        current: offer.placeId === currentPlaceId,
        affordable: offer.moveInCost <= cash,
      }))
      .sort((a, b) => a.monthlyRent - b.monthlyRent || a.id.localeCompare(b.id));
  }

  public moveResidenceToOffer(offerId: string): { success: boolean; error?: string } {
    const offer = GENERATED_HOUSING_OFFERS.find((candidate) => candidate.id === offerId);
    if (!offer) return { success: false, error: `Unknown housing offer '${offerId}'.` };
    if (offer.placeId === this.getCurrentResidencePlaceId()) {
      return { success: false, error: 'That residence is already your current home.' };
    }

    const beforeCash = this.owners.economy.getCash();
    const committed = commitHousingOffer({
      offer,
      residence: this.residence,
      tenancyId: `tenancy:${offer.id}:${this.owners.clock.getTotalMinutes()}`,
      moveInMinute: this.owners.clock.getTotalMinutes(),
      spendMoveInCost: (amount) => this.owners.economy.spendCash(amount, 'Residence move-in'),
      setRecurringRentAmount: (amount) => this.owners.economy.setRecurringRentAmount(amount),
    });
    if (!committed.ok) {
      const error = committed.reason === 'unaffordable'
        ? `Cannot afford the ${offer.moveInCost.toFixed(0)} move-in cost.`
        : committed.reason === 'unavailable'
          ? 'That residence is not currently available.'
          : 'That residence is already active.';
      return { success: false, error };
    }

    // Reproject player-owned inventory into the new home's authored anchor.
    // Property fixtures remain with their authored spaces.
    this.reanchorOwnedItems();

    try {
      this.owners.telemetry.logEvent('world', 'residence_changed', this.owners.clock.getTotalMinutes(), {
        offerId: offer.id,
        placeId: offer.placeId,
        moveInCost: beforeCash - this.owners.economy.getCash(),
        monthlyRent: offer.monthlyRent,
      });
    } catch {}
    return { success: true };
  }

}
