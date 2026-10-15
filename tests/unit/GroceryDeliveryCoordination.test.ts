import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { GroceryDeliveryCoordination } from '../../src/engine/kernel/GroceryDeliveryCoordination';

function fixture() {
  const owners = createCoreDomainOwners();
  let publications = 0;
  const groceries = new GroceryDeliveryCoordination(
    owners,
    (minutes) => { owners.clock.advanceMinutes(minutes); },
    () => { publications += 1; },
  );
  return { owners, groceries, publications: () => publications };
}

describe('GroceryDeliveryCoordination', () => {
  it('rejects invalid carts and unaffordable orders without mutating money', () => {
    const { owners, groceries, publications } = fixture();
    const cash = owners.economy.getCash();

    expect(groceries.placeGroceryOrder([], 'delivery', 480).success).toBe(false);
    expect(groceries.placeGroceryOrder(
      [{ sku: 'grocery_feast', qty: 9 }], 'delivery', 480,
    ).success).toBe(false);

    expect(owners.economy.getCash()).toBe(cash);
    expect(owners.delivery.getState().orders).toHaveLength(0);
    expect(publications()).toBe(0);
  });

  it('uses the canonical clock and pantry for a pickup', () => {
    const { owners, groceries, publications } = fixture();
    const beforeMinute = owners.clock.getTotalMinutes();
    const beforeCash = owners.economy.getCash();
    const beforePantry = owners.economy.getState().pantry.noodles;

    const result = groceries.placeGroceryOrder(
      [{ sku: 'noodles_cup', qty: 2 }], 'pickup', beforeMinute,
    );

    expect(result.success).toBe(true);
    expect(owners.clock.getTotalMinutes()).toBe(beforeMinute + 30);
    expect(owners.economy.getCash()).toBe(beforeCash - 4);
    expect(owners.economy.getState().pantry.noodles).toBe(beforePantry + 2);
    expect(owners.delivery.getState().orders[0]?.status).toBe('done');
    expect(publications()).toBe(1);
  });

  it('settles due deliveries exactly once and credits the existing pantry authority', () => {
    const { owners, groceries } = fixture();
    const now = owners.clock.getTotalMinutes();
    const pantryBefore = owners.economy.getState().pantry.noodles;

    const placed = groceries.placeGroceryOrder(
      [{ sku: 'noodles_cup', qty: 1 }], 'delivery', now,
    );
    expect(placed.success).toBe(true);
    expect(placed.data?.etaMinute).toBeGreaterThan(now);

    groceries.processDeliveries();
    expect(owners.economy.getState().pantry.noodles).toBe(pantryBefore);

    const eta = placed.data!.etaMinute;
    owners.clock.setTotalMinutes(eta);
    groceries.processDeliveries();
    expect(owners.economy.getState().pantry.noodles).toBe(pantryBefore + 1);
    expect(owners.world.getFlag(`delivery_arrived_${placed.data!.orderId}`)).toBe(true);

    groceries.processDeliveries();
    expect(owners.economy.getState().pantry.noodles).toBe(pantryBefore + 1);
  });
});
