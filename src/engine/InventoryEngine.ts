import type {
  OwnedItem,
  OwnedItemKind,
  OwnedItemLocation,
  PlayerInventoryState,
} from './types';
import type { StoreSkuContent } from './hardware/types';
import { getPhysicalCatalogItem } from './hardware/catalog';
import { createEmptyInventoryState } from './hardware/state';

export type HardwareInstallSlot =
  | 'chassis'
  | 'motherboard'
  | 'cpu'
  | 'sound'
  | 'network'
  | `ram:${number}`
  | `storage:${number}`
  | `optical:${number}`
  | `monitor:${number}`;

export type SlottedOwnedItem = OwnedItem & { installSlot?: HardwareInstallSlot };

export interface PreparedInventoryPurchase {
  skuId: string;
  purchaseOrdinal: number;
  items: OwnedItem[];
  consumeLegacyStarterRecovery: boolean;
}

export interface PreparedInventoryInstall {
  instanceIds: string[];
  sourceItems: OwnedItem[];
}

function cloneState(state: PlayerInventoryState): PlayerInventoryState {
  const transitional = state as PlayerInventoryState & {
    purchaseCounts?: Record<string, number>;
  };
  return {
    items: state.items.map((item) => ({ ...item })),
    purchaseCounts: { ...(transitional.purchaseCounts ?? {}) },
    legacyRecovery: state.legacyRecovery ? { ...state.legacyRecovery } : undefined,
  };
}

function assertContents(
  contents: readonly StoreSkuContent[],
  catalogKinds: Readonly<Record<string, OwnedItemKind>>,
): void {
  if (contents.length === 0) throw new Error('Store SKU has no physical contents.');
  for (const content of contents) {
    if (!Number.isInteger(content.quantity) || content.quantity < 1) {
      throw new Error(`Invalid quantity for ${content.catalogItemId}.`);
    }
    if (!catalogKinds[content.catalogItemId]) {
      throw new Error(`Unknown physical catalog item: ${content.catalogItemId}.`);
    }
  }
}

