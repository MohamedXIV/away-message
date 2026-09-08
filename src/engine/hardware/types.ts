// src/engine/hardware/types.ts
// Pure data models for modular PC hardware, individual socketed parts, and store bundles.

import type { ConnectionType, OsVersion } from '../types';

export interface ChassisComponent {
  id: string;
  name: string;
}

export interface MotherboardComponent {
  id: string;
  name: string;
  ramSlots: number;
  maxRamMbPerSlot: number;
  cpuSocket: string;
}

export interface CpuComponent {
  id: string;
  name: string;
  tier: number; // 1 = Entry 350-450MHz, 2 = Mid 600-800MHz, 3 = High 1GHz+
  clockMhz: number;
  socket: string;
  throughputUnits: number; // computation speed multiplier
}

export interface RamStickComponent {
  id: string;
  name: string;
  sizeMb: number; // 64, 128, 256, 512
}

export interface StorageComponent {
  id: string;
  name: string;
  capacityBytes: number;
  freeBytes: number;
  rpm: number; // 4200, 5400, 7200
  throughputUnits: number; // read/write speed multiplier
}

export interface OpticalDriveComponent {
  id: string;
  name: string;
  type: 'cd_rom' | 'cd_rw';
  speedMultiplier: number; // e.g. 24, 48
}

export interface SoundCardComponent {
  id: string;
  name: string;
  tier: 'pc_speaker' | 'sb16' | 'sb_live';
  richAudio: boolean;
  midiSupport: boolean;
}

export interface NetworkCardComponent {
  id: string;
  name: string;
  type: ConnectionType | 'ethernet_10_100';
  speedKbps: number;
}

export interface MonitorComponent {
  id: string;
  name: string;
  type: 'crt_budget_14' | 'crt_standard_15' | 'crt_trinitron_17' | 'early_lcd_15';
  curvature: number; // 0..1 (0 = flat, 1 = curved fishbowl)
  scanlineIntensity: number; // 0..1
  bloomIntensity: number; // 0..1
  flicker: boolean;
}

export interface InsertedDisc {
  id: string;
  title: string;
  type: 'os_installer' | 'software' | 'audio_cd';
  osTarget?: OsVersion;
  softwareId?: string;
}

export interface ModularHardwareState {
  hasComputer: boolean;
  isPoweredOn: boolean;
  motherboard: MotherboardComponent;
  cpu: CpuComponent;
  ramSticks: RamStickComponent[];
  storage: StorageComponent;
  opticalDrive: OpticalDriveComponent;
  soundCard: SoundCardComponent;
  networkCard: NetworkCardComponent;
  monitor: MonitorComponent;
  insertedDisc?: InsertedDisc | null;
}

export interface HardwareStoreItem {
  id: string;
  name: string;
  category: 'bundle' | 'cpu' | 'ram' | 'storage' | 'optical' | 'sound' | 'monitor' | 'os_disc';
  price: number;
  description: string;
  specsSummary: string;
  component?:
    | CpuComponent
    | RamStickComponent
    | StorageComponent
    | OpticalDriveComponent
    | SoundCardComponent
    | MonitorComponent;
  bundleConfig?: {
    hardware: ModularHardwareState;
    installedOs: OsVersion;
  };
  osDiscConfig?: {
    osVersion: OsVersion;
    title: string;
  };
}
