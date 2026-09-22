import { describe, expect, it } from 'vitest';
import { ResidenceTenancy } from '../../src/engine/ResidenceTenancy';
import { resolveSemanticHomePlace } from '../../src/engine/residence/HomePlaceResolver';

const TEST_PLACES = [
  { id: 'test_lodging_alpha', label: 'Alpha' },
  { id: 'test_apartment_beta', label: 'Beta' },
] as const;

describe('resolveSemanticHomePlace', () => {
  it('follows the current tenancy instead of a fixed authored place id', () => {
    const residence = new ResidenceTenancy();
    residence.setCurrentResidence({
      placeId: 'test_lodging_alpha', tenancyId: 'tenancy_alpha', moveInMinute: 0, currentRent: 50,
    });
    expect(resolveSemanticHomePlace(residence, TEST_PLACES)?.id).toBe('test_lodging_alpha');

    residence.setCurrentResidence({
      placeId: 'test_apartment_beta', tenancyId: 'tenancy_beta', moveInMinute: 100, currentRent: 80,
    });
    expect(resolveSemanticHomePlace(residence, TEST_PLACES)?.id).toBe('test_apartment_beta');
  });

  it('fails closed when there is no tenancy or its place is not canonical', () => {
    const residence = new ResidenceTenancy();
    expect(resolveSemanticHomePlace(residence, TEST_PLACES)).toBeNull();

    residence.setCurrentResidence({
      placeId: 'test_missing_place', tenancyId: 'tenancy_missing', moveInMinute: 0, currentRent: 0,
    });
    expect(resolveSemanticHomePlace(residence, TEST_PLACES)).toBeNull();
  });
});
