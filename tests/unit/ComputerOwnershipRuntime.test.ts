import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import {
  ComputerOwnershipRuntime,
  resolvePcBootState,
} from '../../src/engine/kernel/ComputerOwnershipRuntime';
import { resolvePcBootState as legacyPublicBootRead } from '../../src/engine/SimulationEngine';

function runtime(engine: SimulationEngine): ComputerOwnershipRuntime {
  // Transitional #171 branch-only inspection: the public inventory facade
  // must forward to this very same instance. No duplicated inventory store.
  return (engine as unknown as { npc: { computerOwnership: ComputerOwnershipRuntime } }).npc.computerOwnership;
}

describe('ComputerOwnershipRuntime — one inventory and hardware transaction authority', () => {
  it('forwards public inventory to exactly one composed domain owner', () => {
    const engine = new SimulationEngine();
    const owner = runtime(engine);
    expect(owner).toBeInstanceOf(ComputerOwnershipRuntime);
    expect(owner.inventory).toBeInstanceOf(InventoryEngine);
    expect(owner.inventory).toBe(engine.inventory);
    expect(owner.inventory.getState()).toEqual(engine.exportSnapshot().inventory);
    expect(owner.getPcBootState()).toBe(engine.getPcBootState());
    expect(resolvePcBootState(engine.getState()))
      .toBe(legacyPublicBootRead(engine.getState()));
  });

  it('round-trips current-format owned inventory via the same canonical owner', () => {
    const engine = new SimulationEngine();
    const saved = engine.exportSnapshot();
    const restored = new SimulationEngine(saved);
    expect(runtime(restored).inventory).toBe(restored.inventory);
    expect(restored.exportSnapshot().inventory).toEqual(saved.inventory);

    restored.loadSnapshot(saved);
    expect(restored.inventory).toBe(runtime(restored).inventory);
    expect(restored.exportSnapshot().inventory).toEqual(saved.inventory);
  });

  it('does not spend cash or change inventory on invalid purchases or missing installer media', () => {
    const engine = new SimulationEngine();
    const owner = runtime(engine);
    const before = engine.exportSnapshot();

    expect(owner.purchaseStoreItem('silicon_spares', 'not_an_owned_sku').success).toBe(false);
    expect(owner.prepareOsInstallFromInsertedMedia().success).toBe(false);
    expect(owner.ejectOwnedMediaAtHome().success).toBe(false);

    const after = engine.exportSnapshot();
    expect(after.inventory).toEqual(before.inventory);
    expect(after.player.cash).toBe(before.player.cash);
    expect(after.computer).toEqual(before.computer);
    expect(after.os).toEqual(before.os);
  });
});
