import { describe, expect, it } from 'vitest';
import { ResidenceTenancy } from '../../src/engine/ResidenceTenancy';

describe('ResidenceTenancy', () => {
  it('resolves home from mutable tenancy state without changing place identity', () => {
    const residence = new ResidenceTenancy();
    expect(residence.resolveHomePlaceId()).toBeNull();

    residence.setCurrentResidence({
      placeId: 'test_lodging_alpha',
      tenancyId: 'tenancy_alpha',
      moveInMinute: 120,
      currentRent: 90,
    });
    expect(residence.resolveHomePlaceId()).toBe('test_lodging_alpha');

    residence.setCurrentResidence({
      placeId: 'test_apartment_beta',
      tenancyId: 'tenancy_beta',
      moveInMinute: 500,
      currentRent: 140,
    });
    expect(residence.resolveHomePlaceId()).toBe('test_apartment_beta');
  });

  it('round-trips current-format state deterministically', () => {
    const original = new ResidenceTenancy();
    original.setCurrentResidence({
      placeId: 'test_lodging_alpha',
      tenancyId: 'tenancy_alpha',
      moveInMinute: 42,
      currentRent: 75,
    });

    const snapshot = original.getState();
    const restored = new ResidenceTenancy();
    restored.restore(snapshot);

    expect(restored.getState()).toEqual(snapshot);
    expect(JSON.stringify(restored.getState())).toBe(JSON.stringify(snapshot));
  });

  it('does not expose residence capability or fixed-home fallback state', () => {
    const residence = new ResidenceTenancy();
    const state = residence.setCurrentResidence({
      placeId: 'test_lodging_alpha',
      tenancyId: 'tenancy_alpha',
      moveInMinute: 0,
      currentRent: 50,
    });

    expect(Object.keys(state).sort()).toEqual([
      'currentRent',
      'currentResidencePlaceId',
      'moveInMinute',
      'tenancyId',
    ]);
    expect(residence.resolveHomePlaceId()).toBe('test_lodging_alpha');
  });

  it('rejects malformed tenancy state before mutation', () => {
    const residence = new ResidenceTenancy();
    expect(() => residence.setCurrentResidence({
      placeId: '',
      tenancyId: 'tenancy_alpha',
      moveInMinute: 0,
      currentRent: 50,
    })).toThrow(/placeId/);
    expect(residence.getState()).toBeNull();
  });
});
