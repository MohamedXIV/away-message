// Canonical v6 simulation facade.
//
// The large gameplay coordinator is intentionally preserved in
// SimulationEngineCore.ts so the computer/OS migration cannot accidentally
// rewrite unrelated social/world/economy behavior. This facade owns the v6
// canonical roots and narrows the remaining legacy compatibility to one place.

import { InventoryEngine, type HardwareInstallSlot } from '../InventoryEngine';
import {
  ComputerOwnershipRuntime,
  type PcBootState,
  type OsInstallPlan,
} from './ComputerOwnershipRuntime';
export { resolvePcBootState } from './ComputerOwnershipRuntime';
export type { PcBootState, OsInstallMode, OsInstallPlan } from './ComputerOwnershipRuntime';
import { CoreSimulationRuntime } from './CoreSimulationRuntime';
import { NpcLifeRuntime } from './NpcLifeRuntime';
import { NpcMovementRuntime } from './NpcMovementRuntime';
import { EncounterRuntime } from './EncounterRuntime';
import {

  type CharacterIntent,
  type CharacterObligation,
  type FidelityTier,
  type LifeMatrixSnapshot,
  type LifePressureView,

  type NpcLifePersistedState,

  type PersonalGoal,
} from '../life';
import {
  type NpcCoLocation,
  type NpcMobilityState,
  type NpcPlaceQuery,
  type NpcTripRecord,
} from '../transit/NpcTrips';
import type { ActorSpatialPositions, ActorSpatialProjection } from '../spatial/ActorSpatialState';
import type { SpatialPosition } from '../spatial/SpatialPresence';
import type {
  EncounterCandidate,
  EncounterDecision,
  EncounterDecisionInput,
  EncounterDirectorState,
  EncounterPlayerTransitRead,
} from '../encounters';
export type {
  EncounterCandidate,
  EncounterDecision,
  EncounterDecisionInput,
  EncounterDirectorState,
  EncounterPlayerTransitRead,
} from '../encounters';
import type {
  ActionResult,
  SimulationState as CanonicalSimulationState,
  StorePurchaseResultData,
} from '../types/index';
import type {
  SimulationState as TransportSimulationState,
} from '../types';

export type LiveSimulationState = CanonicalSimulationState;
function hasOwn(value: object | undefined, key: PropertyKey): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

export interface NpcRuntimePorts {
  getState(): Readonly<TransportSimulationState>;
  advanceGameMinutes(minutes: number, reason?: string): void;
  dispatchAction(action: import('../types').SimulationAction): ActionResult;
  invalidate(): void;
}

/** Owns one PC inventory, NPC Life, NPC trips/XYZ and encounter decision runtime. */
export class NpcComputerSimulationRuntime {
  private get clock() { return this.core.clock; }
  private get hardware() { return this.core.hardware; }
  private get os() { return this.core.os; }
  private get economy() { return this.core.economy; }
  private get social() { return this.core.social; }
  private get world() { return this.core.world; }
  private get events() { return this.core.events; }
  private get telemetry() { return this.core.telemetry; }
  private get pulse() { return this.core.pulse; }
  public readonly inventory: InventoryEngine;
  private readonly computerOwnership: ComputerOwnershipRuntime;

  /** Canonical NPC goals and pressure: exactly one composed state owner. */
  public readonly npcLife: NpcLifeRuntime;
  /** One canonical trip + actor spatial position authority. */
  public readonly movement: NpcMovementRuntime;
  /** One owner for encounter cooldowns and one-shot marks. */
  private readonly encounter: EncounterRuntime;


  constructor(
    private readonly core: CoreSimulationRuntime,
    private readonly ports: NpcRuntimePorts,
    initialState?: Partial<TransportSimulationState>,
  ) {
    const installedSoftware = hasOwn(initialState, 'installedSoftware')
      ? initialState?.installedSoftware : [];
    if (!initialState || hasOwn(initialState, 'installedSoftware')) {
      const installedPulse = installedSoftware?.find(
        (software) => software.appId === 'app.pulse' || software.appId === 'app.pulse_messenger',
      );
      this.pulse.syncInstalledVersion(installedPulse?.version ?? null);
    }
    this.computerOwnership = new ComputerOwnershipRuntime(
      { hardware: this.hardware, os: this.os, economy: this.economy },
      () => this.ports.getState(),
      (minutes, reason) => this.ports.advanceGameMinutes(minutes, reason),
      (amount, reason) => this.ports.dispatchAction({
        type: 'PLAYER_SPEND_CASH',
        amount,
        reason,
      }),
      () => this.ports.invalidate(),
      initialState?.inventory,
    );
    // Compatibility alias to the *same* single inventory instance.
    this.inventory = this.computerOwnership.inventory;
    this.npcLife = new NpcLifeRuntime(
      { clock: this.clock, social: this.social, world: this.world },
      () => this.ports.invalidate(),
      initialState?.npcLives,
    );
    this.movement = new NpcMovementRuntime(
      { clock: this.clock, social: this.social, events: this.events, telemetry: this.telemetry },
      (actorId) => this.npcLife.getCharacterIntent(actorId),
      () => this.ports.invalidate(),
      initialState?.npcMobility,
      initialState?.actorSpatialPositions,
    );
    this.encounter = new EncounterRuntime(
      { clock: this.clock, social: this.social, world: this.world, economy: this.economy },
      {
        getNpcMobilityState: () => this.movement.getNpcMobilityState(),
        getNpcPlaceState: (id, atMinute) => this.movement.getNpcPlaceState(id, atMinute),
        getCharacterIntent: (id) => this.npcLife.getCharacterIntent(id),
        getCharacterObligations: (id) => this.npcLife.getCharacterObligations(id),
        getLifeSnapshot: (id) => this.npcLife.getLifeSnapshot(id),
      },
      () => this.ports.invalidate(),
      initialState?.encounters,
    );
  }

