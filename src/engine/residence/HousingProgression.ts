import type { ResidenceTenancy } from '../ResidenceTenancy';
import {
  movePhysicalObject,
  type PhysicalObjectRuntimeState,
  type PhysicalRuntimeGraph,
} from '../physical/PhysicalContextRuntime';

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

export interface HousingObjectMove {
  objectInstanceId: string;
  targetSlotId: string;
}

export type HousingCommitFailure = 'unavailable' | 'unaffordable' | 'already-current-tenancy';
export type HousingCommitResult = { ok: true } | { ok: false; reason: HousingCommitFailure };
export type HousingMoveCommitResult =
  | { ok: true; physicalState: PhysicalObjectRuntimeState }
  | { ok: false; reason: HousingCommitFailure };

export function calculateHousingRent(terms: Readonly<HousingRentTerms>): number {
  const { baseRent, propertyPackage } = terms;
  if (!Number.isFinite(baseRent) || baseRent < 0) throw new Error('Housing baseRent must be a non-negative finite number');
  if (!Number.isFinite(propertyPackage.rentAdjustment)) throw new Error('Housing property package rentAdjustment must be finite');
  const rent = baseRent + propertyPackage.rentAdjustment;
  if (rent < 0) throw new Error('Housing calculated rent must be non-negative');
  return rent;
}

export function listEligibleHousingOffers(offers: readonly HousingOffer[], availableCash: number): HousingOffer[] {
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
  if (current?.tenancyId === tenancyId) return { ok: false, reason: 'already-current-tenancy' };
  if (!spendMoveInCost(offer.moveInCost)) return { ok: false, reason: 'unaffordable' };
  residence.setCurrentResidence({ placeId: offer.placeId, tenancyId, moveInMinute, currentRent: offer.monthlyRent });
  return { ok: true };
}

/**
 * Applies the physical part of an assisted residence move without owning either
 * ownership truth or placement legality. Ownership is queried from its existing
 * authority and every placement is delegated to PhysicalContextRuntime.
 */
export function movePlayerOwnedHousingObjects(input: {
  state: PhysicalObjectRuntimeState;
  graph: PhysicalRuntimeGraph;
  moves: readonly Readonly<HousingObjectMove>[];
  isPlayerOwnedObject: (objectInstanceId: string) => boolean;
}): PhysicalObjectRuntimeState {
  const { state, graph, moves, isPlayerOwnedObject } = input;
  let candidate = state;
  const seen = new Set<string>();
  for (const move of moves) {
    if (seen.has(move.objectInstanceId)) throw new Error(`Housing move contains duplicate object instance: ${move.objectInstanceId}.`);
    seen.add(move.objectInstanceId);
    if (!isPlayerOwnedObject(move.objectInstanceId)) throw new Error(`Housing cannot move non-player-owned object: ${move.objectInstanceId}.`);
    candidate = movePhysicalObject(candidate, move.objectInstanceId, move.targetSlotId, graph);
  }
  return candidate;
}

/**
 * Coordinates the two existing authorities without becoming either one. Physical
 * legality is proven first on immutable candidate state. Only then may economy
 * charge the move-in cost and ResidenceTenancy switch canonical `home`.
 */
export function commitHousingMove(input: {
  offer: Readonly<HousingOffer>;
  residence: ResidenceTenancy;
  tenancyId: string;
  moveInMinute: number;
  spendMoveInCost: (amount: number) => boolean;
  physicalState: PhysicalObjectRuntimeState;
  physicalGraph: PhysicalRuntimeGraph;
  moves: readonly Readonly<HousingObjectMove>[];
  isPlayerOwnedObject: (objectInstanceId: string) => boolean;
}): HousingMoveCommitResult {
  const { offer, residence, tenancyId, moveInMinute, spendMoveInCost, physicalState, physicalGraph, moves, isPlayerOwnedObject } = input;
  if (!offer.available) return { ok: false, reason: 'unavailable' };
  if (residence.getState()?.tenancyId === tenancyId) return { ok: false, reason: 'already-current-tenancy' };

  const candidatePhysicalState = movePlayerOwnedHousingObjects({
    state: physicalState,
    graph: physicalGraph,
    moves,
    isPlayerOwnedObject,
  });

  if (!spendMoveInCost(offer.moveInCost)) return { ok: false, reason: 'unaffordable' };
  residence.setCurrentResidence({ placeId: offer.placeId, tenancyId, moveInMinute, currentRent: offer.monthlyRent });
  return { ok: true, physicalState: candidatePhysicalState };
}
