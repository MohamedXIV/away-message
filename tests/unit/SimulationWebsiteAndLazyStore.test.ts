import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';

describe('#172 website/shop owner-only projections and lazy legacy state', () => {
  it('publishes player-visible website events and flags without NPC semantic records', () => {
    const engine = new SimulationEngine();
    const actor = engine.social.getBuddies()[0]!;
    engine.world.establishSemanticFact({
      id: 'secret:social', subjectId: actor.id, predicate: 'private_ledger',
      value: 'SECRET_ONLY_IN_WORLD_LEDGER',
      established: { kind: 'system', sourceId: 'hidden', atMinute: 480 },
    });
    engine.world.setFlag('test_public_site_flag', true);
    const broad = vi.spyOn(engine, 'getState');
    const worldState = vi.spyOn(engine.world, 'getState');
    const allMyPlace = vi.spyOn(engine.myplace, 'getState');
    const allProfiles = vi.spyOn(engine.myplace, 'getAllNpcProfiles');
    const site = engine.getWebsiteRead();
    // FindIt / CityWire / shop sites must not clone the entire social site
    // on every unrelated world or cash revision.
    expect('myplace' in site).toBe(false);
    expect(allMyPlace).not.toHaveBeenCalled();
    expect(allProfiles).not.toHaveBeenCalled();
    expect(site.world.flags.test_public_site_flag).toBe(true);
    expect(site.narrativeFlags.test_public_site_flag).toBe(true);
    expect(site.world.semanticKnowledge).toBeUndefined();
    expect(site.world.buddyKnowledge).toEqual({});
    expect(JSON.stringify(site)).not.toContain('SECRET_ONLY_IN_WORLD_LEDGER');
    expect(JSON.parse(JSON.stringify(site))).toEqual(site);
    expect(broad).not.toHaveBeenCalled();
    expect(worldState).not.toHaveBeenCalled();
  });

  it('provides room-package counts and purchase flags without serializing owned hardware', () => {
    const game = new SimulationEngine();
    const broad = vi.spyOn(game, 'getState');
    const items = vi.spyOn(game.inventory, 'getState');
    const before = game.getShopRead();
    expect(before.cash).toBe(game.economy.getState().cash);
    const itemId = 'bundle_scrapyard';
    const result = game.purchaseStoreItem('silicon_spares', itemId);
    expect(result.success).toBe(true);
    const inventoryReadsDuringPurchase = items.mock.calls.length;
    const after = game.getShopRead();
    // Purchase coordination may explicitly inspect inventory; the shop
    // projection itself must not clone the owned item list again.
    expect(items.mock.calls.length).toBe(inventoryReadsDuringPurchase);
    expect(after.purchaseCounts[itemId]).toBe(1);
    expect(after.roomPackageCount).toBeGreaterThan(before.roomPackageCount);
    expect(JSON.stringify(after)).not.toContain('instanceId');
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
    expect(broad).not.toHaveBeenCalled();

  });

  it('does not invoke a full snapshot while 500-actor game produces normal revisions', () => {
    const fixture = createSimulationBenchmarkFixture(500);
    const game = fixture.engine;
    const previous = useSimulationStore.getState().engine;
    const spy = vi.spyOn(game, 'getState');
    try {
      useSimulationStore.getState().setEngine(game);
      const before = game.getRevision();
      game.world.setFlag('population_publication', true);
      game.publishExternalChange();
      expect(game.getRevision()).toBeGreaterThan(before);
      expect(spy).not.toHaveBeenCalled();
      const store = useSimulationStore.getState();
      expect(store.activeView).toBe(game.getHudProjection().activeView);
      expect(store.isPaused).toBe(game.clock.isPaused());
      expect(spy).not.toHaveBeenCalled();
      expect(store.state.time.totalMinutes).toBe(game.clock.getTotalMinutes());
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      useSimulationStore.getState().setEngine(previous);
      spy.mockRestore();
    }
  }, 30_000);
  it('generates bounded public NightBoard threads without exposing the Social roster', () => {
    const engine = new SimulationEngine();
    const broad = vi.spyOn(engine, 'getState');
    const social = vi.spyOn(engine.social, 'getState');
    const world = vi.spyOn(engine.world, 'getState');
    const before = engine.getNightBoardRead();
    expect(before.revision).toBe(engine.getRevision());
    expect(before.threads.length).toBeGreaterThan(0);
    expect(before.threads.length).toBeLessThanOrEqual(8);
    expect(Object.keys(before).sort()).toEqual(['revision', 'threads']);
    expect(JSON.parse(JSON.stringify(before))).toEqual(before);
    const stable = engine.getNightBoardRead();
    expect(stable.threads).toEqual(before.threads);
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();

    const revision = engine.getRevision();
    engine.advanceGameMinutes(7 * 1440);
    // The tick is deliberately outside the read audit: only count owner
    // projections assembled to satisfy the newly opened forum tab.
    broad.mockClear();
    social.mockClear();
    world.mockClear();
    const next = engine.getNightBoardRead();
    expect(next.revision).toBeGreaterThan(revision);
    expect(next.threads.length).toBeLessThanOrEqual(8);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    expect(world).not.toHaveBeenCalled();
  });

});
