import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 hot player finance reads are canonical and avoid Economy compatibility state', () => {
  it('renders world, shop and public website from narrow location/cash owner getters', () => {
    const game = new SimulationEngine();
    const legacy = vi.spyOn(game.economy, 'getState');
    const broad = vi.spyOn(game, 'getState');
    const social = vi.spyOn(game.social, 'getState');

    const world = game.getWorldRead();
    const shop = game.getShopRead();
    const website = game.getWebsiteRead();
    const hud = game.getHudProjection();

    expect(world.playerLocation).toBe(game.economy.getLocation());
    expect(shop.cash).toBe(game.economy.getCash());
    expect(website.cash).toBe(game.economy.getCash());
    expect(hud.cash).toBe(game.economy.getCash());
    expect(world.revision).toBe(game.getRevision());
    expect(shop.revision).toBe(game.getRevision());
    expect(website.revision).toBe(game.getRevision());
    expect(JSON.parse(JSON.stringify({ world, shop, website }))).toEqual({ world, shop, website });
    expect(legacy).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
  });

  it('derives current Mood finance from owner terms without merging Needs through Economy', () => {
    const game = new SimulationEngine({ player: { cash: 500 } } as never);
    const legacy = vi.spyOn(game.economy, 'getState');
    const broad = vi.spyOn(game, 'getState');
    const initial = game.gameContext.player.mood();
    const terms = game.economy.getRentStatus();
    expect(game.getPlayerStatusRead().rent).toEqual(terms);
    expect(initial).toEqual(game.mood.getCurrentSnapshot());
    expect(game.getPlayerStatusRead().needs).toEqual(game.needs.getSnapshot());
    expect(legacy).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();

    // These are actual Economy-owned cash changes; Mood must still read
    // their up-to-date financial context on the next semantic evaluation.
    game.economy.spendCash(450, 'finance ownership probe');
    const lowerCash = game.gameContext.player.mood();
    expect(lowerCash.atMinute).toBe(initial.atMinute);
    expect(game.getShopRead().cash).toBe(50);
    expect(game.getWebsiteRead().cash).toBe(50);
    expect(legacy).not.toHaveBeenCalled();
    expect(broad).not.toHaveBeenCalled();
  });
});
