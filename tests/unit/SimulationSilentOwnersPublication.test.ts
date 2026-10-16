import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { PhysicalShopFixtureDefinition } from '../../src/engine/PhysicalShopEngine';
import { GENERATED_VENUE_DEFINITIONS } from '../../src/engine/venue/GeneratedVenueDefinitions';

const STORE = 'corner_mart';
const SEED = 'bounded-domain-owner-fixture';
const FIXTURES: readonly PhysicalShopFixtureDefinition[] = [{
  id: 'fixture:shelf',
  slots: [
    { id: 'fixture:shelf:0', eligibleDefinitionIds: ['corner-mart:noodles_cup'] },
  ],
}];

describe('#172 silent owner publication boundaries', () => {
  it('does not mutate canonical shop/item owners on React-safe reads; first arrival publishes exactly once', () => {
    const game = new SimulationEngine();
    const seen: Array<{ changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => seen.push(change));
    seen.length = 0;
    const before = game.getRevision();
    const physicalBefore = game.getPhysicalWorldState();
    const broad = vi.spyOn(game, 'getState');

    const stock = game.getPhysicalShopState(STORE, SEED, FIXTURES);
    expect(stock.stockBySlot['fixture:shelf:0']).toBeDefined();
    expect(game.getPhysicalShopCashierCapabilities(STORE, SEED, FIXTURES))
      .toEqual({ talk: true, checkout: false });
    expect(game.getPhysicalShopState(STORE, SEED, FIXTURES)).toEqual(stock);
    expect(game.getPhysicalWorldState()).toEqual(physicalBefore);
    expect(game.getRevision()).toBe(before);
    expect(seen).toHaveLength(0);
    expect(game.getAllPhysicalShopStates()[STORE]).toBeUndefined();

    expect(game.initializePhysicalShop(STORE, SEED, FIXTURES)).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.changedDomains).toEqual(expect.arrayContaining(['physical', 'shop', 'unknown']));
    expect(game.getAllPhysicalShopStates()[STORE]).toEqual(stock);
    expect(game.getPhysicalWorldState().items[stock.stockBySlot['fixture:shelf:0']!]).toBeDefined();
    expect(game.initializePhysicalShop(STORE, SEED, FIXTURES)).toBe(false);
    expect(game.getRevision()).toBe(before + 1);
    expect(broad).not.toHaveBeenCalled();
    stop();
  });

  it('keeps a rejected checkout from implicitly seeding a never-opened shop', () => {
    const game = new SimulationEngine();
    const before = game.getRevision();
    const emptyWorld = game.getPhysicalWorldState();
    const rejected = game.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:noodles_cup': 2,
    });
    expect(rejected.success).toBe(false);
    expect(game.getPhysicalWorldState()).toEqual(emptyWorld);
    expect(game.getAllPhysicalShopStates()[STORE]).toBeUndefined();
    expect(game.getRevision()).toBe(before);
  });

  it('publishes physical/shop domains for exact stock transfers, with stable ordering and no full snapshot', () => {
    const game = new SimulationEngine();
    const stock = game.getPhysicalShopState(STORE, SEED, FIXTURES);
    const itemId = stock.stockBySlot['fixture:shelf:0']!;
    expect(itemId).toBeDefined();
    const getState = vi.spyOn(game, 'getState');
    const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => changes.push(change));
    changes.length = 0;

    const first = game.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    expect(first.location.kind).toBe('container');
    expect(changes).toHaveLength(1);
    // Reconciliation may also legitimately emit a mood source event on the
    // first publication; it must not be discarded to force a smaller set.
    expect(changes[0]!.changedDomains).toEqual(
      expect.arrayContaining(['physical', 'shop', 'unknown']),
    );
    expect(changes[0]!.changedDomains).toEqual([
      ...changes[0]!.changedDomains.filter(domain => domain !== 'unknown').sort(),
      'unknown',
    ]);
    expect(getState).not.toHaveBeenCalled();

    game.returnPhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    expect(changes).toHaveLength(2);
    expect(changes[1]!.revision).toBe(changes[0]!.revision + 1);
    expect(changes[1]!.changedDomains).toEqual(['physical', 'shop', 'unknown']);
    expect(new Set(changes[1]!.changedDomains).size).toBe(changes[1]!.changedDomains.length);
    expect(JSON.parse(JSON.stringify(changes[1]))).toEqual(changes[1]);
    expect(getState).not.toHaveBeenCalled();
    stop();
  });

  it('coalesces nested economy action and material/shop checkout into one revision; rejected checkout stays silent', () => {
    const game = new SimulationEngine();
    game.dispatchAction({ type: 'PLAYER_EARN_CASH', amount: 100, reason: 'shop owner test' });
    const itemId = game.getPhysicalShopState(STORE, SEED, FIXTURES).stockBySlot['fixture:shelf:0']!;
    game.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => changes.push(change));
    changes.length = 0;
    const previous = game.getRevision();

    const checkout = game.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:noodles_cup': 2,
    });
    expect(checkout.success).toBe(true);
    expect(game.getRevision()).toBe(previous + 1);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changedDomains).toEqual(
      expect.arrayContaining(['physical', 'shop', 'player', 'unknown']),
    );
    expect(new Set(changes[0]!.changedDomains).size).toBe(changes[0]!.changedDomains.length);
    expect(game.getPhysicalShopState(STORE, SEED, FIXTURES).ownershipByItemId[itemId])
      .toBe('owned');

    const revision = game.getRevision();
    expect(game.checkoutPhysicalShop(STORE, SEED, FIXTURES, {
      'corner-mart:noodles_cup': 2,
    }).success).toBe(false);
    expect(game.getRevision()).toBe(revision);
    expect(changes).toHaveLength(1);
    stop();
  });

  it('attributes direct physical transfers without a snapshot, and does not publish thrown operations', () => {
    const game = new SimulationEngine();
    const itemId = game.getPhysicalShopState(STORE, SEED, FIXTURES).stockBySlot['fixture:shelf:0']!;
    game.takePhysicalShopItem(STORE, SEED, FIXTURES, itemId);
    const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => changes.push(change));
    changes.length = 0;
    const broad = vi.spyOn(game, 'getState');

    const item = game.transferPhysicalItem(itemId, { kind: 'worldAnchor', anchorId: 'test:drop' });
    expect(item.location).toEqual({ kind: 'worldAnchor', anchorId: 'test:drop' });
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changedDomains).toEqual(['physical', 'unknown']);
    expect(broad).not.toHaveBeenCalled();

    const previous = game.getRevision();
    expect(() => game.transferPhysicalItem('unknown:instance', {
      kind: 'worldAnchor', anchorId: 'test:drop',
    })).toThrow();
    expect(game.getRevision()).toBe(previous);
    expect(changes).toHaveLength(1);
    stop();
  });

  it('attributes silent venue role assignments through the canonical owner', () => {
    const game = new SimulationEngine();
    const role = GENERATED_VENUE_DEFINITIONS.roles[0];
    expect(role).toBeDefined();
    const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
    const stop = game.subscribeChanges(change => changes.push(change));
    changes.length = 0;
    const assignment = {
      id: 'test:role-assignment',
      actorId: 'test:venue-actor',
      roleId: role!.id,
      sourceKind: 'test',
      sourceId: 'test:source',
      status: 'active' as const,
      stationId: null,
    };
    game.setVenueRoleAssignment(assignment);
    expect(game.getVenueRuntimeState().roleAssignments[assignment.id]).toEqual(assignment);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changedDomains).toEqual(expect.arrayContaining(['venue', 'unknown']));
    expect(changes[0]!.changedDomains).toEqual([
      ...changes[0]!.changedDomains.filter(domain => domain !== 'unknown').sort(),
      'unknown',
    ]);
    stop();
  });
});
