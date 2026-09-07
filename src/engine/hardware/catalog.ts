// src/engine/hardware/catalog.ts
// Authored parts catalog, component upgrade definitions, and starter PC bundles.

import type { HardwareStoreItem, ModularHardwareState } from './types';
import type { OsVersion } from '../types';

export const STARTER_MOTHERBOARD = {
  id: 'mb_standard_atx',
  name: 'Standard ATX Slot-1 Board',
  ramSlots: 2,
  maxRamMbPerSlot: 256,
  cpuSocket: 'Slot-1',
};

export const STARTER_OPTICAL = {
  id: 'optical_cdrom_24x',
  name: '24x IDE CD-ROM Drive',
  type: 'cd_rom' as const,
  speedMultiplier: 24,
};

export const STARTER_SOUND_CARD = {
  id: 'sound_sb16',
  name: 'SoundBlaster 16 ISA',
  tier: 'sb16' as const,
  richAudio: true,
  midiSupport: true,
};

export const STARTER_MODEM = {
  id: 'modem_v90_56k',
  name: 'V.90 56k Dial-Up Voice/Fax Modem',
  type: 'dialup_56k' as const,
  speedKbps: 56,
};

export const STARTER_ETHERNET = {
  id: 'nic_fast_ethernet',
  name: 'Realtek 10/100 PCI Fast Ethernet',
  type: 'dsl_256k' as const,
  speedKbps: 256,
};

// Preset: "The Scrap Yard Special" ($45) - Beige box, Orion 4.8
export function createScrapYardBundle(): ModularHardwareState {
  return {
    hasComputer: true,
    isPoweredOn: false,
    motherboard: { ...STARTER_MOTHERBOARD },
    cpu: {
      id: 'cpu_celeron_366',
      name: 'Orion Cel-366 MHz',
      tier: 1,
      clockMhz: 366,
      socket: 'Slot-1',
      throughputUnits: 1.0,
    },
    ramSticks: [
      { id: 'ram_sdram_64_a', name: '64MB PC100 SDRAM', sizeMb: 64 },
    ],
    storage: {
      id: 'hdd_quantum_2gb',
      name: '2.1 GB IDE Hard Drive (4200 RPM)',
      capacityBytes: 2_100_000_000,
      freeBytes: 900_000_000,
      rpm: 4200,
      throughputUnits: 0.8,
    },
    opticalDrive: { ...STARTER_OPTICAL },
    soundCard: { ...STARTER_SOUND_CARD },
    networkCard: { ...STARTER_MODEM },
    monitor: {
      id: 'mon_beige_curved_14',
      name: '14" Curved Glass CRT Monitor',
      type: 'crt_budget_14',
      curvature: 0.85,
      scanlineIntensity: 0.65,
      bloomIntensity: 0.45,
      flicker: true,
    },
    insertedDisc: null,
  };
}

// Preset: "The Family Refurb" ($85) - Clean white tower, Orion 5.0 Aurora
export function createFamilyRefurbBundle(): ModularHardwareState {
  return {
    hasComputer: true,
    isPoweredOn: false,
    motherboard: { ...STARTER_MOTHERBOARD },
    cpu: {
      id: 'cpu_pentium2_500',
      name: 'Orion P-II 500 MHz',
      tier: 1,
      clockMhz: 500,
      socket: 'Slot-1',
      throughputUnits: 1.3,
    },
    ramSticks: [
      { id: 'ram_sdram_128_a', name: '128MB PC133 SDRAM', sizeMb: 128 },
    ],
    storage: {
      id: 'hdd_maxtor_6gb',
      name: '6.4 GB IDE Hard Drive (5400 RPM)',
      capacityBytes: 6_400_000_000,
      freeBytes: 4_200_000_000,
      rpm: 5400,
      throughputUnits: 1.1,
    },
    opticalDrive: {
      id: 'optical_cdrw_32x',
      name: '32x12x40x IDE CD-RW Drive',
      type: 'cd_rw',
      speedMultiplier: 32,
    },
    soundCard: { ...STARTER_SOUND_CARD },
    networkCard: { ...STARTER_ETHERNET },
    monitor: {
      id: 'mon_standard_15',
      name: '15" Standard Shadow-Mask CRT',
      type: 'crt_standard_15',
      curvature: 0.45,
      scanlineIntensity: 0.35,
      bloomIntensity: 0.25,
      flicker: false,
    },
    insertedDisc: null,
  };
}

