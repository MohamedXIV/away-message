// src/engine/hardware/catalog.ts
// Authored parts catalog, component upgrade definitions, and starter PC bundles.

import type { HardwareStoreItem, ModularHardwareState, PhysicalCatalogItem, StoreSkuContent } from './types';
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
      freeBytes: 1_800_000_000,
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

const scrapYardPhysical = createScrapYardBundle();
const familyPhysical = createFamilyRefurbBundle();
const workstationPhysical = createPowerWorkstationBundle();

export const PHYSICAL_ITEM_CATALOG: Record<string, PhysicalCatalogItem> = {
  chassis_scrapyard_beige_atx: {
    id: 'chassis_scrapyard_beige_atx', kind: 'hardware', componentKind: 'chassis',
    component: { id: 'chassis_scrapyard_beige_atx', name: 'Dusty Beige ATX Chassis' },
  },
  chassis_family_refurb: {
    id: 'chassis_family_refurb', kind: 'hardware', componentKind: 'chassis',
    component: { id: 'chassis_family_refurb', name: 'Cream Refurbished ATX Chassis' },
  },
  chassis_power_workstation: {
    id: 'chassis_power_workstation', kind: 'hardware', componentKind: 'chassis',
    component: { id: 'chassis_power_workstation', name: 'Heavy Silver Workstation Chassis' },
  },
  [scrapYardPhysical.motherboard.id]: { id: scrapYardPhysical.motherboard.id, kind: 'hardware', componentKind: 'motherboard', component: { ...scrapYardPhysical.motherboard } },
  [scrapYardPhysical.cpu.id]: { id: scrapYardPhysical.cpu.id, kind: 'hardware', componentKind: 'cpu', component: { ...scrapYardPhysical.cpu } },
  [scrapYardPhysical.ramSticks[0]!.id]: { id: scrapYardPhysical.ramSticks[0]!.id, kind: 'hardware', componentKind: 'ram', component: { ...scrapYardPhysical.ramSticks[0]! } },
  [scrapYardPhysical.storage.id]: { id: scrapYardPhysical.storage.id, kind: 'hardware', componentKind: 'storage', component: { ...scrapYardPhysical.storage } },
  [scrapYardPhysical.opticalDrive.id]: { id: scrapYardPhysical.opticalDrive.id, kind: 'hardware', componentKind: 'optical', component: { ...scrapYardPhysical.opticalDrive } },
  [scrapYardPhysical.soundCard.id]: { id: scrapYardPhysical.soundCard.id, kind: 'hardware', componentKind: 'sound', component: { ...scrapYardPhysical.soundCard } },
  [scrapYardPhysical.networkCard.id]: { id: scrapYardPhysical.networkCard.id, kind: 'hardware', componentKind: 'network', component: { ...scrapYardPhysical.networkCard } },
  [scrapYardPhysical.monitor.id]: { id: scrapYardPhysical.monitor.id, kind: 'display', componentKind: 'monitor', component: { ...scrapYardPhysical.monitor } },

  [familyPhysical.cpu.id]: { id: familyPhysical.cpu.id, kind: 'hardware', componentKind: 'cpu', component: { ...familyPhysical.cpu } },
  [familyPhysical.ramSticks[0]!.id]: { id: familyPhysical.ramSticks[0]!.id, kind: 'hardware', componentKind: 'ram', component: { ...familyPhysical.ramSticks[0]! } },
  [familyPhysical.storage.id]: { id: familyPhysical.storage.id, kind: 'hardware', componentKind: 'storage', component: { ...familyPhysical.storage } },
  [familyPhysical.opticalDrive.id]: { id: familyPhysical.opticalDrive.id, kind: 'hardware', componentKind: 'optical', component: { ...familyPhysical.opticalDrive } },
  [familyPhysical.monitor.id]: { id: familyPhysical.monitor.id, kind: 'display', componentKind: 'monitor', component: { ...familyPhysical.monitor } },

  [workstationPhysical.motherboard.id]: { id: workstationPhysical.motherboard.id, kind: 'hardware', componentKind: 'motherboard', component: { ...workstationPhysical.motherboard } },
  [workstationPhysical.cpu.id]: { id: workstationPhysical.cpu.id, kind: 'hardware', componentKind: 'cpu', component: { ...workstationPhysical.cpu } },
  [workstationPhysical.ramSticks[0]!.id]: { id: workstationPhysical.ramSticks[0]!.id, kind: 'hardware', componentKind: 'ram', component: { ...workstationPhysical.ramSticks[0]! } },
  [workstationPhysical.ramSticks[1]!.id]: { id: workstationPhysical.ramSticks[1]!.id, kind: 'hardware', componentKind: 'ram', component: { ...workstationPhysical.ramSticks[1]! } },
  [workstationPhysical.storage.id]: { id: workstationPhysical.storage.id, kind: 'hardware', componentKind: 'storage', component: { ...workstationPhysical.storage } },
  [workstationPhysical.opticalDrive.id]: { id: workstationPhysical.opticalDrive.id, kind: 'hardware', componentKind: 'optical', component: { ...workstationPhysical.opticalDrive } },
  [workstationPhysical.soundCard.id]: { id: workstationPhysical.soundCard.id, kind: 'hardware', componentKind: 'sound', component: { ...workstationPhysical.soundCard } },
  [workstationPhysical.monitor.id]: { id: workstationPhysical.monitor.id, kind: 'display', componentKind: 'monitor', component: { ...workstationPhysical.monitor } },

  ram_sdram_64: { id: 'ram_sdram_64', kind: 'hardware', componentKind: 'ram', component: { id: 'ram_sdram_64', name: '64MB PC100 SDRAM', sizeMb: 64 } },
  ram_sdram_128: { id: 'ram_sdram_128', kind: 'hardware', componentKind: 'ram', component: { id: 'ram_sdram_128', name: '128MB PC133 SDRAM', sizeMb: 128 } },
  hdd_10gb: { id: 'hdd_10gb', kind: 'hardware', componentKind: 'storage', component: { id: 'hdd_10gb', name: '10.2 GB IDE Hard Drive', capacityBytes: 10_200_000_000, freeBytes: 10_200_000_000, rpm: 5400, throughputUnits: 1.2 } },

  media_orion_48_setup: {
    id: 'media_orion_48_setup', kind: 'media', componentKind: 'os_media',
    media: { type: 'os_installer', title: 'Orion OS 4.8 Setup CD', osTarget: 'Orion_4.8' as OsVersion },
  },
  media_orion_50_setup: {
    id: 'media_orion_50_setup', kind: 'media', componentKind: 'os_media',
    media: { type: 'os_installer', title: 'Orion OS 5.0 Aurora Setup CD', osTarget: 'Orion_5.0' as OsVersion },
  },
  media_orion_60_setup: {
    id: 'media_orion_60_setup', kind: 'media', componentKind: 'os_media',
    media: { type: 'os_installer', title: 'Orion OS 6.0 Glassline Setup Disc', osTarget: 'Orion_6.0' as OsVersion },
  },
};

