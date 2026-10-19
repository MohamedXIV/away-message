import { InventoryEngine, type HardwareInstallSlot } from '../InventoryEngine';
import { HARDWARE_STORE_INVENTORY, PHYSICAL_ITEM_CATALOG } from '../hardware/catalog';
import { getReleaseById } from '../OsCatalog';
import { createEmptyInventoryState, legacyModularToCanonical } from '../hardware/state';
import type { CoreDomainOwners } from './CoreDomainOwners';
import type { PlayerInventoryState } from '../types';
import type {
  ActionResult,
  OsVersion,
  SimulationState as LiveSimulationState,
  StorePurchaseResultData,
} from '../types/index';

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

/** Shared boot semantics for explicit snapshots and scalar live owner reads. */
export function resolvePcBootStateFromOwnerStatus(
  computer: { assembled: boolean; poweredOn: boolean },
  currentOsId: OsVersion | null,
  hasUnassembledComputerItems: () => boolean,
): PcBootState {
  if (!computer.assembled) {
    return hasUnassembledComputerItems() ? 'awaiting_setup' : 'no_computer';
  }
  if (!computer.poweredOn) return 'powered_off';
  if (!currentOsId) return 'no_boot_device';
  return 'desktop';
}

export function resolvePcBootState(
  state: Pick<LiveSimulationState, 'computer' | 'inventory' | 'os'>,
): PcBootState {
  return resolvePcBootStateFromOwnerStatus(
    state.computer,
    state.os.currentOsId,
    () => state.inventory.items.some(item =>
      item.location === 'room_package' &&
      (item.kind === 'hardware' || item.kind === 'display')),
  );
}


/**
 * Single owner of owned PC inventory, device setup, removable media and
 * disk-backed OS installation transactions.
 *
 * HardwareEngine and OsEngine remain the sole truth for the actual machine
 * and software platform; Economy owns cash. This runtime owns only the
 * existing InventoryEngine instance and coordinates atomic cross-domain
 * transactions. It neither owns nor ticks a second simulation.
 *
 * The legacy public facade is a temporary delegation seam on unmerged #171.
 */
