import type {
  ComputerSetupState,
  DisplaySetupState,
  OwnedItem,
} from '../types';
import {
  PHYSICAL_ITEM_CATALOG,
} from './catalog';
import type {
  ChassisComponent,
  CpuComponent,
  MonitorComponent,
  MotherboardComponent,
  NetworkCardComponent,
  OpticalDriveComponent,
  RamStickComponent,
  SoundCardComponent,
  StorageComponent,
} from './types';

export interface ResolvedComputerAssembly {
  instanceIds: string[];
  computer: ComputerSetupState;
  display: DisplaySetupState;
}

export type ResolveComputerAssemblyResult =
  | { ok: true; assembly: ResolvedComputerAssembly }
  | { ok: false; error: string };

type ResolvedPart = {
  owned: OwnedItem;
  componentKind: string;
  component: NonNullable<(typeof PHYSICAL_ITEM_CATALOG)[string]['component']>;
};

function singlePart(parts: ResolvedPart[], kind: string, label: string): ResolvedPart | string {
  const matches = parts.filter((part) => part.componentKind === kind);
  if (matches.length === 0) return `Missing ${label} in Room 104 package.`;
  if (matches.length > 1) return `Multiple ${label} items are available; choose parts before setup.`;
  return matches[0]!;
}

export function resolveRoomComputerAssembly(items: readonly OwnedItem[]): ResolveComputerAssemblyResult {
  const roomItems = items.filter((item) => item.location === 'room_package');
  const parts: ResolvedPart[] = [];

  for (const owned of roomItems) {
    const catalog = PHYSICAL_ITEM_CATALOG[owned.catalogItemId];
    if (!catalog) {
      return { ok: false, error: `Unknown owned catalog item: ${owned.catalogItemId}.` };
    }
    if (catalog.kind === 'media' || catalog.componentKind === 'os_media') continue;
    if (!catalog.component) {
      return { ok: false, error: `Owned item ${owned.catalogItemId} has no physical component data.` };
    }
    parts.push({ owned, componentKind: catalog.componentKind, component: catalog.component });
  }

  const chassisPart = singlePart(parts, 'chassis', 'chassis');
  if (typeof chassisPart === 'string') return { ok: false, error: chassisPart };
  const motherboardPart = singlePart(parts, 'motherboard', 'motherboard');
  if (typeof motherboardPart === 'string') return { ok: false, error: motherboardPart };
  const cpuPart = singlePart(parts, 'cpu', 'CPU');
  if (typeof cpuPart === 'string') return { ok: false, error: cpuPart };
  const storagePart = singlePart(parts, 'storage', 'storage drive');
  if (typeof storagePart === 'string') return { ok: false, error: storagePart };
  const opticalPart = singlePart(parts, 'optical', 'optical drive');
  if (typeof opticalPart === 'string') return { ok: false, error: opticalPart };
  const soundPart = singlePart(parts, 'sound', 'sound card');
  if (typeof soundPart === 'string') return { ok: false, error: soundPart };
  const networkPart = singlePart(parts, 'network', 'network card');
  if (typeof networkPart === 'string') return { ok: false, error: networkPart };
  const monitorPart = singlePart(parts, 'monitor', 'monitor');
  if (typeof monitorPart === 'string') return { ok: false, error: monitorPart };

  const ramParts = parts.filter((part) => part.componentKind === 'ram');
  if (ramParts.length === 0) return { ok: false, error: 'Missing RAM in Room 104 package.' };

  const chassis = chassisPart.component as ChassisComponent;
  const motherboard = motherboardPart.component as MotherboardComponent;
  const cpu = cpuPart.component as CpuComponent;
  const ramSticks = ramParts.map((part) => part.component as RamStickComponent);
  const storage = storagePart.component as StorageComponent;
  const optical = opticalPart.component as OpticalDriveComponent;
  const sound = soundPart.component as SoundCardComponent;
  const network = networkPart.component as NetworkCardComponent;
  const monitor = monitorPart.component as MonitorComponent;

  if (cpu.socket !== motherboard.cpuSocket) {
    return {
      ok: false,
      error: `CPU socket ${cpu.socket} is incompatible with motherboard socket ${motherboard.cpuSocket}.`,
    };
  }
  if (ramSticks.length > motherboard.ramSlots) {
    return { ok: false, error: `Too many RAM sticks for ${motherboard.ramSlots} motherboard slots.` };
  }
  const oversizedRam = ramSticks.find((stick) => stick.sizeMb > motherboard.maxRamMbPerSlot);
  if (oversizedRam) {
    return {
      ok: false,
      error: `${oversizedRam.name} exceeds motherboard per-slot RAM capacity.`,
    };
  }

  const instanceIds = [
    chassisPart.owned.instanceId,
    motherboardPart.owned.instanceId,
    cpuPart.owned.instanceId,
    ...ramParts.map((part) => part.owned.instanceId),
    storagePart.owned.instanceId,
    opticalPart.owned.instanceId,
    soundPart.owned.instanceId,
    networkPart.owned.instanceId,
    monitorPart.owned.instanceId,
  ];

  return {
    ok: true,
    assembly: {
      instanceIds,
      computer: {
        assembled: true,
        poweredOn: false,
        chassis: { ...chassis },
        motherboard: { ...motherboard },
        cpu: { ...cpu },
        ramSticks: ramSticks.map((stick) => ({ ...stick })),
        storage: [{ ...storage }],
        opticalDrives: [{ ...optical }],
        soundCard: { ...sound },
        networkCard: { ...network },
        insertedMediaId: null,
      },
      display: { monitor: { ...monitor } },
    },
  };
}
