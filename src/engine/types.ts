// Transitional compatibility facade for the preserved SimulationEngineCore.
// Canonical v6 contracts live in ./types/index.ts. New v6 code should import
// directly from ./types/index when it needs strict computer/display/inventory roots.

export * from './types/index';

import type {
  ComputerSetupState,
  DisplaySetupState,
  HardwareState as CanonicalHardwareState,
  OsVersion,
  PlayerInventoryState,
  SimulationAction as CanonicalSimulationAction,
  SimulationEventMap as CanonicalSimulationEventMap,
  SimulationState as CanonicalSimulationState,
} from './types/index';
import type { ModularHardwareState } from './hardware/types';

/**
 * Compile-only bridge for code that still carries the former flat hardware bag.
 * Runtime HardwareEngine projections never emit any of these deprecated fields.
 */
export type HardwareState = CanonicalHardwareState & {
  /** @deprecated v5 migration/catalog compatibility only. */
  modular?: ModularHardwareState;
  /** @deprecated compatibility only; OsEngine is the sole OS authority. */
  osVersion?: OsVersion;
  /** @internal bridge used only to seed HardwareEngine from the v6 facade. */
  computer?: ComputerSetupState;
  /** @internal bridge used only to seed HardwareEngine from the v6 facade. */
  display?: DisplaySetupState;
};

/**
 * Transport compatibility for pre-v6/core code. Live SimulationEngine returns
 * StrictSimulationState below, where all three canonical roots are required.
 */
export type SimulationState = Omit<
  CanonicalSimulationState,
  'hardware' | 'computer' | 'display' | 'inventory'
> & {
  hardware: HardwareState;
  computer?: ComputerSetupState;
  display?: DisplaySetupState;
  inventory?: PlayerInventoryState;
};

export type StrictSimulationState = Omit<
  CanonicalSimulationState,
  'hardware'
> & {
  hardware: CanonicalHardwareState;
};

/** Live v6 actions layered over the preserved coordinator action union. */
export type SimulationAction =
  | CanonicalSimulationAction
  | { type: 'COMPUTER_SETUP_AT_HOME' };

/** Nullable previous OS is valid for a first installation. */
export type SimulationEventMap = Omit<CanonicalSimulationEventMap, 'hardware:os_migrated'> & {
  'hardware:os_migrated': { from: OsVersion | null; to: OsVersion };
};
