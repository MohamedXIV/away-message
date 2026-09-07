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
import type { HardwareState, OsVersion } from '../types';

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

/** Converts modular hardware into the legacy flat HardwareState expected by existing subsystems */
export function toLegacyHardwareState(state: ModularHardwareState, osVersion: OsVersion): HardwareState {
  const ramMB = calculateTotalRamMb(state);
  const hddTotalGB = Number((calculateTotalDiskBytes(state) / 1_000_000_000).toFixed(1));
  const hddFreeGB = Number((calculateFreeDiskBytes(state) / 1_000_000_000).toFixed(1));

  return {
    cpuTier: state.cpu?.tier ?? 1,
    cpuName: state.cpu?.name ?? 'Single-Core Orion x86',
    ramMB: ramMB > 0 ? ramMB : 512,
    hddTotalGB: hddTotalGB > 0 ? hddTotalGB : 40.0,
    hddFreeGB: hddFreeGB > 0 ? hddFreeGB : 7.0,
    connectionType: (state.networkCard?.type as any) ?? 'dsl_256k',
    connectionSpeedKbps: state.networkCard?.speedKbps ?? 256,
    osVersion,
    soundCardInstalled: state.soundCard?.tier !== 'pc_speaker',
    speakersInstalled: true,
    webcamInstalled: false,
  };
}
