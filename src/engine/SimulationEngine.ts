// Canonical v6 simulation facade.
//
// The large gameplay coordinator is intentionally preserved in
// SimulationEngineCore.ts so the computer/OS migration cannot accidentally
// rewrite unrelated social/world/economy behavior. This facade owns the v6
// canonical roots and narrows the remaining legacy compatibility to one place.

import { InventoryEngine } from './InventoryEngine';
import { HARDWARE_STORE_INVENTORY, PHYSICAL_ITEM_CATALOG } from './hardware/catalog';
import { resolveRoomComputerAssembly } from './hardware/assembleOwnedComputer';
import { SimulationEngine as SimulationEngineCore } from './SimulationEngineCore';
import {
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  createEmptyInventoryState,
} from './hardware/state';
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

  private v6CachedBase: Readonly<TransportSimulationState> | null = null;
  private v6CachedState: Readonly<LiveSimulationState> | null = null;

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
    this.inventory = new InventoryEngine(initialState?.inventory ?? createEmptyInventoryState());
  }

  private invalidateV6Cache(): void {
    this.v6CachedBase = null;
    this.v6CachedState = null;
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
    } as LiveSimulationState;

    this.invalidateV6Cache();
    return JSON.parse(JSON.stringify(snapshot)) as LiveSimulationState;
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
    const currentComputer = this.hardware.getComputerState();
    if (currentComputer.assembled) {
      return { success: false, error: 'A computer is already set up in Room 104.' };
    }

    const resolved = resolveRoomComputerAssembly(this.inventory.getState().items);
    if (!resolved.ok) return { success: false, error: resolved.error };

    let preparedInstall;
    try {
      preparedInstall = this.inventory.prepareInstallOwnedItems(resolved.assembly.instanceIds);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Computer setup preparation failed.',
      };
    }

    const inventoryBefore = this.inventory.getState();
    const computerBefore = this.hardware.getComputerState();
    const displayBefore = this.hardware.getDisplayState();

    try {
      this.inventory.commitInstallOwnedItems(preparedInstall);
      this.hardware.loadState({
        computer: resolved.assembly.computer,
        display: resolved.assembly.display,
      });
      this.invalidateV6Cache();

      const timeResult = super.dispatchAction({
        type: 'TIME_ADVANCE_MINUTES',
        minutes: 15,
        reason: 'Set up computer in Room 104',
      });
      if (!timeResult.success) {
        throw new Error(timeResult.error ?? 'Unable to advance setup time.');
      }
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
    return { success: true };
  }

  public setComputerPower(poweredOn: boolean): ActionResult {
    const computer = this.hardware.getComputerState();
    if (!computer.assembled) {
      return { success: false, error: 'No assembled computer is available to power on.' };
    }

    this.hardware.setPower(poweredOn);
    this.invalidateV6Cache();
    return { success: true };
  }

  public override dispatchAction(action: SimulationAction) {
    if (action.type === 'STORE_PURCHASE_ITEM') {
      return this.purchaseStoreItem(action.storeId, action.skuId);
    }

    if (action.type === 'COMPUTER_SETUP_AT_HOME') {
      return this.setupComputerAtHome();
    }

    if (action.type === 'COMPUTER_SET_POWER') {
      return this.setComputerPower(action.poweredOn);
    }

    if (action.type === 'HARDWARE_UPGRADE_OS' && this.os.getCurrentOsId() === null) {
      return {
        success: false,
        error: 'No operating system is installed. Boot from setup media to install one.',
      };
    }

    return super.dispatchAction(action as Parameters<SimulationEngineCore['dispatchAction']>[0]);
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
  }
}
