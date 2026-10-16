import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function capture(game: SimulationEngine) {
  const changes: Array<{ revision: number; changedDomains: readonly string[] }> = [];
  const stop = game.subscribeChanges(change => changes.push(change));
  changes.length = 0;
  return { changes, stop };
}

describe('#172 bounded computer owner commands and atomic publication', () => {
  it('reads PC boot and rejected install preflight without assembling a complete world', () => {
    const game = new SimulationEngine();
    const full = vi.spyOn(game, 'getState');
    expect(game.getPcBootState()).toBe('no_computer');
    expect(game.prepareOsInstallFromInsertedMedia().success).toBe(false);
    expect(game.insertOwnedMediaAtHome('missing-media').success).toBe(false);
    expect(game.ejectOwnedMediaAtHome().success).toBe(false);
    expect(game.installOwnedHardwareAtHome('missing-ram', 'ram:0').success).toBe(false);
    expect(full).not.toHaveBeenCalled();
  });

  it('attributes successful inventory purchases even when no cash is charged', () => {
    const game = new SimulationEngine();
    const seen = capture(game);
    const full = vi.spyOn(game, 'getState');
    const purchased = game.purchaseStoreItem('silicon_spares', 'bundle_scrapyard');
    expect(purchased.success).toBe(true);
    expect(game.inventory.getState().items.length).toBeGreaterThan(0);
    expect(seen.changes).toHaveLength(1);
    expect(seen.changes[0]!.changedDomains).toEqual(expect.arrayContaining(['inventory', 'unknown']));
    expect(JSON.parse(JSON.stringify(seen.changes[0]))).toEqual(seen.changes[0]);
    expect(full).not.toHaveBeenCalled();
    const revision = game.getRevision();
    expect(game.purchaseStoreItem('silicon_spares', 'missing').success).toBe(false);
    expect(game.getRevision()).toBe(revision);
    seen.stop();
  });

  it('publishes owned PC setup as one boundary, then power changes and no-op power stay consistent', () => {
    const game = new SimulationEngine();
    expect(game.dispatchAction({ type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard' }).success).toBe(true);
    const seen = capture(game);
    const full = vi.spyOn(game, 'getState');
    expect(game.getPcBootState()).toBe('awaiting_setup');
    const setup = game.setupComputerAtHome();
    expect(setup.success).toBe(true);
    expect(seen.changes).toHaveLength(1);
    expect(seen.changes[0]!.changedDomains).toEqual(expect.arrayContaining(['inventory', 'hardware', 'clock', 'unknown']));
    expect(game.getPcBootState()).toBe('powered_off');
    expect(full).not.toHaveBeenCalled();
    expect(game.setComputerPower(true).success).toBe(true);
    expect(seen.changes).toHaveLength(2);
    expect(seen.changes[1]!.changedDomains).toEqual(expect.arrayContaining(['hardware', 'unknown']));
    expect(game.getPcBootState()).toBe('no_boot_device');
    expect(game.setComputerPower(true).success).toBe(true);
    expect(seen.changes).toHaveLength(2);
    expect(full).not.toHaveBeenCalled();
    seen.stop();
  });
});
