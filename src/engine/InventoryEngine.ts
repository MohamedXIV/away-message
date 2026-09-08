import type {
  OwnedItem,
  OwnedItemKind,
  OwnedItemLocation,
  PlayerInventoryState,
} from './types';
import type { StoreSkuContent } from './hardware/types';
import { createEmptyInventoryState } from './hardware/state';

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

    this.state = {
      ...this.state,
      items: this.state.items.map((item) =>
        requestedIds.has(item.instanceId) ? { ...item, location: 'installed' } : { ...item },
      ),
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