export class ComputerOwnershipRuntime {
  public readonly inventory: InventoryEngine;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'hardware' | 'os' | 'economy' | 'clock'>,
    private readonly advanceMinutes: (minutes: number, reason: string) => void,
    private readonly chargeCash: (amount: number, reason: string) => ActionResult,
    private readonly invalidate: () => void,
    initialInventory?: Partial<PlayerInventoryState>,
  ) {
    this.inventory = new InventoryEngine(initialInventory ?? createEmptyInventoryState());
  }

  public loadInventory(state?: PlayerInventoryState): void {
    this.inventory.loadState(state ?? createEmptyInventoryState());
    this.invalidate();
  }

  /** Narrow owner projection, never an assembled simulation/world snapshot. */
  private readOwnedContext() {
    return {
      location: this.owners.economy.getLocation(),
      computer: this.owners.hardware.getComputerState(),
      display: this.owners.hardware.getDisplayState(),
      inventory: this.inventory.getState(),
      os: this.owners.os.getState(),
      time: this.owners.clock.getTime(),
    };
  }

  public getPcBootState(): PcBootState {
    return resolvePcBootState(this.readOwnedContext());
  }

  public setComputerPower(poweredOn: boolean): ActionResult {
    if (!this.owners.hardware.getComputerState().assembled) {
      return { success: false, error: 'Set up the computer at your current residence before powering it on.' };
    }

    this.owners.hardware.setPower(poweredOn);
    this.invalidate();
    return { success: true };
  }

  public installOwnedHardwareAtHome(
    instanceId: string,
    slot: HardwareInstallSlot,
  ): ActionResult {
    const state = this.readOwnedContext();
    if (state.location !== 'home') {
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
    const computerBefore = this.owners.hardware.getComputerState();
    const displayBefore = this.owners.hardware.getDisplayState();

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
        this.owners.hardware.loadState({
          computer: { ...computerBefore, ramSticks },
          display: displayBefore,
        });
      } else if (isCpuSlot) {
        const cpu = component as NonNullable<typeof computerBefore.cpu>;
        this.owners.hardware.loadState({
          computer: { ...computerBefore, cpu: { ...cpu } },
          display: displayBefore,
        });
      } else if (isNetworkSlot) {
        const networkCard = component as NonNullable<typeof computerBefore.networkCard>;
        this.owners.hardware.loadState({
          computer: { ...computerBefore, networkCard: { ...networkCard } },
          display: displayBefore,
        });
      } else if (isSoundSlot) {
        const soundCard = component as NonNullable<typeof computerBefore.soundCard>;
        this.owners.hardware.loadState({
          computer: { ...computerBefore, soundCard: { ...soundCard } },
          display: displayBefore,
        });
      } else if (isActiveOpticalSlot) {
        const opticalDrive = component as (typeof computerBefore.opticalDrives)[number];
        const opticalDrives = computerBefore.opticalDrives.map((drive) => ({ ...drive }));
        opticalDrives[0] = { ...opticalDrive };
        this.owners.hardware.loadState({
          computer: { ...computerBefore, opticalDrives },
          display: displayBefore,
        });
      } else {
        const monitor = component as NonNullable<typeof state.display.monitor>;
        this.owners.hardware.loadState({
          computer: computerBefore,
          display: { monitor: { ...monitor } },
        });
      }
    } catch (error) {
      this.inventory.loadState(inventoryBefore);
      this.owners.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.invalidate();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hardware installation failed.',
      };
    }

    this.invalidate();
    return { success: true };
  }

  public insertOwnedMediaAtHome(instanceId: string): ActionResult {
    const state = this.readOwnedContext();
    if (state.location !== 'home') {
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

    const inserted = this.owners.hardware.insertDisc({
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
      this.owners.hardware.ejectDisc();
      this.invalidate();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not insert owned media.',
      };
    }

    this.invalidate();
    return { success: true };
  }

  public ejectOwnedMediaAtHome(): ActionResult<{ mediaInstanceId: string }> {
    const state = this.readOwnedContext();
    if (state.location !== 'home') {
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

    this.owners.hardware.ejectDisc();
    try {
      this.inventory.moveOwnedItem(mediaInstanceId, ['inserted'], 'inventory');
    } catch (error) {
      const catalog = PHYSICAL_ITEM_CATALOG[item.catalogItemId];
      if (catalog?.media) {
        this.owners.hardware.insertDisc({
          id: item.instanceId,
          title: catalog.media.title,
          type: catalog.media.type,
          osTarget: catalog.media.osTarget,
        });
      }
      this.invalidate();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not eject owned media.',
      };
    }

    this.invalidate();
    return { success: true, data: { mediaInstanceId } };
  }

  public prepareOsInstallFromInsertedMedia(): ActionResult<OsInstallPlan> {
    const state = this.readOwnedContext();
    if (state.location !== 'home') {
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

    const hardware = this.owners.hardware.getState();
    const eligibilityHardware =
      mode === 'upgrade' && currentRelease
        ? { ...hardware, hddFreeGB: hardware.hddFreeGB + currentRelease.installSizeGB }
        : hardware;
    const eligibility = this.owners.os.canInstall(media.osTarget, eligibilityHardware, state.time.day);
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

    const hardwareBefore = this.owners.hardware.getState();
    const computerBefore = this.owners.hardware.getComputerState();
    const displayBefore = this.owners.hardware.getDisplayState();
    const osBefore = this.owners.os.getState();
    const currentRelease = osBefore.currentOsId ? getReleaseById(osBefore.currentOsId) : undefined;
    const hardwareForInstall =
      plan.mode === 'upgrade' && currentRelease
        ? { ...hardwareBefore, hddFreeGB: hardwareBefore.hddFreeGB + currentRelease.installSizeGB }
        : hardwareBefore;

    if (!this.owners.hardware.allocateDiskSpaceBytes(plan.installSizeBytes)) {
      return { success: false, error: 'Could not reserve the required OS install space.' };
    }

    try {
      const result = this.owners.os.beginInstall(
        plan.targetOs,
        hardwareForInstall,
        this.owners.clock.getTime().day,
        this.owners.clock.getTotalMinutes() + plan.durationMinutes,
      );
      if (!result.success) {
        this.owners.hardware.loadState({ computer: computerBefore, display: displayBefore });
        this.owners.os.loadState(osBefore);
        this.invalidate();
        return { success: false, error: result.error ?? 'Operating system installation failed.' };
      }

      this.invalidate();
      this.advanceMinutes(plan.durationMinutes, `Install ${plan.targetOs}`);
      this.invalidate();
      return { success: true };
    } catch (error) {
      this.owners.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.owners.os.loadState(osBefore);
      this.invalidate();
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
    if (!this.owners.economy.canAfford(charge)) {
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

    this.invalidate();

    const debit = this.chargeCash(charge, `Silicon & Spares: ${sku.name}`);
    if (!debit.success) {
      this.inventory.loadState(inventoryBefore);
      this.invalidate();
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
    const state = this.readOwnedContext();
    if (state.location !== 'home') {
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
    const computerBefore = this.owners.hardware.getComputerState();
    const displayBefore = this.owners.hardware.getDisplayState();
    try {
      this.inventory.commitInstallOwnedItems(prepared);
      this.owners.hardware.loadState({
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
      this.owners.hardware.loadState({ computer: computerBefore, display: displayBefore });
      this.invalidate();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Computer setup failed.',
      };
    }

    this.invalidate();
    this.advanceMinutes(15, 'Set up computer at current residence');
    this.invalidate();
    return { success: true };
  }

}
