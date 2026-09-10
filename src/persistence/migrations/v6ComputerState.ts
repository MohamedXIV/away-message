import type {
  ComputerSetupState,
  OsEngineState,
  OwnedItem,
  PlayerInventoryState,
  SimulationState,
  StrictSimulationState,
} from '../../engine/types';
import type { InsertedDisc, ModularHardwareState } from '../../engine/hardware/types';
import {
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  legacyFlatHardwareToCanonical,
  legacyModularToCanonical,
  projectEffectiveHardware,
  type LegacyV5HardwareLike,
} from '../../engine/hardware/state';

type LegacyHardware = LegacyV5HardwareLike & {
  modular?: ModularHardwareState;
  osVersion?: string;
};

type LegacySnapshot = SimulationState & {
  hardware: SimulationState['hardware'] & LegacyHardware;
};

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function getLegacyHardware(snapshot: SimulationState): LegacyHardware {
  return ((snapshot as unknown as { hardware?: LegacyHardware }).hardware ?? {}) as LegacyHardware;
}

function getLegacyOs(snapshot: SimulationState): Partial<OsEngineState> {
  return clone((snapshot as unknown as { os?: Partial<OsEngineState> }).os ?? {});
}

function hasWorkingComputer(hardware: LegacyHardware): boolean {
  if (hardware.hasComputer === false) return false;
  if (hardware.hasComputer === true) return true;
  return Boolean(hardware.modular?.hasComputer);
}

function hasAnyModularComputer(hardware: LegacyHardware): boolean {
  return Boolean(hardware.modular?.hasComputer);
}

function ownershipForComputer(
  computer: ComputerSetupState,
  monitorId: string | null,
): OwnedItem[] {
  const items: OwnedItem[] = [];
  const add = (
    instanceId: string,
    catalogItemId: string | undefined,
    kind: OwnedItem['kind'] = 'hardware',
  ) => {
    if (!catalogItemId) return;
    items.push({ instanceId, catalogItemId, kind, location: 'installed' });
  };

  add('migrated:chassis:0', computer.chassis?.id);
  add('migrated:motherboard:0', computer.motherboard?.id);
  add('migrated:cpu:0', computer.cpu?.id);
  computer.ramSticks.forEach((stick, index) => add(`migrated:ram:${index}`, stick.id));
  computer.storage.forEach((drive, index) => add(`migrated:storage:${index}`, drive.id));
  computer.opticalDrives.forEach((drive, index) => add(`migrated:optical:${index}`, drive.id));
  add('migrated:sound:0', computer.soundCard?.id);
  add('migrated:network:0', computer.networkCard?.id);
  if (monitorId) add('migrated:monitor:0', monitorId, 'display');

  return items;
}

function migratedOsState(
  snapshot: SimulationState,
  hardware: LegacyHardware,
  workingComputer: boolean,
): OsEngineState {
  const legacy = getLegacyOs(snapshot);
  const patches = Array.isArray(legacy.installedPatchIds)
    ? [...legacy.installedPatchIds]
    : [];

  if (!workingComputer) {
    return {
      ...legacy,
      currentOsId: null,
      installedPatchIds: [],
      pendingReboot: false,
    } as OsEngineState;
  }

  const dedicated = legacy.currentOsId ?? null;
  const hardwareOs = typeof hardware.osVersion === 'string' && hardware.osVersion.length > 0
    ? hardware.osVersion
    : null;

  return {
    ...legacy,
    currentOsId: dedicated ?? hardwareOs,
    installedPatchIds: patches,
  } as OsEngineState;
}

/**
 * Detect only the specific Day-1 branch bug where the $35 starter purchase
 * deducted cash but never produced a computer. This marker grants no item by
 * itself; #7 consumes it exactly once inside the real purchase transaction.
 */
export function isRecoverableBrokenStarterPurchase(
  snapshot: SimulationState,
  fromVersion: number,
): boolean {
  if (fromVersion !== 5) return false;

  const hardware = getLegacyHardware(snapshot);
  const day = Number((snapshot as unknown as { time?: { day?: unknown } }).time?.day);
  const cash = Number((snapshot as unknown as { player?: { cash?: unknown } }).player?.cash);
  const os = getLegacyOs(snapshot);
  const cashCents = Number.isFinite(cash) ? Math.round(cash * 100) : Number.NaN;

  if (day !== 1 || cashCents !== 300) return false;
  if (hardware.hasComputer === true || hasAnyModularComputer(hardware)) return false;
  if (os.lastInstallAtMinute !== undefined && os.lastInstallAtMinute !== null) return false;
  if (Array.isArray(os.installedPatchIds) && os.installedPatchIds.length > 0) return false;

  return true;
}

/** Pure, deterministic v5 snapshot -> v6 canonical computer state migration. */
export function migrateSnapshotToV6(
  snapshot: SimulationState,
  fromVersion: number,
): StrictSimulationState {
  if (fromVersion >= 6) return clone(snapshot) as StrictSimulationState;

  const source = clone(snapshot) as LegacySnapshot;
  const hardware = getLegacyHardware(source);
  const workingComputer = hasWorkingComputer(hardware);

  let computer = createEmptyComputerSetup();
  let display = createEmptyDisplaySetup();
  const inventory: PlayerInventoryState = { items: [], purchaseCounts: {} };

  if (workingComputer) {
    const canonical = hardware.modular
      ? legacyModularToCanonical(hardware.modular)
      : legacyFlatHardwareToCanonical(hardware);

    computer = canonical.computer;
    display = canonical.display;
    inventory.items = ownershipForComputer(computer, display.monitor?.id ?? null);

    const insertedDisc = hardware.modular?.insertedDisc as InsertedDisc | null | undefined;
    if (insertedDisc?.id) {
      const mediaInstanceId = 'migrated:media:inserted';
      computer = { ...computer, insertedMediaId: mediaInstanceId };
      inventory.items.push({
        instanceId: mediaInstanceId,
        catalogItemId: insertedDisc.id,
        kind: 'media',
        location: 'inserted',
      });
    } else {
      computer = { ...computer, insertedMediaId: null };
    }
  }

  if (isRecoverableBrokenStarterPurchase(source, fromVersion)) {
    inventory.legacyRecovery = {
      starterBundlePurchaseLost: true,
      consumed: false,
    };
  }

  const os = migratedOsState(source, hardware, workingComputer);

  return {
    ...(source as object),
    hardware: projectEffectiveHardware(computer),
    computer,
    display,
    inventory,
    os,
  } as StrictSimulationState;
}
