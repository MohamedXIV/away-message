import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { PhysicalShopFixtureDefinition } from '../../src/engine/PhysicalShopEngine';
import { PhysicalShopSessionRuntime } from '../../src/engine/kernel/PhysicalShopSessionRuntime';
import { PLAYER_INVENTORY_CONTAINER_ID } from '../../src/engine/PhysicalItemBridge';

const STORE = 'corner_mart';
const SEED = 'kernel-session-integration';
const FIXTURES: readonly PhysicalShopFixtureDefinition[] = [
  {
    id: 'fixture:shelf',
    slots: [
      { id: 'fixture:shelf:0', eligibleDefinitionIds: ['corner-mart:noodles_cup'] },
      { id: 'fixture:shelf:1', eligibleDefinitionIds: ['corner-mart:grocery_bag'] },
    ],
  },
];

function session(engine: SimulationEngine): PhysicalShopSessionRuntime {
  return (engine as unknown as { physical: { physicalShop: PhysicalShopSessionRuntime } }).physical.physicalShop;
}

describe('PhysicalShopSessionRuntime — single persisted shop and item owner', () => {
  it('keeps canonical stock/ownership in one owner across public queries and snapshot reload', () => {
    const engine = new SimulationEngine();
    const owner = session(engine);
    const first = engine.getPhysicalShopState(STORE, SEED, FIXTURES);
    expect(owner.getPhysicalShopState(STORE, SEED, FIXTURES)).toEqual(first);
    // Inspecting deterministic stock must not create canonical items or a
    // hidden revision. Initial arrival explicitly commits the seed once.
    expect(engine.exportSnapshot().physicalShops[STORE]).toBeUndefined();
    expect(engine.initializePhysicalShop(STORE, SEED, FIXTURES)).toBe(true);
    expect(engine.initializePhysicalShop(STORE, SEED, FIXTURES)).toBe(false);
    expect(engine.exportSnapshot().physicalShops[STORE]).toEqual(first);

    const itemId = first.stockBySlot['fixture:shelf:0']!;
    engine.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    const taken = engine.getPhysicalShopState(STORE, SEED, FIXTURES);
    expect(taken.ownershipByItemId[itemId]).toBe('unpaid');
    expect(engine.getPhysicalWorldState().items[itemId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });

    const saved = engine.exportSnapshot();
    engine.loadSnapshot(saved);
    expect(session(engine)).toBe(owner);
    expect(engine.exportSnapshot().physicalShops[STORE]).toEqual(taken);
    expect(engine.getPhysicalWorldState().items[itemId]?.location).toEqual({
      kind: 'container',
      containerInstanceId: PLAYER_INVENTORY_CONTAINER_ID,
    });
  });

  it('commits exact paid merchandise once and preserves its identity after hydration', () => {
    const engine = new SimulationEngine();
    engine.economy.earnCash(100, 'test-shop-balance');
    const first = engine.getPhysicalShopState(STORE, SEED, FIXTURES);
    const itemId = first.stockBySlot['fixture:shelf:0']!;
    engine.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    const cashBefore = engine.economy.getCash();

    const result = engine.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:noodles_cup': 2,
    });
    expect(result).toEqual({ success: true, total: 2, itemIds: [itemId] });
    expect(engine.economy.getCash()).toBe(cashBefore - 2);
    expect(engine.getPhysicalShopState(STORE, SEED, FIXTURES).ownershipByItemId[itemId])
      .toBe('owned');

    expect(engine.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:noodles_cup': 2,
    }).success).toBe(false);
    expect(engine.economy.getCash()).toBe(cashBefore - 2);

    const restored = new SimulationEngine(engine.exportSnapshot());
    expect(restored.getPhysicalShopState(STORE, SEED, FIXTURES).ownershipByItemId[itemId])
      .toBe('owned');
    expect(restored.getPhysicalWorldState().items[itemId]?.location.kind).toBe('container');
  });

  it('rejects unaffordable checkout while preserving unpaid goods and exact cash', () => {
    const engine = new SimulationEngine();
    const initial = engine.getPhysicalShopState(STORE, SEED, FIXTURES);
    const itemId = initial.stockBySlot['fixture:shelf:1']!;
    engine.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    const before = engine.exportSnapshot();

    const result = engine.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:grocery_bag': before.player.cash + 1000,
    });
    expect(result.success).toBe(false);
    expect(engine.economy.getCash()).toBe(before.player.cash);
    expect(engine.exportSnapshot().physicalShops).toEqual(before.physicalShops);
    expect(engine.exportSnapshot().physicalWorld).toEqual(before.physicalWorld);
  });

  it('returns defensive session projections without giving callers writable authority', () => {
    const engine = new SimulationEngine();
    const source = engine.getPhysicalShopState(STORE, SEED, FIXTURES);
    engine.initializePhysicalShop(STORE, SEED, FIXTURES);
    const detached = session(engine).getState();
    detached[STORE]!.stockBySlot['fixture:shelf:0'] = 'fake';
    expect(engine.getPhysicalShopState(STORE, SEED, FIXTURES)).toEqual(source);
  });
});
