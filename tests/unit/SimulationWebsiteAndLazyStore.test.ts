import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { useSimulationStore } from '../../src/store/useSimulationStore';
import { createSimulationBenchmarkFixture } from '../../src/engine/benchmark/SimulationBenchmarkFixture';
import { buildWeeklyNpcThreads, buildWeeklyWeatherThread, npcThreadWeek } from '../../src/engine/BoardDirector';
import { getWeatherForDay, gameDayName } from '../../src/engine/WeatherEngine';

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

  it('preserves the generated public NightBoard story and author ordering without broad Social reads', () => {
    const game = new SimulationEngine();
    const day = game.clock.getTime().day;
    const buddies = game.social.getBuddies().map(buddy => ({
      id: buddy.id,
      displayName: buddy.displayName,
      handle: buddy.handle,
      archetype: buddy.archetype,
      stage: game.social.getRelationshipStage(buddy.id),
      status: buddy.status,
      roles: buddy.roles ?? [],
    }));
    const affinity = (a: string, b: string) => game.social.getAffinity(a, b);
    const titles = game.world.getTriggeredEvents().slice(-256).map(event => event.title);
    const week = npcThreadWeek(day);
    const weeks = [week - 1, week].filter(value => value >= 0);
    const expected = weeks.flatMap(value => buildWeeklyNpcThreads(value * 7 + 1, buddies, affinity, titles));
    for (const value of weeks) {
      const weather = buildWeeklyWeatherThread(value * 7 + 1, buddies, getWeatherForDay, gameDayName, affinity);
      if (weather) expected.push(weather);
    }
    const broad = vi.spyOn(game, 'getState');
    const roster = vi.spyOn(game.social, 'getBuddies');
    const individual = vi.spyOn(game.social, 'getBuddy');
    const actual = game.getNightBoardRead();
    expect(actual.threads).toEqual(expected);
    expect(roster).not.toHaveBeenCalled();
    expect(individual).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
    expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
  });

  it('bounds a 500-actor public forum source read without cloning BuddyCharacter or private history', () => {
    const game = createSimulationBenchmarkFixture(500).engine;
    const broad = vi.spyOn(game, 'getState');
    const roster = vi.spyOn(game.social, 'getBuddies');
    const socialState = vi.spyOn(game.social, 'getState');
    const individual = vi.spyOn(game.social, 'getBuddy');
    const stages = vi.spyOn(game.social, 'getRelationshipStage');
    const authors = game.social.getNightBoardAuthorsRead(999999);
    expect(authors).toHaveLength(500);
    expect(game.social.getNightBoardAuthorsRead(-10)).toEqual([]);
    expect(game.social.getNightBoardAuthorsRead(3.9)).toHaveLength(3);
    expect(JSON.parse(JSON.stringify(authors))).toEqual(authors);
    for (const author of authors) {
      expect(Object.keys(author).sort()).toEqual([
        'archetype', 'displayName', 'handle', 'id', 'roles', 'stage', 'status',
      ]);
    }
    const before = game.getNightBoardRead();
    expect(before.threads.length).toBeGreaterThan(0);
    expect(before.threads.length).toBeLessThanOrEqual(8);
    expect(JSON.parse(JSON.stringify(before))).toEqual(before);
    expect(stages.mock.calls.length).toBeLessThanOrEqual(1003);
    expect(roster).not.toHaveBeenCalled();
    expect(individual).not.toHaveBeenCalled();
    expect(socialState).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
    // The renderer never receives private dialogue/memory/canonical actor state.
    const rendered = JSON.stringify(before);
    expect(rendered).not.toContain('initialRelationships');
    expect(rendered).not.toContain('backstory');
    expect(rendered).not.toContain('schedule');
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