export function getPhysicalCatalogItem(id: string): PhysicalCatalogItem | undefined {
  return PHYSICAL_ITEM_CATALOG[id];
}

function skuContents(...catalogItemIds: string[]): StoreSkuContent[] {
  return catalogItemIds.map((catalogItemId) => ({ catalogItemId, quantity: 1 }));
}

export const HARDWARE_STORE_INVENTORY: HardwareStoreItem[] = [
  // --- Complete Starter Bundles ---
  {
    id: 'bundle_scrapyard',
    name: 'The Scrap Yard Special (Refurbished)',
    category: 'bundle',
    price: 35.0,
    description: 'A dusty beige tower with matching curved 14" CRT, plus the original Orion 4.8 setup CD. A complete starter package ready to take back to Room 104.',
    specsSummary: 'Cel-366 MHz · 64MB RAM · 2.1GB HDD · 14" Curved CRT · Orion 4.8 Setup CD',
    repeatable: false,
    contents: skuContents('chassis_scrapyard_beige_atx', 'mb_standard_atx', 'cpu_celeron_366', 'ram_sdram_64_a', 'hdd_quantum_2gb', 'optical_cdrom_24x', 'sound_sb16', 'modem_v90_56k', 'mon_beige_curved_14', 'media_orion_48_setup'),
    bundleConfig: { hardware: createScrapYardBundle() },
  },
  {
    id: 'bundle_family',
    name: 'Family Refurb Tower & 15" Monitor',
    category: 'bundle',
    price: 85.0,
    description: 'Clean cream-white desktop with 15" standard CRT and Orion 5.0 Aurora setup media. Balanced daily workhorse with CD-RW drive and 128MB RAM.',
    specsSummary: 'P-II 500 MHz · 128MB RAM · 6.4GB HDD · 15" CRT · Orion 5.0 Setup CD',
    repeatable: false,
    contents: skuContents('chassis_family_refurb', 'mb_standard_atx', 'cpu_pentium2_500', 'ram_sdram_128_a', 'hdd_maxtor_6gb', 'optical_cdrw_32x', 'sound_sb16', 'nic_fast_ethernet', 'mon_standard_15', 'media_orion_50_setup'),
    bundleConfig: { hardware: createFamilyRefurbBundle() },
  },
  {
    id: 'bundle_workstation',
    name: 'Power Workstation & Flat Trinitron',
    category: 'bundle',
    price: 160.0,
    description: 'Heavy silver tower with 17" perfectly flat Trinitron aperture CRT and Orion 6.0 Glassline setup media. Multitasking beast with SoundBlaster Live! and 256MB RAM.',
    specsSummary: 'P-III 933 MHz · 256MB RAM · 20GB 7200 RPM HDD · 17" Trinitron · Orion 6.0 Setup Disc',
    repeatable: false,
    contents: skuContents('chassis_power_workstation', 'mb_pro_atx', 'cpu_pentium3_933', 'ram_sdram_128_1', 'ram_sdram_128_2', 'hdd_barracuda_20gb', 'optical_cdrw_48x', 'sound_sb_live', 'nic_fast_ethernet', 'mon_trinitron_17', 'media_orion_60_setup'),
    bundleConfig: { hardware: createPowerWorkstationBundle() },
  },

  // --- Swappable RAM Sticks ---
  {
    id: 'part_ram_64mb',
    name: '64MB PC100 SDRAM Stick',
    category: 'ram',
    price: 18.0,
    repeatable: true,
    contents: skuContents('ram_sdram_64'),
    description: 'Add a stick to your spare motherboard slot to stop the hard drive from grinding when multiple apps are open.',
    specsSummary: '+64 MB Memory',
    component: { id: 'ram_sdram_64', name: '64MB PC100 SDRAM', sizeMb: 64 },
  },
  {
    id: 'part_ram_128mb',
    name: '128MB PC133 SDRAM Stick',
    category: 'ram',
    price: 32.0,
    repeatable: true,
    contents: skuContents('ram_sdram_128'),
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
    repeatable: true,
    contents: skuContents('hdd_10gb'),
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
    repeatable: true,
    contents: skuContents('mon_trinitron_17'),
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
    repeatable: false,
    contents: skuContents('media_orion_50_setup'),
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
    repeatable: false,
    contents: skuContents('media_orion_60_setup'),
    description: 'Full retail box with 2-disc installer. Unlocks Glassline translucent styling, multithreading, and support for next-gen apps.',
    specsSummary: 'Requires: 128MB RAM, 2.0GB Free Disk, CD-ROM Drive',
    osDiscConfig: {
      osVersion: 'Orion_6.0' as OsVersion,
      title: 'Orion OS 6.0 Glassline Setup Disc',
    },
  },
];
