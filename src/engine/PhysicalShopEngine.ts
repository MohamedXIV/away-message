import { PhysicalItemEngine, type PhysicalMaterializationBatch } from './PhysicalItemEngine';

export type ShopOwnership = 'store' | 'unpaid' | 'owned';

export interface PhysicalShopSlotDefinition {
  id: string;
  eligibleDefinitionIds: readonly string[];
}

export interface PhysicalShopFixtureDefinition {
  id: string;
  slots: readonly PhysicalShopSlotDefinition[];
}

export interface PhysicalShopState {
  stockBySlot: Record<string, string>;
  ownershipByItemId: Record<string, ShopOwnership>;
  originalSlotByItemId: Record<string, string>;
}

export interface PhysicalShopEngineOptions {
  storeId: string;
  worldSeed: string;
  physicalItems: PhysicalItemEngine;
  fixtures: readonly PhysicalShopFixtureDefinition[];
  persistedState?: PhysicalShopState;
}

export interface PhysicalShopCheckoutQuote {
  itemIds: string[];
  total: number;
}

function cloneState(state: PhysicalShopState): PhysicalShopState {
  return {
    stockBySlot: { ...state.stockBySlot },
    ownershipByItemId: { ...state.ownershipByItemId },
    originalSlotByItemId: { ...state.originalSlotByItemId },
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function assertId(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must be a non-empty ID.`);
}

export class PhysicalShopEngine {
  private readonly storeId: string;
  private readonly physicalItems: PhysicalItemEngine;
  private readonly slotsById: ReadonlyMap<string, PhysicalShopSlotDefinition>;
  private state: PhysicalShopState;

  public constructor(options: PhysicalShopEngineOptions) {
    assertId(options.storeId, 'Store ID');
    assertId(options.worldSeed, 'World seed');
    this.storeId = options.storeId;
    this.physicalItems = options.physicalItems;

    const slots = options.fixtures.flatMap((fixture) => {
      assertId(fixture.id, 'Fixture ID');
      return fixture.slots;
    });
    const slotsById = new Map<string, PhysicalShopSlotDefinition>();
    for (const slot of slots) {
      assertId(slot.id, 'Shop slot ID');
      if (slotsById.has(slot.id)) throw new Error(`Duplicate shop slot ID: ${slot.id}.`);
      if (slot.eligibleDefinitionIds.length === 0) {
        throw new Error(`Shop slot ${slot.id} has no eligible item definitions.`);
      }
      slotsById.set(slot.id, slot);
    }
    this.slotsById = slotsById;

    if (options.persistedState) {
      this.state = cloneState(options.persistedState);
      this.validatePersistedState();
      return;
    }

    const state: PhysicalShopState = {
      stockBySlot: {},
      ownershipByItemId: {},
      originalSlotByItemId: {},
    };
    const batch: PhysicalMaterializationBatch = { items: [], containers: [] };
    const items = [] as Array<PhysicalMaterializationBatch['items'][number]>;

    for (const slot of slots) {
      const pick = stableHash(`${options.worldSeed}:${options.storeId}:${slot.id}`) % slot.eligibleDefinitionIds.length;
      const definitionId = slot.eligibleDefinitionIds[pick]!;
      const instanceId = `shop:${options.storeId}:${slot.id}:${definitionId}`;
      state.stockBySlot[slot.id] = instanceId;
      state.ownershipByItemId[instanceId] = 'store';
      state.originalSlotByItemId[instanceId] = slot.id;
      items.push({
        instanceId,
        definitionId,
        location: { kind: 'storeStock', storeId: options.storeId, slotId: slot.id },
      });
    }

    this.physicalItems.materializeBatch({ ...batch, items });
    this.state = state;
  }

  public getState(): PhysicalShopState {
    return cloneState(this.state);
  }

  public getCashierCapabilities(): { talk: true; checkout: boolean } {
    return {
      talk: true,
      checkout: Object.values(this.state.ownershipByItemId).some((ownership) => ownership === 'unpaid'),
    };
  }

  public getCheckoutQuote(pricesByDefinitionId: Readonly<Record<string, number>>): PhysicalShopCheckoutQuote {
    const itemIds = Object.entries(this.state.ownershipByItemId)
      .filter(([, ownership]) => ownership === 'unpaid')
      .map(([instanceId]) => instanceId);

    let total = 0;
    for (const instanceId of itemIds) {
      const item = this.physicalItems.getItem(instanceId);
      if (item.location.kind !== 'container') {
        throw new Error(`Unpaid item ${instanceId} is not currently carried in a container.`);
      }
      const price = pricesByDefinitionId[item.definitionId];
      if (!Number.isFinite(price) || price! < 0) {
        throw new Error(`No valid checkout price for item definition ${item.definitionId}.`);
      }
      total += price!;
    }

    return { itemIds, total };
  }

  public finalizeCheckout(quote: PhysicalShopCheckoutQuote): void {
    if (quote.itemIds.length === 0) throw new Error('Checkout quote contains no unpaid goods.');

    for (const instanceId of quote.itemIds) {
      if (this.state.ownershipByItemId[instanceId] !== 'unpaid') {
        throw new Error(`Item ${instanceId} is no longer unpaid store merchandise.`);
      }
      const item = this.physicalItems.getItem(instanceId);
      if (item.location.kind !== 'container') {
        throw new Error(`Unpaid item ${instanceId} is no longer carried in a container.`);
      }
    }

    for (const instanceId of quote.itemIds) {
      this.state.ownershipByItemId[instanceId] = 'owned';
    }
  }

  public take(instanceId: string, destinationContainerInstanceId: string): void {
    if (this.state.ownershipByItemId[instanceId] !== 'store') {
      throw new Error(`Item ${instanceId} is not available store stock.`);
    }
    const current = this.physicalItems.getItem(instanceId);
    if (current.location.kind !== 'storeStock' || current.location.storeId !== this.storeId) {
      throw new Error(`Item ${instanceId} is not physically in store stock.`);
    }

    const slotId = current.location.slotId;
    if (this.state.stockBySlot[slotId] !== instanceId) {
      throw new Error(`Shop slot ${slotId} does not contain item ${instanceId}.`);
    }

    this.physicalItems.transfer(instanceId, {
      kind: 'container',
      containerInstanceId: destinationContainerInstanceId,
    });
    delete this.state.stockBySlot[slotId];
    this.state.ownershipByItemId[instanceId] = 'unpaid';
    this.state.originalSlotByItemId[instanceId] = slotId;
  }

  public returnToStock(instanceId: string): void {
    if (this.state.ownershipByItemId[instanceId] !== 'unpaid') {
      throw new Error(`Item ${instanceId} is not unpaid carried stock.`);
    }
    const slotId = this.state.originalSlotByItemId[instanceId];
    if (!slotId || !this.slotsById.has(slotId)) {
      throw new Error(`Item ${instanceId} has no valid authored return slot.`);
    }
    if (this.state.stockBySlot[slotId]) {
      throw new Error(`Shop slot ${slotId} is already occupied.`);
    }

    this.physicalItems.transfer(instanceId, {
      kind: 'storeStock',
      storeId: this.storeId,
      slotId,
    });
    this.state.stockBySlot[slotId] = instanceId;
    this.state.ownershipByItemId[instanceId] = 'store';
  }

  private validatePersistedState(): void {
    for (const [slotId, instanceId] of Object.entries(this.state.stockBySlot)) {
      if (!this.slotsById.has(slotId)) throw new Error(`Persisted shop slot is not authored: ${slotId}.`);
      if (this.state.ownershipByItemId[instanceId] !== 'store') {
        throw new Error(`Persisted stock item ${instanceId} is not store-owned.`);
      }
      const item = this.physicalItems.getItem(instanceId);
      if (
        item.location.kind !== 'storeStock' ||
        item.location.storeId !== this.storeId ||
        item.location.slotId !== slotId
      ) {
        throw new Error(`Persisted stock item ${instanceId} does not match slot ${slotId}.`);
      }
    }

    for (const [instanceId, ownership] of Object.entries(this.state.ownershipByItemId)) {
      if (ownership === 'store') continue;
      const item = this.physicalItems.getItem(instanceId);
      if (item.location.kind !== 'container') {
        throw new Error(`Persisted carried item ${instanceId} is not located in a container.`);
      }
      const slotId = this.state.originalSlotByItemId[instanceId];
      if (!slotId || !this.slotsById.has(slotId)) {
        throw new Error(`Persisted carried item ${instanceId} has no authored origin slot.`);
      }
    }
  }
}
