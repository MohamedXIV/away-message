// Canonical v6 simulation facade.
//
// The large gameplay coordinator is intentionally preserved in
// SimulationEngineCore.ts so the computer/OS migration cannot accidentally
// rewrite unrelated social/world/economy behavior. This facade owns the v6
// canonical roots and narrows the remaining legacy compatibility to one place.

import { InventoryEngine, type HardwareInstallSlot } from './InventoryEngine';
import { HARDWARE_STORE_INVENTORY, PHYSICAL_ITEM_CATALOG } from './hardware/catalog';
import { getReleaseById } from './OsCatalog';
import { SimulationEngine as SimulationEngineCore } from './SimulationEngineCore';
import { NpcLifeRuntime } from './kernel/NpcLifeRuntime';
import { NpcMovementRuntime } from './kernel/NpcMovementRuntime';
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
  createEmptyInventoryState,
  legacyModularToCanonical,
} from './hardware/state';
import {
  getSharedPlaceAliases,
  getSharedTransitNetwork,
  resolveTransitPlaceId,
  type NpcCoLocation,
  type NpcMobilityState,
  type NpcPlaceQuery,
  type NpcTripRecord,
} from './transit/NpcTrips';
import type { ActorSpatialPositions, ActorSpatialProjection } from './spatial/ActorSpatialState';
import type { SpatialPosition } from './spatial/SpatialPresence';
import {
  collectEncounterCandidates,
  decideEncounter as decideEncounterPure,
  emptyEncounterDirectorState,
  hydrateEncounterDirectorState,
  type EncounterCandidate,
  type EncounterDecision,
  type EncounterDecisionInput,
  type EncounterDirectorState,
  type EncounterPlayerTransitRead,
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
  OsVersion,
  SimulationState as CanonicalSimulationState,
  StorePurchaseResultData,
} from './types/index';
import type {
  SimulationAction,
  SimulationState as TransportSimulationState,
} from './types';

export type LiveSimulationState = CanonicalSimulationState;
export type PcBootState =
  | 'no_computer'
  | 'awaiting_setup'
  | 'powered_off'
  | 'no_boot_device'
  | 'desktop';

export type OsInstallMode = 'fresh' | 'upgrade' | 'patch';

export interface OsInstallPlan {
  targetOs: OsVersion;
  mediaInstanceId: string;
  mode: OsInstallMode;
  durationMinutes: number;
  installSizeBytes: number;
  preparedAtTotalMinutes: number;
}

