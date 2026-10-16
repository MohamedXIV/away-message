import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 physical-place player status read', () => {
  it('reads exact canonical Needs and rent without assembling legacy player/world snapshots', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const compatibility = vi.spyOn(game.economy, 'getState');
    const social = vi.spyOn(game.social, 'getState');
    const read = game.getPlayerStatusRead();
    const hud = game.getHudProjection();
    expect(read.revision).toBe(game.getRevision());
    expect(read.needs).toEqual(game.gameContext.player.needs());
    expect(read.rent).toEqual(game.economy.getRentStatus());
    expect(hud.cash).toBe(game.economy.getCash());
    expect(hud.socialBattery).toBe(game.needs.getSocialBattery());
    expect(JSON.parse(JSON.stringify(read))).toEqual(read);
    expect(full).not.toHaveBeenCalled();
    expect(compatibility).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    read.needs.energy = -1;
    read.rent.rentPaid = true;
    expect(game.getPlayerStatusRead().needs.energy).toBeGreaterThanOrEqual(0);
    expect(game.getPlayerStatusRead().rent.rentPaid).toBe(false);
  });

  it('refreshes on world time revisions without read-time mutation', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    const visited: Array<{ revision: number; energy: number; cash: number }> = [];
    const unsub = game.subscribeChanges(change => {
      const read = game.getPlayerStatusRead();
      const hud = game.getHudProjection();
      expect(read.revision).toBe(change.revision);
      visited.push({ revision: read.revision, energy: read.needs.energy, cash: hud.cash });
    });
    const before = game.getPlayerStatusRead();
    game.advanceGameMinutes(60, 'status read refresh');
    full.mockClear(); // progression may need owner-internal legacy reads; hot reads must not
    const after = game.getPlayerStatusRead();
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(visited.length).toBeGreaterThan(1);
    expect(visited.at(-1)?.revision).toBe(game.getRevision());
    expect(after.needs).toEqual(game.gameContext.player.needs());
    expect(after.rent).toEqual(game.economy.getRentStatus());
    expect(full).not.toHaveBeenCalled();
    unsub();
  });
});