function componentKindForSlot(slot: HardwareInstallSlot): string {
  if (slot === 'chassis' || slot === 'motherboard' || slot === 'cpu' || slot === 'sound' || slot === 'network') {
    return slot;
  }

  const separator = slot.indexOf(':');
  const kind = slot.slice(0, separator);
  const rawIndex = slot.slice(separator + 1);
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid hardware install slot: ${slot}.`);
  }
  return kind;
}

function indexedSlotNumber(slot: HardwareInstallSlot, expectedKind: string): number | null {
  if (!slot.startsWith(`${expectedKind}:`)) return null;
  const index = Number(slot.slice(expectedKind.length + 1));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function deterministicInstallSlots(items: readonly OwnedItem[]): Map<string, HardwareInstallSlot> {
  const slots = new Map<string, HardwareInstallSlot>();
  const indexes = { ram: 0, storage: 0, optical: 0, monitor: 0 };
  const singletonKinds = new Set(['chassis', 'motherboard', 'cpu', 'sound', 'network']);
  const occupiedSingletons = new Set<string>();

  for (const item of items) {
    const catalogItem = getPhysicalCatalogItem(item.catalogItemId);
    if (!catalogItem || (catalogItem.kind !== 'hardware' && catalogItem.kind !== 'display')) continue;
    if (catalogItem.kind !== item.kind) {
      throw new Error(`Owned item ${item.instanceId} kind does not match its physical catalog definition.`);
    }

    const kind = catalogItem.componentKind;
    if (kind === 'ram' || kind === 'storage' || kind === 'optical' || kind === 'monitor') {
      const index = indexes[kind];
      slots.set(item.instanceId, `${kind}:${index}` as HardwareInstallSlot);
      indexes[kind] += 1;
      continue;
    }

    if (singletonKinds.has(kind)) {
      if (occupiedSingletons.has(kind)) {
        throw new Error(`Prepared owned-item installation has multiple ${kind} components.`);
      }
      occupiedSingletons.add(kind);
      slots.set(item.instanceId, kind as HardwareInstallSlot);
    }
  }

  return slots;
}

export class InventoryEngine {
  private state: PlayerInventoryState;

  constructor(initial?: Partial<PlayerInventoryState>) {
    const empty = createEmptyInventoryState();
    const transitional = initial as
      | (Partial<PlayerInventoryState> & { purchaseCounts?: Record<string, number> })
      | undefined;
    this.state = {
      ...empty,
      items: initial?.items?.map((item) => ({ ...item })) ?? [],
      purchaseCounts: { ...(transitional?.purchaseCounts ?? {}) },
      legacyRecovery: initial?.legacyRecovery ? { ...initial.legacyRecovery } : undefined,
    };
  }

  public getState(): Readonly<PlayerInventoryState> {
    return cloneState(this.state);
  }

  public loadState(state: PlayerInventoryState): void {
    this.state = cloneState(state);
  }

  public moveOwnedItem(
    instanceId: string,
    allowedFrom: readonly OwnedItemLocation[],
    to: OwnedItemLocation,
  ): OwnedItem {
    const matches = this.state.items.filter((item) => item.instanceId === instanceId);
    if (matches.length !== 1) {
      throw new Error(`Owned item instance is missing or ambiguous: ${instanceId}.`);
    }

    const current = matches[0]!;
    if (!allowedFrom.includes(current.location)) {
      throw new Error(
        `Owned item ${instanceId} cannot move from ${current.location} to ${to}.`,
      );
    }

    const moved = { ...current, location: to };
    this.state = {
      ...this.state,
      items: this.state.items.map((item) =>
        item.instanceId === instanceId ? moved : { ...item },
      ),
    };
    return { ...moved };
  }

  public installOwnedHardware(
    instanceId: string,
    slot: HardwareInstallSlot,
  ): { displacedInstanceId: string | null } {
    const matches = this.state.items.filter((item) => item.instanceId === instanceId);
    if (matches.length !== 1) {
      throw new Error(`Owned item instance is missing or ambiguous: ${instanceId}.`);
    }

    const target = matches[0]!;
    if (target.location !== 'room_package') {
      throw new Error(`Owned item ${instanceId} is not in the room_package at home.`);
    }

    const catalogItem = getPhysicalCatalogItem(target.catalogItemId);
    if (!catalogItem || (catalogItem.kind !== 'hardware' && catalogItem.kind !== 'display')) {
      throw new Error(`Owned item ${instanceId} is not installable hardware.`);
    }
    if (catalogItem.kind !== target.kind) {
      throw new Error(`Owned item ${instanceId} kind does not match its physical catalog definition.`);
    }

    const expectedComponentKind = componentKindForSlot(slot);
    if (catalogItem.componentKind !== expectedComponentKind) {
      throw new Error(
        `Owned item ${instanceId} (${catalogItem.componentKind}) is not compatible with ${slot}.`,
      );
    }

    const installedMotherboards = this.state.items.filter((item) => {
      const slotted = item as SlottedOwnedItem;
      return item.location === 'installed' && slotted.installSlot === 'motherboard';
    });
    if (installedMotherboards.length > 1) {
      throw new Error('Installed motherboard is ambiguous.');
    }

    const installedMotherboard = installedMotherboards[0];
    const motherboardCatalog = installedMotherboard
      ? getPhysicalCatalogItem(installedMotherboard.catalogItemId)
      : undefined;
    const motherboard = motherboardCatalog?.component as
      | { cpuSocket?: string; ramSlots?: number; maxRamMbPerSlot?: number }
      | undefined;

    if (expectedComponentKind === 'cpu' && motherboard) {
      const cpu = catalogItem.component as { socket?: string };
      if (!cpu.socket || !motherboard.cpuSocket || cpu.socket !== motherboard.cpuSocket) {
        throw new Error(
          `CPU socket ${cpu.socket ?? 'unknown'} is incompatible with motherboard socket ${motherboard.cpuSocket ?? 'unknown'}.`,
        );
      }
    }

    if (expectedComponentKind === 'ram' && motherboard) {
      const ramSlot = indexedSlotNumber(slot, 'ram');
      const ram = catalogItem.component as { sizeMb?: number };
      if (ramSlot === null || motherboard.ramSlots === undefined || ramSlot >= motherboard.ramSlots) {
        throw new Error(`RAM slot ${ramSlot ?? 'unknown'} is not available on the installed motherboard.`);
      }
      if (
        motherboard.maxRamMbPerSlot !== undefined &&
        (ram.sizeMb === undefined || ram.sizeMb > motherboard.maxRamMbPerSlot)
      ) {
        throw new Error(
          `RAM stick exceeds the motherboard per-slot limit of ${motherboard.maxRamMbPerSlot} MB.`,
        );
      }
    }

    const occupied = this.state.items.filter((item) => {
      const slotted = item as SlottedOwnedItem;
      return item.location === 'installed' && slotted.installSlot === slot;
    });
    if (occupied.length > 1) {
      throw new Error(`Installed hardware slot ${slot} is ambiguous.`);
    }

    const displaced = occupied[0] ?? null;
    const installedTarget: SlottedOwnedItem = {
      ...target,
      location: 'installed',
      installSlot: slot,
    };

    this.state = {
      ...this.state,
      items: this.state.items.map((item) => {
        if (item.instanceId === instanceId) return installedTarget;
        if (displaced && item.instanceId === displaced.instanceId) {
          const { installSlot: _installSlot, ...rest } = item as SlottedOwnedItem;
          return { ...rest, location: 'room_package' };
        }
        return { ...item };
      }),
    };

    return { displacedInstanceId: displaced?.instanceId ?? null };
  }

  public prepareInstallOwnedItems(instanceIds: readonly string[]): PreparedInventoryInstall {
    if (instanceIds.length === 0) {
      throw new Error('Cannot install an empty owned-item selection.');
    }

    const requestedIds = new Set<string>();
    const sourceItems: OwnedItem[] = [];

    for (const instanceId of instanceIds) {
      if (requestedIds.has(instanceId)) {
        throw new Error(`Duplicate owned item instance requested: ${instanceId}.`);
      }
      requestedIds.add(instanceId);

      const matches = this.state.items.filter((item) => item.instanceId === instanceId);
      if (matches.length !== 1) {
        throw new Error(`Owned item instance is missing or ambiguous: ${instanceId}.`);
      }

      const item = matches[0]!;
      if (item.location !== 'room_package') {
        throw new Error(`Owned item ${instanceId} is not in the room_package.`);
      }
      sourceItems.push({ ...item });
    }

    return {
      instanceIds: [...instanceIds],
      sourceItems,
    };
  }

  public commitInstallOwnedItems(prepared: PreparedInventoryInstall): void {
    if (prepared.instanceIds.length === 0 || prepared.instanceIds.length !== prepared.sourceItems.length) {
      throw new Error('Invalid prepared owned-item installation.');
    }

    const requestedIds = new Set<string>();
    for (let index = 0; index < prepared.instanceIds.length; index += 1) {
      const instanceId = prepared.instanceIds[index]!;
      if (requestedIds.has(instanceId)) {
        throw new Error(`Duplicate owned item instance requested: ${instanceId}.`);
      }
      requestedIds.add(instanceId);

      const expected = prepared.sourceItems[index]!;
      const matches = this.state.items.filter((item) => item.instanceId === instanceId);
      if (matches.length !== 1) {
        throw new Error(`Stale owned-item installation for ${instanceId}.`);
      }

      const current = matches[0]!;
      if (
        current.location !== 'room_package' ||
        expected.instanceId !== current.instanceId ||
        expected.catalogItemId !== current.catalogItemId ||
        expected.kind !== current.kind ||
        expected.location !== 'room_package'
      ) {
        throw new Error(`Stale owned-item installation for ${instanceId}; item must remain in room_package.`);
      }
    }

    const installSlots = deterministicInstallSlots(prepared.sourceItems);
    this.state = {
      ...this.state,
      items: this.state.items.map((item) => {
        if (!requestedIds.has(item.instanceId)) return { ...item };
        const installSlot = installSlots.get(item.instanceId);
        return installSlot
          ? { ...item, location: 'installed', installSlot }
          : { ...item, location: 'installed' };
      }),
    };
  }

  public canPurchaseSku(skuId: string, repeatable: boolean): { ok: boolean; error?: string } {
    if (!skuId) return { ok: false, error: 'Missing store SKU.' };
    if (!repeatable && (this.state.purchaseCounts[skuId] ?? 0) > 0) {
      return { ok: false, error: 'This item has already been purchased.' };
    }
    return { ok: true };
  }

  public canClaimLegacyStarterRecovery(): boolean {
    return Boolean(
      this.state.legacyRecovery?.starterBundlePurchaseLost === true &&
        this.state.legacyRecovery.consumed === false,
    );
  }

  public preparePurchase(
    skuId: string,
    contents: readonly StoreSkuContent[],
    catalogKinds: Readonly<Record<string, OwnedItemKind>>,
    options?: {
      consumeLegacyStarterRecovery?: boolean;
      location?: OwnedItemLocation;
    },
  ): PreparedInventoryPurchase {
    if (!skuId) throw new Error('Missing store SKU.');
    assertContents(contents, catalogKinds);
    if (options?.consumeLegacyStarterRecovery && !this.canClaimLegacyStarterRecovery()) {
      throw new Error('Legacy starter recovery is not available.');
    }

    const purchaseOrdinal = (this.state.purchaseCounts[skuId] ?? 0) + 1;
    const location = options?.location ?? 'room_package';
    const items: OwnedItem[] = [];

    for (const content of contents) {
      const kind = catalogKinds[content.catalogItemId]!;
      for (let unitOrdinal = 1; unitOrdinal <= content.quantity; unitOrdinal += 1) {
        items.push({
          instanceId: `purchase:${skuId}:${purchaseOrdinal}:${content.catalogItemId}:${unitOrdinal}`,
          catalogItemId: content.catalogItemId,
          kind,
          location,
        });
      }
    }

    return {
      skuId,
      purchaseOrdinal,
      items,
      consumeLegacyStarterRecovery: options?.consumeLegacyStarterRecovery === true,
    };
  }

  public commitPurchase(prepared: PreparedInventoryPurchase): void {
    const expectedOrdinal = (this.state.purchaseCounts[prepared.skuId] ?? 0) + 1;
    if (prepared.purchaseOrdinal !== expectedOrdinal) {
      throw new Error(`Stale purchase ordinal for ${prepared.skuId}.`);
    }
    if (prepared.items.length === 0) throw new Error('Cannot commit an empty purchase.');
    if (prepared.consumeLegacyStarterRecovery && !this.canClaimLegacyStarterRecovery()) {
      throw new Error('Legacy starter recovery is not available.');
    }

    const existingIds = new Set(this.state.items.map((item) => item.instanceId));
    for (const item of prepared.items) {
      if (existingIds.has(item.instanceId)) {
        throw new Error(`Duplicate owned item instance: ${item.instanceId}.`);
      }
      existingIds.add(item.instanceId);
    }

    this.state = {
      items: [...this.state.items, ...prepared.items.map((item) => ({ ...item }))],
      purchaseCounts: {
        ...this.state.purchaseCounts,
        [prepared.skuId]: prepared.purchaseOrdinal,
      },
      legacyRecovery: this.state.legacyRecovery
        ? {
            ...this.state.legacyRecovery,
            consumed: prepared.consumeLegacyStarterRecovery
              ? true
              : this.state.legacyRecovery.consumed,
          }
        : undefined,
    };
  }
}
