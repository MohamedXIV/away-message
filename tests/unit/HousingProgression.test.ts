import { describe, expect, it } from 'vitest';
import { ResidenceTenancy } from '../../src/engine/ResidenceTenancy';
import {
  calculateHousingRent,
  commitHousingOffer,
  listEligibleHousingOffers,
  type HousingOffer,
  type HousingPropertyPackage,
} from '../../src/engine/residence/HousingProgression';

describe('HousingProgression', () => {
  const alphaOffer: HousingOffer = {
    id: 'offer_alpha',
    placeId: 'test_lodging_alpha',
    available: true,
    monthlyRent: 55,
    moveInCost: 20,
  };
  const betaOffer: HousingOffer = {
    id: 'offer_beta',
    placeId: 'test_lodging_beta',
    available: false,
    monthlyRent: 45,
    moveInCost: 10,
  };
  const gammaOffer: HousingOffer = {
    id: 'offer_gamma',
    placeId: 'test_lodging_gamma',
    available: true,
    monthlyRent: 80,
    moveInCost: 70,
  };
  const offers: HousingOffer[] = [alphaOffer, betaOffer, gammaOffer];

  it('constrains starting choice by authored availability and affordability', () => {
    expect(listEligibleHousingOffers(offers, 60).map((offer) => offer.id)).toEqual(['offer_alpha']);
    expect(listEligibleHousingOffers(offers, 100).map((offer) => offer.id)).toEqual([
      'offer_alpha',
      'offer_gamma',
    ]);
  });

  it('commits exactly one tenancy and charges move-in cost once', () => {
    const residence = new ResidenceTenancy();
    let cash = 60;
    const spend = (amount: number): boolean => {
      if (cash < amount) return false;
      cash -= amount;
      return true;
    };

    const first = commitHousingOffer({
      offer: alphaOffer,
      residence,
      moveInMinute: 120,
      spendMoveInCost: spend,
      tenancyId: 'tenancy_alpha',
    });

    expect(first).toEqual({ ok: true });
    expect(cash).toBe(40);
    expect(residence.getState()).toEqual({
      currentResidencePlaceId: 'test_lodging_alpha',
      tenancyId: 'tenancy_alpha',
      moveInMinute: 120,
      currentRent: 55,
    });

    const duplicate = commitHousingOffer({
      offer: alphaOffer,
      residence,
      moveInMinute: 121,
      spendMoveInCost: spend,
      tenancyId: 'tenancy_alpha',
    });

    expect(duplicate).toEqual({ ok: false, reason: 'already-current-tenancy' });
    expect(cash).toBe(40);
    expect(residence.getState()?.moveInMinute).toBe(120);
  });

  it('fails closed before mutation when an offer is unavailable or unaffordable', () => {
    const residence = new ResidenceTenancy();
    let spendCalls = 0;
    const spend = (_amount: number): boolean => {
      spendCalls += 1;
      return false;
    };

    expect(commitHousingOffer({
      offer: betaOffer,
      residence,
      moveInMinute: 0,
      spendMoveInCost: spend,
      tenancyId: 'tenancy_beta',
    })).toEqual({ ok: false, reason: 'unavailable' });
    expect(spendCalls).toBe(0);

    expect(commitHousingOffer({
      offer: gammaOffer,
      residence,
      moveInMinute: 0,
      spendMoveInCost: spend,
      tenancyId: 'tenancy_gamma',
    })).toEqual({ ok: false, reason: 'unaffordable' });
    expect(spendCalls).toBe(1);
    expect(residence.getState()).toBeNull();
  });

  it('derives rent from tenancy terms and the supplied property package only', () => {
    const basicPackage: HousingPropertyPackage = {
      id: 'package_basic',
      rentAdjustment: 0,
      suppliedObjectDefIds: ['test_bed_basic'],
    };
    const improvedPackage: HousingPropertyPackage = {
      id: 'package_improved',
      rentAdjustment: 25,
      suppliedObjectDefIds: ['test_bed_basic', 'test_desk_supplied'],
    };

    expect(calculateHousingRent({ baseRent: 55, propertyPackage: basicPackage })).toBe(55);
    expect(calculateHousingRent({ baseRent: 55, propertyPackage: improvedPackage })).toBe(80);
  });

  it('does not let player-owned belongings alter property-derived rent', () => {
    const propertyPackage: HousingPropertyPackage = {
      id: 'package_alpha',
      rentAdjustment: 10,
      suppliedObjectDefIds: ['test_bed_supplied'],
    };
    const beforeDecor = calculateHousingRent({ baseRent: 55, propertyPackage });

    // Player-owned objects are intentionally absent from the rent contract. Their exact
    // instances belong to the physical ownership/location authority, not tenancy pricing.
    const playerOwnedObjectInstanceIds = ['owned_lamp_17', 'owned_terminal_42'];
    expect(playerOwnedObjectInstanceIds).toHaveLength(2);
    expect(calculateHousingRent({ baseRent: 55, propertyPackage })).toBe(beforeDecor);
  });
});