// Preset: "The Power Workstation" ($160) - High-end tower, Orion 6.0 Glassline
export function createPowerWorkstationBundle(): ModularHardwareState {
  return {
    hasComputer: true,
    isPoweredOn: false,
    motherboard: {
      id: 'mb_pro_atx',
      name: 'Pro ATX 4-Slot Motherboard',
      ramSlots: 4,
      maxRamMbPerSlot: 512,
      cpuSocket: 'Socket-370',
    },
    cpu: {
      id: 'cpu_pentium3_933',
      name: 'Orion P-III 933 MHz Coppermine',
      tier: 2,
      clockMhz: 933,
      socket: 'Socket-370',
      throughputUnits: 2.0,
    },
    ramSticks: [
      { id: 'ram_sdram_128_1', name: '128MB PC133 SDRAM', sizeMb: 128 },
      { id: 'ram_sdram_128_2', name: '128MB PC133 SDRAM', sizeMb: 128 },
    ],
    storage: {
      id: 'hdd_barracuda_20gb',
      name: '20.4 GB 7200 RPM ATA-100 HDD',
      capacityBytes: 20_400_000_000,
      freeBytes: 16_000_000_000,
      rpm: 7200,
      throughputUnits: 1.8,
    },
    opticalDrive: {
      id: 'optical_cdrw_48x',
      name: '48x IDE High-Speed CD-RW Drive',
      type: 'cd_rw',
      speedMultiplier: 48,
    },
    soundCard: {
      id: 'sound_sb_live',
      name: 'SoundBlaster Live! Value PCI',
      tier: 'sb_live',
      richAudio: true,
      midiSupport: true,
    },
    networkCard: { ...STARTER_ETHERNET },
    monitor: {
      id: 'mon_trinitron_17',
      name: '17" Flat Trinitron Aperture Grille CRT',
      type: 'crt_trinitron_17',
      curvature: 0.0,
      scanlineIntensity: 0.2,
      bloomIntensity: 0.15,
      flicker: false,
    },
    insertedDisc: null,
  };
}

