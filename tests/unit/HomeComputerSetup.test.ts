import { describe, expect, it } from 'vitest';
import { InventoryEngine } from '../../src/engine/InventoryEngine';
import type { PlayerInventoryState } from '../../src/engine/types';

function makeInventory(): PlayerInventoryState {
  return {
    items: [
      {
        instanceId: 'purchase:starter:1:cpu_celeron_366:1',
        catalogItemId: 'cpu_celeron_366',
        kind: 'hardware',
        location: 'room_package',
      },
      {
        instanceId: 'purchase:starter:1:mon_beige_curved_14:1',
        catalogItemId: 'mon_beige_curved_14',
        kind: 'display',
        location: 'room_package',
      },
      {
        instanceId: 'purchase:starter:1:media_orion_48_setup:1',
        catalogItemId: 'media_orion_48_setup',
        kind: 'media',
        location: 'room_package',
      },
    ],
    purchaseCounts: { starter: 1 },
  };
}

describe('Issue #8 owned-item installation transaction', () => {
  it('prepares without mutation, then installs exactly the selected owned instances', () => {
    const inventory = new InventoryEngine(makeInventory());
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
      commitInstallOwnedItems?: (prepared: unknown) => void;
    };

    expect(typeof api.prepareInstallOwnedItems).toBe('function');
    expect(typeof api.commitInstallOwnedItems).toBe('function');

    const cpuId = 'purchase:starter:1:cpu_celeron_366:1';
    const monitorId = 'purchase:starter:1:mon_beige_curved_14:1';
    const mediaId = 'purchase:starter:1:media_orion_48_setup:1';
    const prepared = api.prepareInstallOwnedItems!([cpuId, monitorId]);

    expect(inventory.getState().items.map((item) => item.location)).toEqual([
      'room_package',
      'room_package',
      'room_package',
    ]);

    api.commitInstallOwnedItems!(prepared);
    const byId = new Map(inventory.getState().items.map((item) => [item.instanceId, item]));
    expect(byId.get(cpuId)?.location).toBe('installed');
    expect(byId.get(monitorId)?.location).toBe('installed');
    expect(byId.get(mediaId)?.location).toBe('room_package');
  });

  it('rejects missing, duplicate, and non-room-package instances without mutation', () => {
    const state = makeInventory();
    state.items[0] = { ...state.items[0]!, location: 'installed' };
    const inventory = new InventoryEngine(state);
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
    };
    expect(typeof api.prepareInstallOwnedItems).toBe('function');

    const before = inventory.getState();
    expect(() => api.prepareInstallOwnedItems!(['missing'])).toThrow(/owned item|missing|not found/i);
    expect(() =>
      api.prepareInstallOwnedItems!([
        'purchase:starter:1:mon_beige_curved_14:1',
        'purchase:starter:1:mon_beige_curved_14:1',
      ]),
    ).toThrow(/duplicate/i);
    expect(() =>
      api.prepareInstallOwnedItems!(['purchase:starter:1:cpu_celeron_366:1']),
    ).toThrow(/room_package|room package|location/i);
    expect(inventory.getState()).toEqual(before);
  });

  it('rejects a stale prepared install after the same instances were already committed', () => {
    const inventory = new InventoryEngine(makeInventory());
    const api = inventory as InventoryEngine & {
      prepareInstallOwnedItems?: (ids: readonly string[]) => unknown;
      commitInstallOwnedItems?: (prepared: unknown) => void;
    };
    expect(typeof api.prepareInstallOwnedItems).toBe('function');
    expect(typeof api.commitInstallOwnedItems).toBe('function');

    const id = 'purchase:starter:1:cpu_celeron_366:1';
    const first = api.prepareInstallOwnedItems!([id]);
    const stale = api.prepareInstallOwnedItems!([id]);
    api.commitInstallOwnedItems!(first);

    const afterFirstCommit = inventory.getState();
    expect(() => api.commitInstallOwnedItems!(stale)).toThrow(/stale|room_package|room package|location/i);
    expect(inventory.getState()).toEqual(afterFirstCommit);
  });
});
