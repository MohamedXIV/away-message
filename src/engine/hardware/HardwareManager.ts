// src/engine/hardware/HardwareManager.ts
// Pure functions for computing hardware metrics, slot validation, and swappable part actions.

import type {
  ModularHardwareState,
  RamStickComponent,
  StorageComponent,
  MonitorComponent,
  InsertedDisc,
  CpuComponent,
  SoundCardComponent,
  NetworkCardComponent,
} from './types';
import type { HardwareState } from '../types';
import { legacyModularToCanonical, projectEffectiveHardware } from './state';

export function calculateTotalRamMb(state: ModularHardwareState): number {
  if (!state.hasComputer || !state.ramSticks) return 0;
  return state.ramSticks.reduce((acc, stick) => acc + stick.sizeMb, 0);
}

export function calculateFreeDiskBytes(state: ModularHardwareState): number {
  if (!state.hasComputer || !state.storage) return 0;
  return Math.max(0, state.storage.freeBytes);
}

export function calculateTotalDiskBytes(state: ModularHardwareState): number {
  if (!state.hasComputer || !state.storage) return 0;
  return state.storage.capacityBytes;
}

export function canAddRamStick(state: ModularHardwareState, stick: RamStickComponent): { ok: boolean; reason?: string } {
  if (!state.hasComputer) return { ok: false, reason: 'No computer installed.' };
  if (state.ramSticks.length >= state.motherboard.ramSlots) {
    return { ok: false, reason: `All ${state.motherboard.ramSlots} RAM slots are full. You must replace an existing stick.` };
  }
  if (stick.sizeMb > state.motherboard.maxRamMbPerSlot) {
    return { ok: false, reason: `Motherboard slot only supports up to ${state.motherboard.maxRamMbPerSlot} MB per stick.` };
  }
  return { ok: true };
}

export function addRamStick(state: ModularHardwareState, stick: RamStickComponent): ModularHardwareState {
  return {
    ...state,
    ramSticks: [...state.ramSticks, stick],
  };
}

export function replaceMonitor(state: ModularHardwareState, monitor: MonitorComponent): ModularHardwareState {
  return {
    ...state,
    monitor,
  };
}

export function replaceStorage(state: ModularHardwareState, storage: StorageComponent): ModularHardwareState {
  return {
    ...state,
    storage,
  };
}

export function replaceCpu(state: ModularHardwareState, cpu: CpuComponent): ModularHardwareState {
  return {
    ...state,
    cpu,
  };
}

export function replaceSoundCard(state: ModularHardwareState, soundCard: SoundCardComponent): ModularHardwareState {
  return {
    ...state,
    soundCard,
  };
}

export function replaceNetworkCard(state: ModularHardwareState, networkCard: NetworkCardComponent): ModularHardwareState {
  return {
    ...state,
    networkCard,
  };
}

export function insertDiscIntoDrive(state: ModularHardwareState, disc: InsertedDisc): ModularHardwareState {
  return {
    ...state,
    insertedDisc: disc,
  };
}

export function ejectDiscFromDrive(state: ModularHardwareState): ModularHardwareState {
  return {
    ...state,
    insertedDisc: null,
  };
}

export function setComputerPower(state: ModularHardwareState, isPoweredOn: boolean): ModularHardwareState {
  return {
    ...state,
    isPoweredOn,
  };
}

/**
 * @deprecated v5/catalog adapter only. OS is deliberately ignored: effective
 * hardware is derived exclusively from physical computer state.
 */
export function toLegacyHardwareState(state: ModularHardwareState, _ignoredOsVersion?: unknown): HardwareState {
  return projectEffectiveHardware(legacyModularToCanonical(state).computer);
}
