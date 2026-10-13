// Canonical v6 simulation facade.
//
// The large gameplay coordinator is intentionally preserved in
// SimulationEngineCore.ts so the computer/OS migration cannot accidentally
// rewrite unrelated social/world/economy behavior. This facade owns the v6
// canonical roots and narrows the remaining legacy compatibility to one place.

import { InventoryEngine, type HardwareInstallSlot } from './InventoryEngine';
import {
  ComputerOwnershipRuntime,
  type PcBootState,
  type OsInstallPlan,
} from './kernel/ComputerOwnershipRuntime';
export { resolvePcBootState } from './kernel/ComputerOwnershipRuntime';
export type { PcBootState, OsInstallMode, OsInstallPlan } from './kernel/ComputerOwnershipRuntime';
import { SimulationEngine as SimulationEngineCore } from './SimulationEngineCore';
import { NpcLifeRuntime } from './kernel/NpcLifeRuntime';
import { NpcMovementRuntime } from './kernel/NpcMovementRuntime';
import { EncounterRuntime } from './kernel/EncounterRuntime';
import {

  type CharacterIntent,
  type CharacterObligation,
  type FidelityTier,
  type LifeMatrixSnapshot,
  type LifePressureView,

  type NpcLifePersistedState,

  type PersonalGoal,
} from './life';
import {
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
} from './hardware/state';
import {
  type NpcCoLocation,
  type NpcMobilityState,
  type NpcPlaceQuery,
  type NpcTripRecord,
} from './transit/NpcTrips';
import type { ActorSpatialPositions, ActorSpatialProjection } from './spatial/ActorSpatialState';
import type { SpatialPosition } from './spatial/SpatialPresence';
import type {
  EncounterCandidate,
  EncounterDecision,
  EncounterDecisionInput,
  EncounterDirectorState,
  EncounterPlayerTransitRead,
} from './encounters';
export type {
  EncounterCandidate,
  EncounterDecision,
  EncounterDecisionInput,
  EncounterDirectorState,
  EncounterPlayerTransitRead,
} from './encounters';
import type {
  ActionResult,
  HardwareState as CanonicalHardwareState,
  SimulationState as CanonicalSimulationState,
  StorePurchaseResultData,
} from './types/index';
import type {
  SimulationAction,
  SimulationState as TransportSimulationState,
} from './types';

export type LiveSimulationState = CanonicalSimulationState;
function hasOwn(value: object | undefined, key: PropertyKey): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

export class SimulationEngine extends SimulationEngineCore {
  public readonly inventory: InventoryEngine;
  private readonly computerOwnership: ComputerOwnershipRuntime;

  private v6CachedBase: Readonly<TransportSimulationState> | null = null;
  private v6CachedState: Readonly<LiveSimulationState> | null = null;
  /** Canonical NPC goals and pressure: exactly one composed state owner. */
  private readonly npcLife: NpcLifeRuntime;
  /** One canonical trip + actor spatial position authority. */
  private readonly movement: NpcMovementRuntime;
  /** One owner for encounter cooldowns and one-shot marks. */
  private readonly encounter: EncounterRuntime;


  constructor(initialState?: Partial<TransportSimulationState>) {
    const computer = initialState?.computer ?? createEmptyComputerSetup();
    const display = initialState?.display ?? createEmptyDisplaySetup();

    const installedSoftware = hasOwn(initialState, 'installedSoftware')
      ? initialState?.installedSoftware
      : [];

    const coreInitial: Partial<TransportSimulationState> = {
      ...initialState,
      hardware: {
        ...(initialState?.hardware ?? ({} as CanonicalHardwareState)),
        computer,
        display,
      },
      os: initialState?.os ?? {
        currentOsId: null,
        installedPatchIds: [],
      },
      installedSoftware,
    };

    super(coreInitial);

    if (!initialState || hasOwn(initialState, 'installedSoftware')) {
      const installedPulse = installedSoftware?.find(
        (software) => software.appId === 'app.pulse' || software.appId === 'app.pulse_messenger',
      );
      this.pulse.syncInstalledVersion(installedPulse?.version ?? null);
    }

    this.computerOwnership = new ComputerOwnershipRuntime(
      { hardware: this.hardware, os: this.os, economy: this.economy },
      () => this.getState(),
      (minutes, reason) => this.advanceGameMinutes(minutes, reason),
      (amount, reason) => super.dispatchAction({
        type: 'PLAYER_SPEND_CASH',
        amount,
        reason,
      }),
      () => this.invalidateV6Cache(),
      initialState?.inventory,
    );
    // Compatibility alias to the *same* single inventory instance.
    this.inventory = this.computerOwnership.inventory;
    this.npcLife = new NpcLifeRuntime(
      { clock: this.clock, social: this.social, world: this.world },
      () => this.invalidateV6Cache(),
      initialState?.npcLives,
    );
    this.movement = new NpcMovementRuntime(
      { clock: this.clock, social: this.social, events: this.events, telemetry: this.telemetry },
      (actorId) => this.npcLife.getCharacterIntent(actorId),
      () => this.invalidateV6Cache(),
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
      () => this.invalidateV6Cache(),
      initialState?.encounters,
    );
  }

