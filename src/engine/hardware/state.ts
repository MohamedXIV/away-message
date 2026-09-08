// src/engine/hardware/state.ts
// Canonical v6 computer/display state factories and pure legacy conversion helpers.

import type {
  ComputerSetupState,
  ConnectionType,
  DisplaySetupState,
  HardwareState,
  PlayerInventoryState,
} from '../types';
import type { ModularHardwareState } from './types';

const LEGACY_CHASSIS = {
  id: 'chassis_legacy_beige_atx',
  name: 'Beige ATX Chassis',
} as const;

export interface LegacyV5HardwareLike {
  hasComputer?: boolean;
  isPoweredOn?: boolean;
  cpuTier?: number;
  cpuName?: string;
  ramMB?: number;
  hddTotalGB?: number;
  hddFreeGB?: number;
  connectionType?: ConnectionType;
  connectionSpeedKbps?: number;
  soundCardInstalled?: boolean;
  modular?: ModularHardwareState;
}

export function createEmptyComputerSetup(): ComputerSetupState {
  return {
    assembled: false,
    poweredOn: false,
    chassis: null,
    motherboard: null,
    cpu: null,
    ramSticks: [],
    storage: [],
    opticalDrives: [],
    soundCard: null,
    networkCard: null,
    insertedMediaId: null,
  };
}

export const createEmptyDisplaySetup = (): DisplaySetupState => ({ monitor: null });
export const createEmptyInventoryState = (): PlayerInventoryState => ({ items: [], purchaseCounts: {} });

export function projectEffectiveHardware(computer: ComputerSetupState): HardwareState {
  if (!computer.assembled) {
    return {
      hasComputer: false,
      isPoweredOn: false,
      cpuTier: 0,
      cpuName: '',
      ramMB: 0,
      hddTotalGB: 0,
      hddFreeGB: 0,
      connectionType: null,
      connectionSpeedKbps: 0,
      soundCardInstalled: false,
      speakersInstalled: false,
      webcamInstalled: false,
    };
  }

  const primaryStorage = computer.storage[0] ?? null;
  const connectionType =
    computer.networkCard && computer.networkCard.type !== 'ethernet_10_100'
      ? computer.networkCard.type
      : null;

  return {
    hasComputer: true,
    isPoweredOn: computer.poweredOn,
    cpuTier: computer.cpu?.tier ?? 0,
    cpuName: computer.cpu?.name ?? '',
    ramMB: computer.ramSticks.reduce((total, stick) => total + stick.sizeMb, 0),
    hddTotalGB: primaryStorage
      ? Number((primaryStorage.capacityBytes / 1_000_000_000).toFixed(1))
      : 0,
    hddFreeGB: primaryStorage
      ? Number((Math.max(0, primaryStorage.freeBytes) / 1_000_000_000).toFixed(1))
      : 0,
    connectionType,
    connectionSpeedKbps: connectionType ? computer.networkCard?.speedKbps ?? 0 : 0,
    soundCardInstalled: Boolean(computer.soundCard && computer.soundCard.tier !== 'pc_speaker'),
    speakersInstalled: false,
    webcamInstalled: false,
  };
}

export function legacyModularToCanonical(
  modular: ModularHardwareState,
): { computer: ComputerSetupState; display: DisplaySetupState } {
  if (!modular.hasComputer) {
    return {
      computer: createEmptyComputerSetup(),
      display: createEmptyDisplaySetup(),
    };
  }

  return {
    computer: {
      assembled: true,
      poweredOn: Boolean(modular.isPoweredOn),
      chassis: { ...LEGACY_CHASSIS },
      motherboard: modular.motherboard ?? null,
      cpu: modular.cpu ?? null,
      ramSticks: [...(modular.ramSticks ?? [])],
      storage: modular.storage ? [modular.storage] : [],
      opticalDrives: modular.opticalDrive ? [modular.opticalDrive] : [],
      soundCard: modular.soundCard ?? null,
      networkCard: modular.networkCard ?? null,
      insertedMediaId: modular.insertedDisc?.id ?? null,
    },
    display: {
      monitor: modular.monitor ?? null,
    },
  };
}

