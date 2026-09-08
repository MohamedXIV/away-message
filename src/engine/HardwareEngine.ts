import type {
  ComputerSetupState,
  ConnectionType,
  DisplaySetupState,
  HardwareState,
  RamPressure,
  SoftwareRequirement,
} from './types';
import { EventBus } from './EventBus';
import type { InsertedDisc, ModularHardwareState, RamStickComponent } from './hardware/types';
import {
  canonicalToLegacyModular,
  createEmptyComputerSetup,
  createEmptyDisplaySetup,
  legacyModularToCanonical,
  projectEffectiveHardware,
} from './hardware/state';

interface HardwareEngineInitialState {
  computer?: Partial<ComputerSetupState>;
  display?: Partial<DisplaySetupState>;
}

function cloneComputer(state: ComputerSetupState): ComputerSetupState {
  return {
    ...state,
    chassis: state.chassis ? { ...state.chassis } : null,
    motherboard: state.motherboard ? { ...state.motherboard } : null,
    cpu: state.cpu ? { ...state.cpu } : null,
    ramSticks: state.ramSticks.map((stick) => ({ ...stick })),
    storage: state.storage.map((drive) => ({ ...drive })),
    opticalDrives: state.opticalDrives.map((drive) => ({ ...drive })),
    soundCard: state.soundCard ? { ...state.soundCard } : null,
    networkCard: state.networkCard ? { ...state.networkCard } : null,
  };
}

function cloneDisplay(state: DisplaySetupState): DisplaySetupState {
  return { monitor: state.monitor ? { ...state.monitor } : null };
}

export class HardwareEngine {
  private computer: ComputerSetupState;
  private display: DisplaySetupState;
  private eventBus: EventBus;

  /**
   * @deprecated SimulationEngineCore-only compatibility sink. Two preserved
   * legacy coordinator writes still assign `state.osVersion`; no v6 reader,
   * projection, or persistence path consumes it. Per-instance ownership avoids
   * a shared prototype/global shadow while the coordinator remains preserved.
   */
  public readonly state: { osVersion?: unknown } = {};

  /**
   * Temporary metadata cache for legacy insert/eject callers. The canonical
   * computer stores only insertedMediaId; inventory/media ownership moves to
   * the dedicated media flow in #9.
   */
  private legacyInsertedDisc: InsertedDisc | null = null;

  constructor(eventBus: EventBus, initialState?: HardwareEngineInitialState) {
    this.eventBus = eventBus;

    const emptyComputer = createEmptyComputerSetup();
    const computer = initialState?.computer;
    this.computer = {
      ...emptyComputer,
      ...computer,
      chassis: computer?.chassis ? { ...computer.chassis } : null,
      motherboard: computer?.motherboard ? { ...computer.motherboard } : null,
      cpu: computer?.cpu ? { ...computer.cpu } : null,
      ramSticks: computer?.ramSticks?.map((stick) => ({ ...stick })) ?? [],
      storage: computer?.storage?.map((drive) => ({ ...drive })) ?? [],
      opticalDrives: computer?.opticalDrives?.map((drive) => ({ ...drive })) ?? [],
      soundCard: computer?.soundCard ? { ...computer.soundCard } : null,
      networkCard: computer?.networkCard ? { ...computer.networkCard } : null,
      insertedMediaId: computer?.insertedMediaId ?? null,
    };

    const emptyDisplay = createEmptyDisplaySetup();
    const display = initialState?.display;
    this.display = {
      ...emptyDisplay,
      ...display,
      monitor: display?.monitor ? { ...display.monitor } : null,
    };
  }

  public getComputerState(): Readonly<ComputerSetupState> {
    return cloneComputer(this.computer);
  }

  public getDisplayState(): Readonly<DisplaySetupState> {
    return cloneDisplay(this.display);
  }

  /** @deprecated #7 adapter for catalog/store callers that still expect v5 shape. */
  public getModularState(): ModularHardwareState | undefined {
    const modular = canonicalToLegacyModular(this.computer, this.display);
    if (!modular) return undefined;
    return {
      ...modular,
      insertedDisc:
        this.legacyInsertedDisc && this.legacyInsertedDisc.id === this.computer.insertedMediaId
          ? { ...this.legacyInsertedDisc }
          : null,
    };
  }