  public override getState(): Readonly<LiveSimulationState> {
    const base = super.getState();
    if (this.v6CachedBase === base && this.v6CachedState) {
      return this.v6CachedState;
    }

    const state: Readonly<LiveSimulationState> = {
      ...base,
      hardware: this.hardware.getState(),
      computer: this.hardware.getComputerState(),
      display: this.hardware.getDisplayState(),
      inventory: this.inventory.getState(),
      os: this.os.getState(),
      installedSoftware: this.software.getInstalledSoftware(),
      npcLives: this.getNpcLivesState(),
      npcMobility: this.getNpcMobilityState(),
      actorSpatialPositions: this.getActorSpatialPositions(),
      encounters: this.getEncounterDirectorState(),
    } as Readonly<LiveSimulationState>;

    this.v6CachedBase = base;
    this.v6CachedState = state;
    return state;
  }

  public override exportSnapshot(): LiveSimulationState {
    const base = super.exportSnapshot();
    const snapshot = {
      ...base,
      hardware: this.hardware.getState(),
      computer: this.hardware.getComputerState(),
      display: this.hardware.getDisplayState(),
      inventory: this.inventory.getState(),
      os: this.os.getState(),
      installedSoftware: this.software.getInstalledSoftware(),
      npcLives: this.getNpcLivesState(),
      npcMobility: this.getNpcMobilityState(),
      actorSpatialPositions: this.getActorSpatialPositions(),
      encounters: this.getEncounterDirectorState(),
    } as LiveSimulationState;

    this.v6CachedBase = null;
    this.v6CachedState = null;
    return JSON.parse(JSON.stringify(snapshot)) as LiveSimulationState;
  }

  private invalidateV6Cache(): void {
    this.v6CachedBase = null;
    this.v6CachedState = null;
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

  /** Run population-wide NPC work only after authoritative game time moves. */
  private settleAtAuthoritativeMinuteBoundary(previousMinute: number): void {
    if (this.clock.getTotalMinutes() === previousMinute) return;
    this.npcLife.advanceAllNpcPressuresToNow();
    this.movement.progressNpcMobility();
  }

  public override advanceGameMinutes(minutes: number, reason?: string): void {
    const previousMinute = this.clock.getTotalMinutes();
    if (minutes > 0) this.movement.primeMissingNpcMobility();
    super.advanceGameMinutes(minutes, reason);
    this.settleAtAuthoritativeMinuteBoundary(previousMinute);
  }

  public override advanceRealTime(deltaRealSeconds: number): void {
    const previousMinute = this.clock.getTotalMinutes();
    super.advanceRealTime(deltaRealSeconds);
    this.settleAtAuthoritativeMinuteBoundary(previousMinute);
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

  protected clearActorSpatialForTravel(actorId: string): void {
    this.movement.clearActorSpatialForTravel(actorId);
  }

  protected relocateActorToGeneratedPlaceEntry(actorId: string, placeId: string): boolean {
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

  public override dispatchAction(action: SimulationAction) {
    if (action.type === 'STORE_PURCHASE_ITEM') {
      return this.purchaseStoreItem(action.storeId, action.skuId);
    }

    if (action.type === 'HARDWARE_UPGRADE_OS') {
      return {
        success: false,
        error: 'Legacy OS upgrades are retired. Buy, insert, and boot from owned setup media instead.',
      };
    }

    // Sleep/rest jumps the clock without going through advanceGameMinutes.
    // Any clock movement evolves coarse NPC pressure (idempotent at a minute).
    const beforeMinute = this.clock.getTotalMinutes();
    const result = super.dispatchAction(action);
    this.settleAtAuthoritativeMinuteBoundary(beforeMinute);
    return result;
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const computer = snapshot.computer ?? createEmptyComputerSetup();
    const display = snapshot.display ?? createEmptyDisplaySetup();
    this.computerOwnership.loadInventory(snapshot.inventory);

    this.invalidateV6Cache();

    const compatSnapshot: TransportSimulationState = {
      ...snapshot,
      hardware: {
        ...snapshot.hardware,
        computer,
        display,
      },
    };

    super.loadSnapshot(compatSnapshot);
    this.software.loadState(snapshot.installedSoftware ?? []);
    // Rehydrate canonical #43 state with normalization, then deterministically
    // cover buddies missing from the slice (old saves, late joiners).
    this.npcLife.loadState(snapshot.npcLives);
    // Canonical #37 state hydrates with validation; malformed entries drop.
    // Missing slices (old saves) become empty defaults — planning resumes
    // deterministically on the next tick.
    this.movement.loadState(snapshot.npcMobility, snapshot.actorSpatialPositions);
    this.encounter.loadState(snapshot.encounters);
  }
}