  public getPcBootState(): PcBootState {
    return this.computerOwnership.getPcBootState();
  }

  public getLifeSnapshot(actorId: string): LifeMatrixSnapshot | null {
    return this.npcLife.getLifeSnapshot(actorId);
  }

  public getCharacterObligations(actorId: string): CharacterObligation[] {
    return this.npcLife.getCharacterObligations(actorId);
  }

  public getCharacterIntent(actorId: string): CharacterIntent | null {
    return this.npcLife.getCharacterIntent(actorId);
  }

  public getNpcLivesState(): NpcLifePersistedState {
    return this.npcLife.getNpcLivesState();
  }

  /** #170: population work only after a real clock-minute boundary. */
  public settleAfterTime(previousMinute: number): void {
    if (this.clock.getTotalMinutes() === previousMinute) return;
    this.npcLife.advanceAllNpcPressuresToNow();
    this.movement.progressNpcMobility();
  }

  public primeNpcMobility(): void {
    this.movement.primeMissingNpcMobility();
  }

  public getNpcPressure(actorId: string): LifePressureView | null {
    return this.npcLife.getNpcPressure(actorId);
  }

  public getPersonalGoals(actorId: string): PersonalGoal[] {
    return this.npcLife.getPersonalGoals(actorId);
  }

  public getFidelityTier(actorId: string): FidelityTier {
    return this.npcLife.getFidelityTier(actorId);
  }

  public getNpcMobilityState(): NpcMobilityState {
    return this.movement.getNpcMobilityState();
  }

  public getActorSpatialPositions(): ActorSpatialPositions {
    return this.movement.getActorSpatialPositions();
  }

  public getActorSpatialProjection(actorId: string): ActorSpatialProjection | null {
    return this.movement.getActorSpatialProjection(actorId);
  }

  public relocateActorSpatially(actorId: string, position: SpatialPosition): ActorSpatialProjection {
    return this.movement.relocateActorSpatially(actorId, position);
  }

  public clearActorSpatialForTravel(actorId: string): void {
    this.movement.clearActorSpatialForTravel(actorId);
  }

  public relocateActorToGeneratedPlaceEntry(actorId: string, placeId: string): boolean {
    return this.movement.relocateActorToGeneratedPlaceEntry(actorId, placeId);
  }

  public getNpcTrip(actorId: string): NpcTripRecord | null {
    return this.movement.getNpcTrip(actorId);
  }

  public getNpcPlaceState(actorId: string, atMinute?: number): NpcPlaceQuery {
    return this.movement.getNpcPlaceState(actorId, atMinute);
  }

  public getNpcCoLocation(): NpcCoLocation[] {
    return this.movement.getNpcCoLocation();
  }

  public getEncounterDirectorState(): EncounterDirectorState {
    return this.encounter.getEncounterDirectorState();
  }

  protected buildEncounterInput(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterDecisionInput {
    return this.encounter.buildEncounterInput(playerTransit);
  }

  public collectEncounterCandidates(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterCandidate[] {
    return this.encounter.collectEncounterCandidates(playerTransit);
  }

  public decideEncounter(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterDecision {
    return this.encounter.decideEncounter(playerTransit);
  }

  // NPC trip state now belongs to the composed movement owner.

  public setComputerPower(poweredOn: boolean): ActionResult {
    return this.computerOwnership.setComputerPower(poweredOn);
  }

  public installOwnedHardwareAtHome(
    instanceId: string,
    slot: HardwareInstallSlot,
  ): ActionResult {
    return this.computerOwnership.installOwnedHardwareAtHome(instanceId, slot);
  }

  public insertOwnedMediaAtHome(instanceId: string): ActionResult {
    return this.computerOwnership.insertOwnedMediaAtHome(instanceId);
  }

  public ejectOwnedMediaAtHome(): ActionResult<{ mediaInstanceId: string }> {
    return this.computerOwnership.ejectOwnedMediaAtHome();
  }

  public prepareOsInstallFromInsertedMedia(): ActionResult<OsInstallPlan> {
    return this.computerOwnership.prepareOsInstallFromInsertedMedia();
  }

  public commitOsInstall(plan: OsInstallPlan): ActionResult {
    return this.computerOwnership.commitOsInstall(plan);
  }

  public purchaseStoreItem(
    storeId: 'silicon_spares',
    skuId: string,
  ): ActionResult<StorePurchaseResultData> {
    return this.computerOwnership.purchaseStoreItem(storeId, skuId);
  }

  public setupComputerAtHome(): ActionResult {
    return this.computerOwnership.setupComputerAtHome();
  }

  public loadState(snapshot: TransportSimulationState): void {
    this.computerOwnership.loadInventory(snapshot.inventory);
    this.ports.invalidate();
    this.npcLife.loadState(snapshot.npcLives);
    this.movement.loadState(snapshot.npcMobility, snapshot.actorSpatialPositions);
    this.encounter.loadState(snapshot.encounters);
  }
}