function hasOwn(value: object | undefined, key: PropertyKey): boolean {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

export function resolvePcBootState(
  state: Pick<LiveSimulationState, 'computer' | 'inventory' | 'os'>,
): PcBootState {
  if (!state.computer.assembled) {
    const hasUnassembledComputerItems = state.inventory.items.some(
      (item) =>
        item.location === 'room_package' &&
        (item.kind === 'hardware' || item.kind === 'display'),
    );
    return hasUnassembledComputerItems ? 'awaiting_setup' : 'no_computer';
  }

  if (!state.computer.poweredOn) return 'powered_off';
  if (!state.os.currentOsId) return 'no_boot_device';
  return 'desktop';
}

export class SimulationEngine extends SimulationEngineCore {
  public readonly inventory: InventoryEngine;

  private v6CachedBase: Readonly<TransportSimulationState> | null = null;
  private v6CachedState: Readonly<LiveSimulationState> | null = null;
  /** Canonical NPC goals and pressure: exactly one composed state owner. */
  private readonly npcLife: NpcLifeRuntime;
  /** One canonical trip + actor spatial position authority. */
  private readonly movement: NpcMovementRuntime;
  /**
   * Encounter Director cooldowns + surfaced one-shot identities (#47). The
   * only mutable home for that state — candidates are recomputed from
   * canonical systems on every decision, never stored here.
   */
  private encounterDirector: EncounterDirectorState = emptyEncounterDirectorState();


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

    this.inventory = new InventoryEngine(initialState?.inventory ?? createEmptyInventoryState());
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
    this.encounterDirector = hydrateEncounterDirectorState(initialState?.encounters ?? {});
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
    return resolvePcBootState(this.getState());
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

  /** Encounter Director slice as plain snapshot data (deep copy, bounded). */
  public getEncounterDirectorState(): EncounterDirectorState {
    return JSON.parse(JSON.stringify(this.encounterDirector)) as EncounterDirectorState;
  }

  /**
   * Assemble the read-only Encounter Director input from canonical systems
   * (#47). Pure reads — no NPC, transit, relationship, event, or economy
   * writes. Subclasses may supply live player transit; the default (null)
   * settles the player at their authoritative location.
   */
  protected buildEncounterInput(playerTransit: EncounterPlayerTransitRead | null = null): EncounterDecisionInput {
    const nowMinute = this.clock.getTotalMinutes();
    const network = getSharedTransitNetwork();
    const aliases = getSharedPlaceAliases();
    const playerPlaceId =
      playerTransit !== null || !network
        ? null
        : resolveTransitPlaceId(this.economy.getLocation(), network, aliases);
    const mobility = this.getNpcMobilityState();
    const actors = this.social.getBuddies().map((buddy) => ({
      actorId: buddy.id,
      place: this.getNpcPlaceState(buddy.id, nowMinute),
      intent: this.getCharacterIntent(buddy.id),
      obligations: this.getCharacterObligations(buddy.id),
      relationship: this.social.getRelationships(buddy.id) ?? null,
      knownToPlayer: this.social.isKnown(buddy.id),
      eventEffects: this.getLifeSnapshot(buddy.id)?.eventEffects ?? [],
    }));
    return {
      nowMinute,
      playerPlaceId,
      playerTransit,
      actors,
      trips: mobility.trips,
      network,
      activeModifiers: this.world.queryActiveModifiers({ atMinute: nowMinute }),
    };
  }

  /**
   * Renderer-safe candidate collection (#47): pure surfacing read, marks
   * nothing, so opening a view can never create an encounter.
   */
  public collectEncounterCandidates(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterCandidate[] {
    return collectEncounterCandidates(this.buildEncounterInput(playerTransit));
  }

  /**
   * Decide the encounter worth surfacing right now (#47). Records cooldown /
   * one-shot marks in the director's own slice only — source authorities
   * (mobility, obligations, events, relationships) are never written.
   */
  public decideEncounter(
    playerTransit: EncounterPlayerTransitRead | null = null,
  ): EncounterDecision {
    const { decision, nextState } = decideEncounterPure(
      this.buildEncounterInput(playerTransit),
      this.encounterDirector,
    );
    this.encounterDirector = nextState;
    if (decision.kind === 'encounter') this.invalidateV6Cache();
    return decision;
  }

  // NPC trip state now belongs to the composed movement owner.

  public setComputerPower(poweredOn: boolean): ActionResult {
    if (!this.hardware.getComputerState().assembled) {
      return { success: false, error: 'Set up the computer at your current residence before powering it on.' };
    }

    this.hardware.setPower(poweredOn);
    this.invalidateV6Cache();
    return { success: true };
  }

  public installOwnedHardwareAtHome(
    instanceId: string,
    slot: HardwareInstallSlot,
  ): ActionResult {
    const state = this.getState();
    if (state.player.location !== 'home') {
      return { success: false, error: 'Hardware can only be installed at your current residence computer.' };
    }
    if (!state.computer.assembled) {
      return { success: false, error: 'Set up the computer before installing replacement hardware.' };
    }

    const isRamSlot = slot.startsWith('ram:');
    const isCpuSlot = slot === 'cpu';
    const isNetworkSlot = slot === 'network';
    const isSoundSlot = slot === 'sound';
    const isActiveOpticalSlot = slot === 'optical:0';
    const isActiveMonitorSlot = slot === 'monitor:0';
    if (
      !isRamSlot &&
      !isCpuSlot &&
      !isNetworkSlot &&
      !isSoundSlot &&
      !isActiveOpticalSlot &&
      !isActiveMonitorSlot
    ) {
      return {
        success: false,
        error: 'This at-home install slice currently supports RAM, CPU, network cards, sound cards, the active optical drive, and the active monitor.',
      };
    }

    let ramSlotIndex: number | null = null;
    if (isRamSlot) {
      ramSlotIndex = Number(slot.slice('ram:'.length));
      if (!Number.isInteger(ramSlotIndex) || ramSlotIndex < 0) {
        return { success: false, error: `Invalid RAM slot: ${slot}.` };
      }
      if (ramSlotIndex > state.computer.ramSticks.length) {
        return { success: false, error: 'RAM slots must be populated without leaving an unsupported gap.' };
      }
    }

    const matches = state.inventory.items.filter((item) => item.instanceId === instanceId);
    if (matches.length !== 1) {
      return { success: false, error: `Owned item instance is missing or ambiguous: ${instanceId}.` };
    }

    const catalog = PHYSICAL_ITEM_CATALOG[matches[0]!.catalogItemId];
    const component = catalog?.component;
    if (isRamSlot) {
      if (catalog?.componentKind !== 'ram' || !component || !('sizeMb' in component)) {
        return { success: false, error: 'The selected owned item is not installable RAM.' };
      }
    } else if (isCpuSlot) {
      if (
        catalog?.componentKind !== 'cpu' ||
        !component ||
        !('tier' in component) ||
        !('clockMhz' in component) ||
        !('socket' in component) ||
        !('throughputUnits' in component)
      ) {
        return { success: false, error: 'The selected owned item is not an installable CPU.' };
      }
    } else if (isNetworkSlot) {
      if (
        catalog?.componentKind !== 'network' ||
        !component ||
        !('type' in component) ||
        !('speedKbps' in component)
      ) {
        return { success: false, error: 'The selected owned item is not an installable network card.' };
      }
    } else if (isSoundSlot) {
      if (
        catalog?.componentKind !== 'sound' ||
        !component ||
        !('tier' in component) ||
        !('richAudio' in component) ||
        !('midiSupport' in component)
      ) {
        return { success: false, error: 'The selected owned item is not an installable sound card.' };
      }
    } else if (isActiveOpticalSlot) {
      if (
        catalog?.componentKind !== 'optical' ||
        !component ||
        !('type' in component) ||
        !('speedMultiplier' in component)
      ) {
        return { success: false, error: 'The selected owned item is not an installable optical drive.' };
      }
    } else if (
      catalog?.componentKind !== 'monitor' ||
      !component ||
      !('curvature' in component) ||
      !('scanlineIntensity' in component) ||
      !('bloomIntensity' in component) ||
      !('flicker' in component)
    ) {
      return { success: false, error: 'The selected owned item is not an installable monitor.' };
    }

    const inventoryBefore = this.inventory.getState();
    const computerBefore = this.hardware.getComputerState();
    const displayBefore = this.hardware.getDisplayState();

    try {
      this.inventory.installOwnedHardware(instanceId, slot);

      if (isRamSlot) {
        const ram = component as { id: string; name: string; sizeMb: number };
        const ramSticks = computerBefore.ramSticks.map((stick) => ({ ...stick }));
        ramSticks[ramSlotIndex!] = {
          id: ram.id,
          name: ram.name,
          sizeMb: ram.sizeMb,
        };
        this.hardware.loadState({
          computer: { ...computerBefore, ramSticks },
          display: displayBefore,
        });
      } else if (isCpuSlot) {
        const cpu = component as NonNullable<typeof computerBefore.cpu>;
        this.hardware.loadState({
          computer: { ...computerBefore, cpu: { ...cpu } },
          display: displayBefore,
        });
      } else if (isNetworkSlot) {
        const networkCard = component as NonNullable<typeof computerBefore.networkCard>;
        this.hardware.loadState({
          computer: { ...computerBefore, networkCard: { ...networkCard } },
          display: displayBefore,
        });
      } else if (isSoundSlot) {
        const soundCard = component as NonNullable<typeof computerBefore.soundCard>;
        this.hardware.loadState({
          computer: { ...computerBefore, soundCard: { ...soundCard } },
          display: displayBefore,
        });
      } else if (isActiveOpticalSlot) {
        const opticalDrive = component as (typeof computerBefore.opticalDrives)[number];
        const opticalDrives = computerBefore.opticalDrives.map((drive) => ({ ...drive }));
        opticalDrives[0] = { ...opticalDrive };
        this.hardware.loadState({
          computer: { ...computerBefore, opticalDrives },
          display: displayBefore,
        });
      } else {
        const monitor = component as NonNullable<typeof state.display.monitor>;
        this.hardware.loadState({
          computer: computerBefore,
          display: { monitor: { ...monitor } },
        });
      }
    } catch (error) {
      this.inventory.loadState(inventoryBefore);
      this.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.invalidateV6Cache();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hardware installation failed.',
      };
    }

    this.invalidateV6Cache();
    return { success: true };
  }

  public insertOwnedMediaAtHome(instanceId: string): ActionResult {
    const state = this.getState();
    if (state.player.location !== 'home') {
      return { success: false, error: 'Physical media can only be inserted at your current residence computer.' };
    }
    if (!state.computer.assembled || state.computer.opticalDrives.length === 0) {
      return { success: false, error: 'An assembled computer with an optical drive is required.' };
    }
    if (state.computer.insertedMediaId) {
      return { success: false, error: 'Eject the currently inserted disc first.' };
    }

    const matches = state.inventory.items.filter((item) => item.instanceId === instanceId);
    if (matches.length !== 1) {
      return { success: false, error: 'The selected media is not owned.' };
    }
    const item = matches[0]!;
    if (item.kind !== 'media' || (item.location !== 'room_package' && item.location !== 'inventory')) {
      return { success: false, error: 'The selected item is not available owned media.' };
    }

    const catalog = PHYSICAL_ITEM_CATALOG[item.catalogItemId];
    if (!catalog?.media) {
      return { success: false, error: 'The selected owned item is not valid installer media.' };
    }

    const inserted = this.hardware.insertDisc({
      id: item.instanceId,
      title: catalog.media.title,
      type: catalog.media.type,
      osTarget: catalog.media.osTarget,
    });
    if (!inserted) {
      return { success: false, error: 'The optical drive could not accept the disc.' };
    }

    try {
      this.inventory.moveOwnedItem(item.instanceId, ['room_package', 'inventory'], 'inserted');
    } catch (error) {
      this.hardware.ejectDisc();
      this.invalidateV6Cache();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not insert owned media.',
      };
    }

    this.invalidateV6Cache();
    return { success: true };
  }

  public ejectOwnedMediaAtHome(): ActionResult<{ mediaInstanceId: string }> {
    const state = this.getState();
    if (state.player.location !== 'home') {
      return { success: false, error: 'Physical media can only be ejected at your current residence computer.' };
    }
    const mediaInstanceId = state.computer.insertedMediaId;
    if (!mediaInstanceId) {
      return { success: false, error: 'No disc is inserted.' };
    }

    const item = state.inventory.items.find((entry) => entry.instanceId === mediaInstanceId);
    if (!item || item.kind !== 'media' || item.location !== 'inserted') {
      return { success: false, error: 'Inserted-media ownership state is inconsistent.' };
    }

    this.hardware.ejectDisc();
    try {
      this.inventory.moveOwnedItem(mediaInstanceId, ['inserted'], 'inventory');
    } catch (error) {
      const catalog = PHYSICAL_ITEM_CATALOG[item.catalogItemId];
      if (catalog?.media) {
        this.hardware.insertDisc({
          id: item.instanceId,
          title: catalog.media.title,
          type: catalog.media.type,
          osTarget: catalog.media.osTarget,
        });
      }
      this.invalidateV6Cache();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not eject owned media.',
      };
    }

    this.invalidateV6Cache();
    return { success: true, data: { mediaInstanceId } };
  }

  public prepareOsInstallFromInsertedMedia(): ActionResult<OsInstallPlan> {
    const state = this.getState();
    if (state.player.location !== 'home') {
      return { success: false, error: 'OS installation is only available at your current residence computer.' };
    }
    if (!state.computer.assembled) {
      return { success: false, error: 'Set up the computer before installing an operating system.' };
    }
    if (state.computer.opticalDrives.length === 0) {
      return { success: false, error: 'No optical drive is installed.' };
    }
    if (state.computer.storage.length === 0) {
      return { success: false, error: 'No storage drive is installed.' };
    }

    const mediaInstanceId = state.computer.insertedMediaId;
    if (!mediaInstanceId) {
      return { success: false, error: 'Insert owned bootable OS media first.' };
    }

    const ownedMedia = state.inventory.items.find((item) => item.instanceId === mediaInstanceId);
    if (!ownedMedia || ownedMedia.kind !== 'media' || ownedMedia.location !== 'inserted') {
      return { success: false, error: 'The inserted boot media is not an owned inserted item.' };
    }

    const media = PHYSICAL_ITEM_CATALOG[ownedMedia.catalogItemId]?.media;
    if (!media || media.type !== 'os_installer') {
      return { success: false, error: 'The inserted disc is not bootable OS installer media.' };
    }

    const release = getReleaseById(media.osTarget);
    if (!release) {
      return { success: false, error: `Unknown OS release on installer media: ${media.osTarget}.` };
    }

    const mode: OsInstallMode =
      release.kind === 'patch' || release.kind === 'hotfix'
        ? 'patch'
        : state.os.currentOsId === null
          ? 'fresh'
          : 'upgrade';
    const currentRelease = state.os.currentOsId ? getReleaseById(state.os.currentOsId) : undefined;
    const currentFootprintBytes =
      mode === 'upgrade' && currentRelease
        ? Math.round(currentRelease.installSizeGB * 1_000_000_000)
        : 0;
    const targetFootprintBytes = Math.round(release.installSizeGB * 1_000_000_000);
    const installSizeBytes =
      mode === 'upgrade'
        ? Math.max(0, targetFootprintBytes - currentFootprintBytes)
        : targetFootprintBytes;

    const hardware = this.hardware.getState();
    const eligibilityHardware =
      mode === 'upgrade' && currentRelease
        ? { ...hardware, hddFreeGB: hardware.hddFreeGB + currentRelease.installSizeGB }
        : hardware;
    const eligibility = this.os.canInstall(media.osTarget, eligibilityHardware, state.time.day);
    if (!eligibility.ok) {
      return { success: false, error: eligibility.reasons.join(' ') };
    }

    const primaryStorage = state.computer.storage[0]!;
    if (primaryStorage.freeBytes < installSizeBytes) {
      return {
        success: false,
        error: `Requires ${(installSizeBytes / 1_000_000_000).toFixed(1)}GB additional install space on the primary drive.`,
      };
    }

    const ramFactor = hardware.ramMB < 768 ? 1.6 : hardware.ramMB < 1024 ? 1.2 : 1;
    const durationMinutes = Math.round((18 + release.installSizeGB * 12) * ramFactor);

    return {
      success: true,
      data: {
        targetOs: media.osTarget,
        mediaInstanceId,
        mode,
        durationMinutes,
        installSizeBytes,
        preparedAtTotalMinutes: state.time.totalMinutes,
      },
    };
  }

  public commitOsInstall(plan: OsInstallPlan): ActionResult {
    const fresh = this.prepareOsInstallFromInsertedMedia();
    if (!fresh.success || !fresh.data) {
      return { success: false, error: fresh.error ?? 'OS install preflight failed.' };
    }

    const currentPlan = fresh.data;
    const unchanged =
      currentPlan.targetOs === plan.targetOs &&
      currentPlan.mediaInstanceId === plan.mediaInstanceId &&
      currentPlan.mode === plan.mode &&
      currentPlan.durationMinutes === plan.durationMinutes &&
      currentPlan.installSizeBytes === plan.installSizeBytes;
    if (!unchanged) {
      return { success: false, error: 'The prepared OS installation is stale; run setup preflight again.' };
    }

    const hardwareBefore = this.hardware.getState();
    const computerBefore = this.hardware.getComputerState();
    const displayBefore = this.hardware.getDisplayState();
    const osBefore = this.os.getState();
    const currentRelease = osBefore.currentOsId ? getReleaseById(osBefore.currentOsId) : undefined;
    const hardwareForInstall =
      plan.mode === 'upgrade' && currentRelease
        ? { ...hardwareBefore, hddFreeGB: hardwareBefore.hddFreeGB + currentRelease.installSizeGB }
        : hardwareBefore;

    if (!this.hardware.allocateDiskSpaceBytes(plan.installSizeBytes)) {
      return { success: false, error: 'Could not reserve the required OS install space.' };
    }

    try {
      const result = this.os.beginInstall(
        plan.targetOs,
        hardwareForInstall,
        this.getState().time.day,
        this.getState().time.totalMinutes + plan.durationMinutes,
      );
      if (!result.success) {
        this.hardware.loadState({ computer: computerBefore, display: displayBefore });
        this.os.loadState(osBefore);
        this.invalidateV6Cache();
        return { success: false, error: result.error ?? 'Operating system installation failed.' };
      }

      this.invalidateV6Cache();
      this.advanceGameMinutes(plan.durationMinutes, `Install ${plan.targetOs}`);
      this.invalidateV6Cache();
      return { success: true };
    } catch (error) {
      this.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.os.loadState(osBefore);
      this.invalidateV6Cache();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operating system installation failed.',
      };
    }
  }

  public purchaseStoreItem(
    storeId: 'silicon_spares',
    skuId: string,
  ): ActionResult<StorePurchaseResultData> {
    if (storeId !== 'silicon_spares') {
      return { success: false, error: 'Unknown store.' };
    }

    const sku = HARDWARE_STORE_INVENTORY.find((entry) => entry.id === skuId);
    if (!sku) {
      return { success: false, error: 'Unknown store item.' };
    }

    const policy = this.inventory.canPurchaseSku(sku.id, sku.repeatable);
    if (!policy.ok) {
      return { success: false, error: policy.error ?? 'Purchase is not allowed.' };
    }

    const recovered =
      sku.id === 'bundle_scrapyard' && this.inventory.canClaimLegacyStarterRecovery();
    const charge = recovered ? 0 : sku.price;
    if (!this.economy.canAfford(charge)) {
      return { success: false, error: 'Not enough cash.' };
    }
    const kinds = Object.fromEntries(
      Object.entries(PHYSICAL_ITEM_CATALOG).map(([id, definition]) => [id, definition.kind]),
    ) as Record<string, 'hardware' | 'display' | 'media'>;

    let prepared;
    try {
      prepared = this.inventory.preparePurchase(sku.id, sku.contents, kinds, {
        consumeLegacyStarterRecovery: recovered,
        location: 'room_package',
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase preparation failed.',
      };
    }

    const inventoryBefore = this.inventory.getState();
    try {
      this.inventory.commitPurchase(prepared);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase commit failed.',
      };
    }

    this.invalidateV6Cache();

    const debit = super.dispatchAction({
      type: 'PLAYER_SPEND_CASH',
      amount: charge,
      reason: `Silicon & Spares: ${sku.name}`,
    });
    if (!debit.success) {
      this.inventory.loadState(inventoryBefore);
      this.invalidateV6Cache();
      return { success: false, error: debit.error ?? 'Purchase failed.' };
    }

    return {
      success: true,
      data: {
        purchasedItemIds: prepared.items.map((item) => item.instanceId),
        charged: charge,
        recoveredLegacyPurchase: recovered,
      },
    };
  }

  public setupComputerAtHome(): ActionResult {
    const state = this.getState();
    if (state.player.location !== 'home') {
      return { success: false, error: 'Computer setup is only available at your current residence.' };
    }
    if (state.computer.assembled) {
      return { success: false, error: 'A computer is already assembled.' };
    }

    const roomItems = state.inventory.items.filter((item) => item.location === 'room_package');
    const bundle = HARDWARE_STORE_INVENTORY.find((sku) => {
      if (sku.category !== 'bundle' || !sku.bundleConfig) return false;
      return sku.contents.every(({ catalogItemId, quantity }) => {
        const catalog = PHYSICAL_ITEM_CATALOG[catalogItemId];
        if (!catalog || catalog.kind === 'media') return true;
        return roomItems.filter((item) => item.catalogItemId === catalogItemId).length >= quantity;
      });
    });

    if (!bundle?.bundleConfig) {
      return { success: false, error: 'No complete computer package is ready to set up.' };
    }

    const instanceIds: string[] = [];
    for (const { catalogItemId, quantity } of bundle.contents) {
      const catalog = PHYSICAL_ITEM_CATALOG[catalogItemId];
      if (!catalog || catalog.kind === 'media') continue;
      const matches = roomItems
        .filter((item) => item.catalogItemId === catalogItemId)
        .slice(0, quantity);
      if (matches.length !== quantity) {
        return { success: false, error: 'The computer package is incomplete.' };
      }
      instanceIds.push(...matches.map((item) => item.instanceId));
    }

    let prepared;
    try {
      prepared = this.inventory.prepareInstallOwnedItems(instanceIds);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Computer setup preparation failed.',
      };
    }

    const canonical = legacyModularToCanonical(bundle.bundleConfig.hardware);
    const chassisCatalogId = bundle.contents.find(
      ({ catalogItemId }) => PHYSICAL_ITEM_CATALOG[catalogItemId]?.componentKind === 'chassis',
    )?.catalogItemId;
    const chassis = chassisCatalogId
      ? PHYSICAL_ITEM_CATALOG[chassisCatalogId]?.component
      : undefined;
    if (!chassis || !('id' in chassis) || !('name' in chassis)) {
      return { success: false, error: 'The computer package has no chassis.' };
    }

    const inventoryBefore = this.inventory.getState();
    const computerBefore = this.hardware.getComputerState();
    const displayBefore = this.hardware.getDisplayState();
    try {
      this.inventory.commitInstallOwnedItems(prepared);
      this.hardware.loadState({
        computer: {
          ...canonical.computer,
          chassis: { id: chassis.id, name: chassis.name },
          assembled: true,
          poweredOn: false,
          insertedMediaId: null,
        },
        display: canonical.display,
      });
    } catch (error) {
      this.inventory.loadState(inventoryBefore);
      this.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.invalidateV6Cache();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Computer setup failed.',
      };
    }

    this.invalidateV6Cache();
    this.advanceGameMinutes(15, 'Set up computer at current residence');
    this.invalidateV6Cache();
    return { success: true };
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
    this.inventory.loadState(snapshot.inventory ?? createEmptyInventoryState());

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
    this.encounterDirector = hydrateEncounterDirectorState(snapshot.encounters ?? {});
  }
}
