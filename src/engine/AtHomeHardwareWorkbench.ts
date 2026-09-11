import { getPhysicalCatalogItem } from './hardware/catalog';
import type { ActionResult } from './types';
import { SimulationEngine } from './SimulationEngine';
import { InventoryEngine, type HardwareInstallSlot, type SlottedOwnedItem } from './InventoryEngine';

export interface AtHomeInstalledPart {
  instanceId: string;
  catalogItemId: string;
  name: string;
  componentKind: string;
  slot: HardwareInstallSlot;
}

export interface AtHomeSparePart {
  instanceId: string;
  catalogItemId: string;
  name: string;
  componentKind: string;
  targetSlot: HardwareInstallSlot;
  compatible: boolean;
  reason?: string;
}

export interface AtHomeHardwareWorkbenchView {
  installed: AtHomeInstalledPart[];
  spares: AtHomeSparePart[];
}

function nameForCatalogItem(catalogItemId: string): string {
  const catalog = getPhysicalCatalogItem(catalogItemId);
  const component = catalog?.component as { name?: string } | undefined;
  return component?.name ?? catalogItemId;
}

function firstRamTargetSlot(engine: SimulationEngine): HardwareInstallSlot {
  const installedRamSlots = new Set(
    engine.getState().inventory.items
      .filter((item) => item.location === 'installed')
      .map((item) => (item as SlottedOwnedItem).installSlot)
      .filter((slot): slot is HardwareInstallSlot => Boolean(slot?.startsWith('ram:'))),
  );

  for (let index = 0; index < 16; index += 1) {
    const slot = `ram:${index}` as HardwareInstallSlot;
    if (!installedRamSlots.has(slot)) return slot;
  }

  return 'ram:0';
}

function targetSlotForComponent(engine: SimulationEngine, componentKind: string): HardwareInstallSlot | null {
  switch (componentKind) {
    case 'chassis': return 'chassis';
    case 'motherboard': return 'motherboard';
    case 'cpu': return 'cpu';
    case 'ram': return firstRamTargetSlot(engine);
    case 'storage': return 'storage:0';
    case 'optical': return 'optical:0';
    case 'sound': return 'sound';
    case 'network': return 'network';
    case 'monitor': return 'monitor:0';
    default: return null;
  }
}

function validateCandidate(
  engine: SimulationEngine,
  instanceId: string,
  targetSlot: HardwareInstallSlot,
): ActionResult {
  if (targetSlot === 'storage:0') {
    const inventory = new InventoryEngine(engine.getState().inventory);
    try {
      inventory.installOwnedHardware(instanceId, targetSlot);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'This storage drive cannot be installed.',
      };
    }
  }

  const clone = new SimulationEngine();
  clone.loadSnapshot(engine.exportSnapshot() as any);
  return clone.installOwnedHardwareAtHome(instanceId, targetSlot);
}

export function getAtHomeHardwareWorkbench(
  engine: SimulationEngine,
): ActionResult<AtHomeHardwareWorkbenchView> {
  const state = engine.getState();
  if (state.player.location !== 'home') {
    return { success: false, error: 'Hardware management is only available in Room 104.' };
  }
  if (!state.computer.assembled) {
    return { success: false, error: 'Set up the computer before managing installed hardware.' };
  }

  const installed: AtHomeInstalledPart[] = state.inventory.items.flatMap((item) => {
    if (item.location !== 'installed') return [];
    const slotted = item as SlottedOwnedItem;
    if (!slotted.installSlot) return [];
    const catalog = getPhysicalCatalogItem(item.catalogItemId);
    if (!catalog || (catalog.kind !== 'hardware' && catalog.kind !== 'display')) return [];
    return [{
      instanceId: item.instanceId,
      catalogItemId: item.catalogItemId,
      name: nameForCatalogItem(item.catalogItemId),
      componentKind: catalog.componentKind,
      slot: slotted.installSlot,
    }];
  });

  const spares: AtHomeSparePart[] = state.inventory.items.flatMap((item) => {
    if (item.location !== 'room_package') return [];
    const catalog = getPhysicalCatalogItem(item.catalogItemId);
    if (!catalog || (catalog.kind !== 'hardware' && catalog.kind !== 'display')) return [];
    const targetSlot = targetSlotForComponent(engine, catalog.componentKind);
    if (!targetSlot) return [];

    const validation = validateCandidate(engine, item.instanceId, targetSlot);
    return [{
      instanceId: item.instanceId,
      catalogItemId: item.catalogItemId,
      name: nameForCatalogItem(item.catalogItemId),
      componentKind: catalog.componentKind,
      targetSlot,
      compatible: validation.success,
      ...(validation.success ? {} : { reason: validation.error ?? 'This part cannot be installed.' }),
    }];
  });

  return { success: true, data: { installed, spares } };
}
