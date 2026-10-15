import { PLAYER_INVENTORY_CONTAINER_ID } from '../PhysicalItemBridge';
import {
  PhysicalShopEngine,
  type PhysicalShopFixtureDefinition,
  type PhysicalShopState,
} from '../PhysicalShopEngine';
import type { ItemInstance } from '../PhysicalItemEngine';
import {
  checkoutPhysicalShop,
  type PhysicalShopCashPort,
  type PhysicalShopCheckoutResult,
} from '../PhysicalShopCheckout';
import type { MaterialWorldRuntime } from './MaterialWorldRuntime';

/**
 * One canonical owner for persisted physical shop sessions.
 *
 * Item locations/containers are never copied into shop state: they are
 * committed through MaterialWorldRuntime only. PhysicalShopEngine is an
 * ephemeral transaction over the same item authority, not a second store.
 * Cash stays inside Economy, exposed through the narrow checkout port.
 */
export class PhysicalShopSessionRuntime {
  private states: Record<string, PhysicalShopState>;

  constructor(
    private readonly material: MaterialWorldRuntime,
    private readonly cash: PhysicalShopCashPort,
    initial?: Readonly<Record<string, PhysicalShopState>>,
  ) {
    this.states = clonePhysicalShopStates(initial ?? {});
  }

  public loadState(states?: Readonly<Record<string, PhysicalShopState>>): void {
    this.states = clonePhysicalShopStates(states ?? {});
  }

  public getState(): Record<string, PhysicalShopState> {
    return clonePhysicalShopStates(this.states);
  }

  private open(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): { shop: PhysicalShopEngine; physicalItems: ReturnType<MaterialWorldRuntime['physicalItems']> } {
    const physicalItems = this.material.physicalItems();
    const shop = new PhysicalShopEngine({
      storeId, worldSeed, physicalItems, fixtures,
      persistedState: this.states[storeId],
    });
    // First entry deterministically materializes the exact stock once.
    this.commit(storeId, shop, physicalItems);
    return { shop, physicalItems };
  }

  private commit(
    storeId: string,
    shop: PhysicalShopEngine,
    physicalItems: ReturnType<MaterialWorldRuntime['physicalItems']>,
  ): void {
    this.material.commitWorld(physicalItems.getState());
    this.states = {
      ...this.states,
      [storeId]: shop.getState(),
    };
  }

  public getPhysicalShopState(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): PhysicalShopState {
    return this.open(storeId, worldSeed, fixtures).shop.getState();
  }

  public getPhysicalShopCashierCapabilities(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
  ): { talk: true; checkout: boolean } {
    return this.open(storeId, worldSeed, fixtures).shop.getCashierCapabilities();
  }

  public takePhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
    destinationContainerInstanceId = PLAYER_INVENTORY_CONTAINER_ID,
  ): ItemInstance {
    const { shop, physicalItems } = this.open(storeId, worldSeed, fixtures);
    shop.take(instanceId, destinationContainerInstanceId);
    this.commit(storeId, shop, physicalItems);
    return physicalItems.getItem(instanceId);
  }

  public returnPhysicalShopItem(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    instanceId: string,
  ): ItemInstance {
    const { shop, physicalItems } = this.open(storeId, worldSeed, fixtures);
    shop.returnToStock(instanceId);
    this.commit(storeId, shop, physicalItems);
    return physicalItems.getItem(instanceId);
  }

  public checkoutPhysicalShop(
    storeId: string,
    worldSeed: string,
    fixtures: readonly PhysicalShopFixtureDefinition[],
    pricesByDefinitionId: Readonly<Record<string, number>>,
  ): PhysicalShopCheckoutResult {
    const { shop, physicalItems } = this.open(storeId, worldSeed, fixtures);
    const result = checkoutPhysicalShop(this.cash, shop, pricesByDefinitionId);
    this.commit(storeId, shop, physicalItems);
    return result;
  }
}

function clonePhysicalShopStates(
  states: Readonly<Record<string, PhysicalShopState>>,
): Record<string, PhysicalShopState> {
  return Object.fromEntries(
    Object.entries(states).map(([storeId, state]) => [
      storeId, {
        stockBySlot: { ...state.stockBySlot },
        ownershipByItemId: { ...state.ownershipByItemId },
        originalSlotByItemId: { ...state.originalSlotByItemId },
      },
    ]),
  );
}