  /**
   * @deprecated #7 bridge only. The legacy OS argument is intentionally
   * ignored: installing physical hardware cannot install an operating system.
   */
  public installModularHardware(modular: ModularHardwareState, _ignoredLegacyOs?: unknown): void {
    const previous = projectEffectiveHardware(this.computer);
    const canonical = legacyModularToCanonical(modular);
    this.computer = cloneComputer(canonical.computer);
    this.display = cloneDisplay(canonical.display);
    this.legacyInsertedDisc = modular.insertedDisc ? { ...modular.insertedDisc } : null;

    const next = projectEffectiveHardware(this.computer);
    this.eventBus.emit('hardware:upgraded', {
      component: 'Computer System',
      oldValue: previous.hasComputer ? previous.cpuName : 'None',
      newValue: next.hasComputer ? next.cpuName : 'None',
    });
    this.eventBus.emit('hardware:upgraded', {
      component: 'Display',
      oldValue: null,
      newValue: this.display.monitor?.name ?? 'None',
    });
  }

  public insertDisc(disc: InsertedDisc): boolean {
    if (!this.computer.assembled || this.computer.opticalDrives.length === 0) return false;
    this.computer = { ...this.computer, insertedMediaId: disc.id };
    this.legacyInsertedDisc = { ...disc };
    this.eventBus.emit('hardware:disc_inserted', { disc: { ...disc } });
    return true;
  }

  public ejectDisc(): InsertedDisc | null {
    if (!this.computer.insertedMediaId) return null;
    const disc =
      this.legacyInsertedDisc && this.legacyInsertedDisc.id === this.computer.insertedMediaId
        ? { ...this.legacyInsertedDisc }
        : null;
    this.computer = { ...this.computer, insertedMediaId: null };
    this.legacyInsertedDisc = null;
    this.eventBus.emit('hardware:disc_ejected', {});
    return disc;
  }

  public setPower(isPoweredOn: boolean): void {
    const nextPower = this.computer.assembled ? isPoweredOn : false;
    this.computer = { ...this.computer, poweredOn: nextPower };
    this.eventBus.emit('hardware:power_changed', { isPoweredOn: nextPower });
  }

  /** Derived compatibility projection. Never persist/restore this as v6 authority. */
  public getState(): Readonly<HardwareState> {
    return projectEffectiveHardware(this.computer);
  }

  public checkHardwareRequirements(
    req: Pick<SoftwareRequirement, 'minRamMB' | 'minCpuTier' | 'requiredDiskBytes'>,
  ): { compatible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const effective = projectEffectiveHardware(this.computer);

    if (!this.computer.assembled) {
      reasons.push('No computer installed.');
      return { compatible: false, reasons };
    }

    if (effective.ramMB < req.minRamMB) {
      reasons.push(`Requires at least ${req.minRamMB} MB RAM (Installed: ${effective.ramMB} MB).`);
    }
    if (effective.cpuTier < req.minCpuTier) {
      reasons.push(`Requires CPU Tier ${req.minCpuTier} or higher.`);
    }

    const freeBytes = Math.max(0, this.computer.storage[0]?.freeBytes ?? 0);
    if (freeBytes < req.requiredDiskBytes) {
      const requiredGB = req.requiredDiskBytes / (1024 * 1024 * 1024);
      const freeGB = freeBytes / (1024 * 1024 * 1024);
      reasons.push(`Insufficient disk space. Requires ${requiredGB.toFixed(2)} GB (Free: ${freeGB.toFixed(2)} GB).`);
    }

    return { compatible: reasons.length === 0, reasons };
  }

  /** @deprecated callers should combine this physical check with OsEngine compatibility. */
  public checkRequirements(req: SoftwareRequirement): { compatible: boolean; reasons: string[] } {
    return this.checkHardwareRequirements(req);
  }

  public calculateRamPressure(runningAppsMemoryMB: number, osBaselineMB: number): RamPressure {
    const totalRamMB = projectEffectiveHardware(this.computer).ramMB;
    const usedRamMB = Math.max(0, osBaselineMB) + Math.max(0, runningAppsMemoryMB);
    const freeRamMB = Math.max(0, totalRamMB - usedRamMB);
    const pressureRatio = totalRamMB > 0 ? usedRamMB / totalRamMB : usedRamMB > 0 ? 1 : 0;

    let status: RamPressure['status'] = 'nominal';
    if (pressureRatio >= 0.9) status = 'critical';
    else if (pressureRatio >= 0.75) status = 'elevated';

    return { totalRamMB, usedRamMB, freeRamMB, pressureRatio, status };
  }