export function legacyFlatHardwareToCanonical(
  hardware: LegacyV5HardwareLike,
): { computer: ComputerSetupState; display: DisplaySetupState } {
  // Explicit v5 no-PC state is authoritative even when a stale modular object
  // survives from an earlier partial patch.
  if (hardware.hasComputer === false) {
    return {
      computer: createEmptyComputerSetup(),
      display: createEmptyDisplaySetup(),
    };
  }
  if (hardware.modular) {
    return legacyModularToCanonical(hardware.modular);
  }

  const ramMb = typeof hardware.ramMB === 'number' && hardware.ramMB > 0 ? hardware.ramMB : 512;
  const hddTotal = typeof hardware.hddTotalGB === 'number' && hardware.hddTotalGB > 0 ? hardware.hddTotalGB : 40;
  const hddFree = typeof hardware.hddFreeGB === 'number' && hardware.hddFreeGB >= 0 ? hardware.hddFreeGB : 7;
  const cpuTier = hardware.cpuTier === 2 ? 2 : 1;
  const connectionType = hardware.connectionType ?? 'dsl_256k';
  const connectionSpeedKbps =
    typeof hardware.connectionSpeedKbps === 'number' && hardware.connectionSpeedKbps > 0
      ? hardware.connectionSpeedKbps
      : connectionType === 'dialup_56k'
        ? 56
        : connectionType === 'dsl_512k'
          ? 512
          : connectionType === 'dsl_1m'
            ? 1024
            : 256;

  return {
    computer: {
      assembled: true,
      poweredOn: hardware.isPoweredOn ?? true,
      chassis: { ...LEGACY_CHASSIS },
      motherboard: {
        id: 'mb_standard_atx',
        name: 'Standard ATX Slot-1 Board',
        ramSlots: 2,
        maxRamMbPerSlot: 512,
        cpuSocket: 'Slot-1',
      },
      cpu: {
        id: cpuTier === 2 ? 'cpu_pentium3_800' : 'cpu_celeron_450',
        name:
          hardware.cpuName ||
          (cpuTier === 2 ? 'Orion P-III 800 MHz' : 'Single-Core Orion x86 450MHz'),
        tier: cpuTier,
        clockMhz: cpuTier === 2 ? 800 : 450,
        socket: 'Slot-1',
        throughputUnits: cpuTier === 2 ? 2 : 1,
      },
      ramSticks: [
        {
          id: `ram_stick_migrated_${ramMb}`,
          name: `${ramMb}MB SDRAM`,
          sizeMb: ramMb,
        },
      ],
      storage: [
        {
          id: 'hdd_migrated',
          name: `${hddTotal} GB IDE Hard Drive`,
          capacityBytes: Math.round(hddTotal * 1_000_000_000),
          freeBytes: Math.round(hddFree * 1_000_000_000),
          rpm: 5400,
          throughputUnits: 1,
        },
      ],
      opticalDrives: [
        {
          id: 'optical_cdrom_24x',
          name: '24x IDE CD-ROM Drive',
          type: 'cd_rom',
          speedMultiplier: 24,
        },
      ],
      soundCard:
        hardware.soundCardInstalled === false
          ? {
              id: 'sound_pc_speaker',
              name: 'PC Speaker',
              tier: 'pc_speaker',
              richAudio: false,
              midiSupport: false,
            }
          : {
              id: 'sound_sb16',
              name: 'SoundBlaster 16 ISA',
              tier: 'sb16',
              richAudio: true,
              midiSupport: true,
            },
      networkCard: {
        id: 'nic_migrated',
        name:
          connectionType === 'dialup_56k'
            ? 'V.90 56k Dial-Up Voice/Fax Modem'
            : 'PCI Fast Ethernet Adapter',
        type: connectionType,
        speedKbps: connectionSpeedKbps,
      },
      insertedMediaId: null,
    },
    display: {
      monitor: {
        id: 'mon_standard_15',
        name: '15" Standard CRT Monitor',
        type: 'crt_standard_15',
        curvature: 0.7,
        scanlineIntensity: 0.5,
        bloomIntensity: 0.4,
        flicker: true,
      },
    },
  };
}

export function canonicalToLegacyModular(
  computer: ComputerSetupState,
  display: DisplaySetupState,
): ModularHardwareState | undefined {
  if (
    !computer.assembled ||
    !computer.motherboard ||
    !computer.cpu ||
    computer.storage.length === 0 ||
    computer.opticalDrives.length === 0 ||
    !computer.soundCard ||
    !computer.networkCard ||
    !display.monitor
  ) {
    return undefined;
  }

  return {
    hasComputer: true,
    isPoweredOn: computer.poweredOn,
    motherboard: computer.motherboard,
    cpu: computer.cpu,
    ramSticks: [...computer.ramSticks],
    storage: computer.storage[0]!,
    opticalDrive: computer.opticalDrives[0]!,
    soundCard: computer.soundCard,
    networkCard: computer.networkCard,
    monitor: display.monitor,
    // v6 media metadata lives in inventory; this legacy adapter must not invent it.
    insertedDisc: null,
  };
}