export const HARDWARE_STORE_INVENTORY: HardwareStoreItem[] = [
  // --- Complete Starter Bundles ---
  {
    id: 'bundle_scrapyard',
    name: 'The Scrap Yard Special (Refurbished)',
    category: 'bundle',
    price: 45.0,
    description: 'A dusty beige tower with matching curved 14" CRT. Pre-loaded with Orion OS 4.8. Perfect for getting online and chatting on Pulse on a shoestring budget.',
    specsSummary: 'Cel-366 MHz · 64MB RAM · 2.1GB HDD · 14" Curved CRT · Orion 4.8',
    bundleConfig: {
      hardware: createScrapYardBundle(),
      installedOs: 'Orion_4.8' as OsVersion,
    },
  },
  {
    id: 'bundle_family',
    name: 'Family Refurb Tower & 15" Monitor',
    category: 'bundle',
    price: 85.0,
    description: 'Clean cream-white desktop with 15" standard CRT. Pre-loaded with Orion OS 5.0 Aurora. Balanced daily workhorse with CD-RW drive and 128MB RAM.',
    specsSummary: 'P-II 500 MHz · 128MB RAM · 6.4GB HDD · 15" CRT · Orion 5.0',
    bundleConfig: {
      hardware: createFamilyRefurbBundle(),
      installedOs: 'Orion_5.0' as OsVersion,
    },
  },
  {
    id: 'bundle_workstation',
    name: 'Power Workstation & Flat Trinitron',
    category: 'bundle',
    price: 160.0,
    description: 'Heavy silver tower with 17" perfectly flat Trinitron aperture CRT. Pre-loaded with Orion OS 6.0 Glassline. Multitasking beast with SoundBlaster Live! and 256MB RAM.',
    specsSummary: 'P-III 933 MHz · 256MB RAM · 20GB 7200 RPM HDD · 17" Trinitron · Orion 6.0',
    bundleConfig: {
      hardware: createPowerWorkstationBundle(),
      installedOs: 'Orion_6.0' as OsVersion,
    },
  },

  // --- Swappable RAM Sticks ---
  {
    id: 'part_ram_64mb',
    name: '64MB PC100 SDRAM Stick',
    category: 'ram',
    price: 18.0,
    description: 'Add a stick to your spare motherboard slot to stop the hard drive from grinding when multiple apps are open.',
    specsSummary: '+64 MB Memory',
    component: { id: 'ram_sdram_64', name: '64MB PC100 SDRAM', sizeMb: 64 },
  },
  {
    id: 'part_ram_128mb',
    name: '128MB PC133 SDRAM Stick',
    category: 'ram',
    price: 32.0,
    description: 'High-density memory module. Greatly expands multitasking headroom and meets modern app requirements.',
    specsSummary: '+128 MB Memory',
    component: { id: 'ram_sdram_128', name: '128MB PC133 SDRAM', sizeMb: 128 },
  },

  // --- Storage Upgrades ---
  {
    id: 'part_hdd_10gb',
    name: '10.2 GB 5400 RPM IDE Hard Drive',
    category: 'storage',
    price: 28.0,
    description: 'Ample room for MP3s, installers, and future OS upgrades without running out of free space.',
    specsSummary: '10.2 GB Capacity · 5400 RPM',
    component: {
      id: 'hdd_10gb',
      name: '10.2 GB IDE Hard Drive',
      capacityBytes: 10_200_000_000,
      freeBytes: 10_200_000_000,
      rpm: 5400,
      throughputUnits: 1.2,
    },
  },

  // --- Monitor Displays ---
  {
    id: 'part_mon_trinitron',
    name: '17" Flat Trinitron Aperture CRT',
    category: 'monitor',
    price: 48.0,
    description: 'Flattest glass tube on the market. Eliminates barrel curvature, delivers pin-sharp scanlines, and vibrant phosphors.',
    specsSummary: '17" Flat Glass · Aperture Grille · Zero Curvature',
    component: {
      id: 'mon_trinitron_17',
      name: '17" Flat Trinitron Aperture Grille CRT',
      type: 'crt_trinitron_17',
      curvature: 0.0,
      scanlineIntensity: 0.2,
      bloomIntensity: 0.15,
      flicker: false,
    },
  },

  // --- OS Software CD Boxes ---
  {
    id: 'disc_orion_50',
    name: 'Orion OS 5.0 Aurora Upgrade Kit (CD-ROM)',
    category: 'os_disc',
    price: 29.0,
    description: 'Original retail jewel case with setup CD and product key. Upgrades your system to Aurora with softened chrome, Tahoma font, and richer sound.',
    specsSummary: 'Requires: 96MB RAM, 1.4GB Free Disk, CD-ROM Drive',
    osDiscConfig: {
      osVersion: 'Orion_5.0' as OsVersion,
      title: 'Orion OS 5.0 Aurora Setup CD',
    },
  },
  {
    id: 'disc_orion_60',
    name: 'Orion OS 6.0 Glassline Retail Box (CD-ROM)',
    category: 'os_disc',
    price: 45.0,
    description: 'Full retail box with 2-disc installer. Unlocks Glassline translucent styling, multithreading, and support for next-gen apps.',
    specsSummary: 'Requires: 128MB RAM, 2.0GB Free Disk, CD-ROM Drive',
    osDiscConfig: {
      osVersion: 'Orion_6.0' as OsVersion,
      title: 'Orion OS 6.0 Glassline Setup Disc',
    },
  },
];