  /** @deprecated #7 part-store bridge for the old absolute-RAM action. */
  public upgradeRam(newRamMB: number): boolean {
    if (!this.computer.assembled || !this.computer.motherboard) return false;
    const currentRamMB = projectEffectiveHardware(this.computer).ramMB;
    if (!Number.isFinite(newRamMB) || newRamMB <= currentRamMB) return false;

    const { ramSlots, maxRamMbPerSlot } = this.computer.motherboard;
    if (newRamMB > ramSlots * maxRamMbPerSlot) return false;

    const sticks: RamStickComponent[] = [];
    let remaining = Math.round(newRamMB);
    for (let slot = 0; slot < ramSlots && remaining > 0; slot += 1) {
      const sizeMb = Math.min(maxRamMbPerSlot, remaining);
      sticks.push({
        id: `ram_legacy_upgrade_${sizeMb}_${slot}`,
        name: `${sizeMb}MB SDRAM`,
        sizeMb,
      });
      remaining -= sizeMb;
    }
    if (remaining > 0) return false;

    this.computer = { ...this.computer, ramSticks: sticks };
    this.eventBus.emit('hardware:upgraded', {
      component: 'RAM',
      oldValue: `${currentRamMB}MB`,
      newValue: `${newRamMB}MB`,
    });
    return true;
  }

  /** @deprecated #7 bridge for old connection-upgrade actions. */
  public upgradeConnection(newType: ConnectionType): boolean {
    if (!this.computer.assembled) return false;
    const speedMap: Record<ConnectionType, number> = {
      dialup_56k: 56,
      dsl_256k: 256,
      dsl_512k: 512,
      dsl_1m: 1024,
    };
    const oldType = projectEffectiveHardware(this.computer).connectionType;
    this.computer = {
      ...this.computer,
      networkCard: {
        id: `nic_legacy_${newType}`,
        name: newType === 'dialup_56k' ? 'V.90 56k Dial-Up Voice/Fax Modem' : 'PCI Fast Ethernet Adapter',
        type: newType,
        speedKbps: speedMap[newType],
      },
    };
    this.eventBus.emit('hardware:upgraded', {
      component: 'Internet',
      oldValue: oldType,
      newValue: newType,
    });
    return true;
  }

  public allocateDiskSpaceBytes(bytes: number): boolean {
    if (!Number.isFinite(bytes) || bytes < 0 || !this.computer.assembled) return false;
    const primary = this.computer.storage[0];
    if (!primary || primary.freeBytes < bytes) return false;
    const storage = this.computer.storage.map((drive, index) =>
      index === 0 ? { ...drive, freeBytes: drive.freeBytes - bytes } : { ...drive },
    );
    this.computer = { ...this.computer, storage };
    return true;
  }

  public freeDiskSpaceBytes(bytes: number): void {
    if (!Number.isFinite(bytes) || bytes <= 0 || !this.computer.assembled) return;
    const primary = this.computer.storage[0];
    if (!primary) return;
    const storage = this.computer.storage.map((drive, index) =>
      index === 0
        ? { ...drive, freeBytes: Math.min(drive.capacityBytes, drive.freeBytes + bytes) }
        : { ...drive },
    );
    this.computer = { ...this.computer, storage };
  }

  public loadState(state: HardwareEngineInitialState): void {
    const emptyComputer = createEmptyComputerSetup();
    const computer = state.computer;
    this.computer = {
      ...emptyComputer,
      ...computer,
      chassis: computer?.chassis ? { ...computer.chassis } : null,
      motherboard: computer?.motherboard ? { ...computer.motherboard } : null,
      cpu: computer?.cpu ? { ...computer.cpu } : null,
      ramSticks: computer?.ramSticks?.map((stick) => ({ ...stick })) ?? [],
      storage: computer?.storage?.map((drive) => ({ ...drive })) ?? [],
      opticalDrives: computer?.opticalDrives?.map((drive) => ({ ...drive })) ?? [],
      soundCard: computer?.soundCard ? { ...computer.soundCard } : null,
      networkCard: computer?.networkCard ? { ...computer.networkCard } : null,
      insertedMediaId: computer?.insertedMediaId ?? null,
    };

    const emptyDisplay = createEmptyDisplaySetup();
    const display = state.display;
    this.display = {
      ...emptyDisplay,
      ...display,
      monitor: display?.monitor ? { ...display.monitor } : null,
    };
    this.legacyInsertedDisc = null;
  }
}
