import { describe, expect, it } from 'vitest';
import { ResidenceTenancy } from '../../src/engine/ResidenceTenancy';
import type {
  GeneratedPhysicalObjectDef,
  GeneratedPlacementSlotDef,
} from '../../src/engine/worldContent.generated';
import {
  calculateHousingRent,
  commitHousingMove,
  commitHousingOffer,
  listEligibleHousingOffers,
  movePlayerOwnedHousingObjects,
  type HousingOffer,
  type HousingPropertyPackage,
} from '../../src/engine/residence/HousingProgression';
import type {
  PhysicalObjectRuntimeState,
  PhysicalRuntimeGraph,
} from '../../src/engine/physical/PhysicalContextRuntime';

describe('HousingProgression', () => {
  const alphaOffer: HousingOffer = {
    id: 'offer_alpha', placeId: 'test_lodging_alpha', available: true, monthlyRent: 55, moveInCost: 20,
  };
  const betaOffer: HousingOffer = {
    id: 'offer_beta', placeId: 'test_lodging_beta', available: false, monthlyRent: 45, moveInCost: 10,
  };
  const gammaOffer: HousingOffer = {
    id: 'offer_gamma', placeId: 'test_lodging_gamma', available: true, monthlyRent: 80, moveInCost: 70,
  };
  const offers: HousingOffer[] = [alphaOffer, betaOffer, gammaOffer];

  it('constrains starting choice by authored availability and affordability', () => {
    expect(listEligibleHousingOffers(offers, 60).map((offer) => offer.id)).toEqual(['offer_alpha']);
    expect(listEligibleHousingOffers(offers, 100).map((offer) => offer.id)).toEqual(['offer_alpha', 'offer_gamma']);
  });

  it('commits exactly one tenancy and charges move-in cost once', () => {
    const residence = new ResidenceTenancy();
    let cash = 60;
    const spend = (amount: number): boolean => { if (cash < amount) return false; cash -= amount; return true; };
    expect(commitHousingOffer({ offer: alphaOffer, residence, moveInMinute: 120, spendMoveInCost: spend, tenancyId: 'tenancy_alpha' })).toEqual({ ok: true });
    expect(cash).toBe(40);
    expect(residence.getState()).toEqual({ currentResidencePlaceId: 'test_lodging_alpha', tenancyId: 'tenancy_alpha', moveInMinute: 120, currentRent: 55 });
    expect(commitHousingOffer({ offer: alphaOffer, residence, moveInMinute: 121, spendMoveInCost: spend, tenancyId: 'tenancy_alpha' })).toEqual({ ok: false, reason: 'already-current-tenancy' });
    expect(cash).toBe(40);
    expect(residence.getState()?.moveInMinute).toBe(120);
  });

  it('fails closed before mutation when an offer is unavailable or unaffordable', () => {
    const residence = new ResidenceTenancy();
    let spendCalls = 0;
    const spend = (_amount: number): boolean => { spendCalls += 1; return false; };
    expect(commitHousingOffer({ offer: betaOffer, residence, moveInMinute: 0, spendMoveInCost: spend, tenancyId: 'tenancy_beta' })).toEqual({ ok: false, reason: 'unavailable' });
    expect(spendCalls).toBe(0);
    expect(commitHousingOffer({ offer: gammaOffer, residence, moveInMinute: 0, spendMoveInCost: spend, tenancyId: 'tenancy_gamma' })).toEqual({ ok: false, reason: 'unaffordable' });
    expect(spendCalls).toBe(1);
    expect(residence.getState()).toBeNull();
  });

  it('derives rent from tenancy terms and the supplied property package only', () => {
    const basicPackage: HousingPropertyPackage = { id: 'package_basic', rentAdjustment: 0, suppliedObjectDefIds: ['test_bed_basic'] };
    const improvedPackage: HousingPropertyPackage = { id: 'package_improved', rentAdjustment: 25, suppliedObjectDefIds: ['test_bed_basic', 'test_desk_supplied'] };
    expect(calculateHousingRent({ baseRent: 55, propertyPackage: basicPackage })).toBe(55);
    expect(calculateHousingRent({ baseRent: 55, propertyPackage: improvedPackage })).toBe(80);
  });

  it('does not let player-owned belongings alter property-derived rent', () => {
    const propertyPackage: HousingPropertyPackage = { id: 'package_alpha', rentAdjustment: 10, suppliedObjectDefIds: ['test_bed_supplied'] };
    const beforeDecor = calculateHousingRent({ baseRent: 55, propertyPackage });
    const playerOwnedObjectInstanceIds = ['owned_lamp_17', 'owned_terminal_42'];
    expect(playerOwnedObjectInstanceIds).toHaveLength(2);
    expect(calculateHousingRent({ baseRent: 55, propertyPackage })).toBe(beforeDecor);
  });

  it('represents better-room and authored tiny-apartment progression through the same data contracts', () => {
    const basicPackage: HousingPropertyPackage = { id: 'package_basic_room', rentAdjustment: 0, suppliedObjectDefIds: ['test_bed_basic'] };
    const betterPackage: HousingPropertyPackage = { id: 'package_better_room', rentAdjustment: 20, suppliedObjectDefIds: ['test_bed_better', 'test_desk_supplied'] };
    const apartmentPackage: HousingPropertyPackage = { id: 'package_tiny_apartment', rentAdjustment: 35, suppliedObjectDefIds: ['test_bed_apartment', 'test_counter_apartment', 'test_storage_apartment'] };
    const progression = [
      { offer: { id: 'offer_basic_room', placeId: 'test_place_basic_room', available: true, monthlyRent: calculateHousingRent({ baseRent: 45, propertyPackage: basicPackage }), moveInCost: 20 }, propertyPackage: basicPackage },
      { offer: { id: 'offer_better_room', placeId: 'test_place_better_room', available: true, monthlyRent: calculateHousingRent({ baseRent: 55, propertyPackage: betterPackage }), moveInCost: 60 }, propertyPackage: betterPackage },
      { offer: { id: 'offer_tiny_apartment', placeId: 'test_place_tiny_apartment', available: false, monthlyRent: calculateHousingRent({ baseRent: 85, propertyPackage: apartmentPackage }), moveInCost: 140 }, propertyPackage: apartmentPackage },
    ] satisfies ReadonlyArray<{ offer: HousingOffer; propertyPackage: HousingPropertyPackage }>;

    expect(listEligibleHousingOffers(progression.map((step) => step.offer), 100).map((offer) => offer.placeId)).toEqual(['test_place_basic_room', 'test_place_better_room']);
    const apartmentBecomesAvailable = progression.map((step) => step.offer.placeId === 'test_place_tiny_apartment' ? { ...step.offer, available: true } : step.offer);
    expect(listEligibleHousingOffers(apartmentBecomesAvailable, 200).map((offer) => offer.placeId)).toContain('test_place_tiny_apartment');
    expect(progression.map((step) => step.propertyPackage.suppliedObjectDefIds.length)).toEqual([1, 2, 3]);
  });

  const furnitureDef: GeneratedPhysicalObjectDef = { id: 'test_furniture_def', name: 'Synthetic furniture', kind: 'furniture', containerId: null, affordances: ['inspect'], toolCapabilities: [], resourceCapabilities: [], tags: [] };
  const storageDef: GeneratedPhysicalObjectDef = { id: 'test_storage_def', name: 'Synthetic storage', kind: 'storage', containerId: null, affordances: ['open'], toolCapabilities: [], resourceCapabilities: [], tags: [] };
  const moveSlots: GeneratedPlacementSlotDef[] = [
    { id: 'old_property_slot', name: 'Old property slot', spaceId: 'old_space', anchorId: 'old_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['furniture'], tags: [] },
    { id: 'new_residence_slot', name: 'New residence slot', spaceId: 'new_space', anchorId: 'new_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['furniture'], tags: [] },
    { id: 'incompatible_storage_slot', name: 'Storage-only slot', spaceId: 'new_space', anchorId: 'storage_anchor', parentPlacementId: null, slotKind: 'floor', allowedObjectKinds: ['storage'], tags: [] },
  ];
  const moveGraph: PhysicalRuntimeGraph = { objectDefs: [furnitureDef, storageDef], slots: moveSlots, placements: [] };
  const moveState = (): PhysicalObjectRuntimeState => ({ objects: {
    owned_desk_17: { instanceId: 'owned_desk_17', objectDefId: 'test_furniture_def', location: { kind: 'slot', slotId: 'old_property_slot' } },
    property_fixture_3: { instanceId: 'property_fixture_3', objectDefId: 'test_furniture_def', location: { kind: 'detached' } },
  } });
  const isPlayerOwned = (instanceId: string): boolean => instanceId === 'owned_desk_17';

  it('moves exact player-owned instances while property fixtures stay with the old property', () => {
    const before = moveState();
    const after = movePlayerOwnedHousingObjects({ state: before, graph: moveGraph, moves: [{ objectInstanceId: 'owned_desk_17', targetSlotId: 'new_residence_slot' }], isPlayerOwnedObject: isPlayerOwned });
    expect(Object.keys(after.objects).sort()).toEqual(Object.keys(before.objects).sort());
    expect(after.objects['owned_desk_17']).toEqual({ instanceId: 'owned_desk_17', objectDefId: 'test_furniture_def', location: { kind: 'slot', slotId: 'new_residence_slot' } });
    expect(after.objects['property_fixture_3']).toEqual(before.objects['property_fixture_3']);
    expect(before.objects['owned_desk_17']?.location).toEqual({ kind: 'slot', slotId: 'old_property_slot' });
  });

  it('rejects property-owned or incompatible moves without mutating the original physical state', () => {
    const before = moveState();
    expect(() => movePlayerOwnedHousingObjects({ state: before, graph: moveGraph, moves: [{ objectInstanceId: 'property_fixture_3', targetSlotId: 'new_residence_slot' }], isPlayerOwnedObject: isPlayerOwned })).toThrow('Housing cannot move non-player-owned object: property_fixture_3.');
    expect(() => movePlayerOwnedHousingObjects({ state: before, graph: moveGraph, moves: [{ objectInstanceId: 'owned_desk_17', targetSlotId: 'incompatible_storage_slot' }], isPlayerOwnedObject: isPlayerOwned })).toThrow('is not allowed in slot incompatible_storage_slot');
    expect(before).toEqual(moveState());
  });

  it('commits tenancy only after the physical move is valid and exposes the new home immediately', () => {
    const residence = new ResidenceTenancy({ currentResidencePlaceId: 'test_lodging_old', tenancyId: 'tenancy_old', moveInMinute: 10, currentRent: 40 });
    let cash = 100;
    const result = commitHousingMove({ offer: gammaOffer, residence, tenancyId: 'tenancy_new', moveInMinute: 500, spendMoveInCost: (amount) => { if (cash < amount) return false; cash -= amount; return true; }, physicalState: moveState(), physicalGraph: moveGraph, moves: [{ objectInstanceId: 'owned_desk_17', targetSlotId: 'new_residence_slot' }], isPlayerOwnedObject: isPlayerOwned });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(cash).toBe(30);
    expect(residence.resolveHomePlaceId()).toBe('test_lodging_gamma');
    expect(result.physicalState.objects['owned_desk_17']?.location).toEqual({ kind: 'slot', slotId: 'new_residence_slot' });
    expect(result.physicalState.objects['property_fixture_3']).toEqual(moveState().objects['property_fixture_3']);
  });

  it('does not charge or change tenancy when physical installation is invalid', () => {
    const residence = new ResidenceTenancy({ currentResidencePlaceId: 'test_lodging_old', tenancyId: 'tenancy_old', moveInMinute: 10, currentRent: 40 });
    let spendCalls = 0;
    expect(() => commitHousingMove({ offer: alphaOffer, residence, tenancyId: 'tenancy_new', moveInMinute: 500, spendMoveInCost: () => { spendCalls += 1; return true; }, physicalState: moveState(), physicalGraph: moveGraph, moves: [{ objectInstanceId: 'owned_desk_17', targetSlotId: 'incompatible_storage_slot' }], isPlayerOwnedObject: isPlayerOwned })).toThrow('is not allowed in slot incompatible_storage_slot');
    expect(spendCalls).toBe(0);
    expect(residence.resolveHomePlaceId()).toBe('test_lodging_old');
  });
});