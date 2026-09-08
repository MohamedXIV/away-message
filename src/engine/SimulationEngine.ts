// Canonical v6 simulation facade.
//
// The large gameplay coordinator is intentionally preserved in
// SimulationEngineCore.ts so the computer/OS migration cannot accidentally
// rewrite unrelated social/world/economy behavior. This facade owns the v6
// canonical roots and narrows the remaining legacy compatibility to one place.

import { InventoryEngine } from './InventoryEngine';
import { SimulationEngine as SimulationEngineCore } from './SimulationEngineCore';
import {
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  createEmptyInventoryState,
} from './hardware/state';
import type {
  HardwareState as CanonicalHardwareState,
  SimulationState as CanonicalSimulationState,
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
      // HardwareEngine consumes these hidden compatibility roots and derives
      // the flat projection. They never survive HardwareEngine.getState().
      hardware: {
        ...(initialState?.hardware ?? ({} as CanonicalHardwareState)),
        computer,
        display,
      },
      os: initialState?.os ?? {
        currentOsId: null,
        installedPatchIds: [],
      },
      // No OS means no browser or other ghost preinstalled software.
      installedSoftware,
    };

    super(coreInitial);
    this.inventory = new InventoryEngine(initialState?.inventory ?? createEmptyInventoryState());
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
    return JSON.parse(JSON.stringify(this.getState())) as LiveSimulationState;
  }

  public override dispatchAction(action: SimulationAction) {
    if (action.type === 'HARDWARE_UPGRADE_OS' && this.os.getCurrentOsId() === null) {
      return {
        success: false,
        error: 'No operating system is installed. Boot from setup media to install one.',
      };
    }

    return super.dispatchAction(action);
  }

  public override loadSnapshot(snapshot: TransportSimulationState): void {
    const computer = snapshot.computer ?? createEmptyComputerSetup();
    const display = snapshot.display ?? createEmptyDisplaySetup();
    this.inventory.loadState(snapshot.inventory ?? createEmptyInventoryState());

    this.v6CachedBase = null;
    this.v6CachedState = null;

    // The preserved core already restores clock/economy/world/VFS/social state
    // correctly. Supply canonical computer/display roots through its one
    // compatibility boundary so HardwareEngine.loadState receives real v6
    // authority rather than the derived flat projection.
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
