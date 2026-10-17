import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 DesktopShell metadata-only read', () => {
  it('projects only visible Desktop file identities, never VFS payloads or other folders', () => {
    const engine = new SimulationEngine();
    const secret = 'SECRET_PAYLOAD_NOT_FOR_DESKTOP_UI'.repeat(5000);
    for (const [name, parentPath] of [
      ['Icon.txt', 'C:/Desktop'],
      ['Private.txt', 'C:/Documents'],
    ] as const) {
      const result = engine.dispatchAction({
        type: 'VFS_CREATE_FILE',
        file: {
          name, path: `${parentPath}/${name}`, parentPath,
          kind: 'text', sizeBytes: secret.length, content: secret,
          metadata: { textContent: secret },
        },
      });
      expect(result.success).toBe(true);
    }

    const spy = vi.spyOn(engine, 'getState');
    const projection = engine.getDesktopRead();
    expect(projection.desktopFiles.some(f => f.name === 'Icon.txt')).toBe(true);
    expect(projection.desktopFiles.some(f => f.name === 'Private.txt')).toBe(false);
    expect(JSON.stringify(projection)).not.toContain('SECRET_PAYLOAD');
    expect(JSON.stringify(projection).length).toBeLessThan(5000);
    expect(projection.pcBootState).toBe('no_computer');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();

    // Explicit VFS owner read still provides the actual document body.
    expect(engine.vfs.readFile('C:/Desktop/Icon.txt')?.content).toBe(secret);
  });

  it('keeps PC setup, monitor and installer-media semantics without a world snapshot', () => {
    const engine = new SimulationEngine();
    expect(engine.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    const before = engine.getDesktopRead();
    expect(before.pcBootState).toBe('awaiting_setup');
    expect(before.bootMediaItems.some(item => item.catalogItemId === 'media_orion_48_setup')).toBe(true);
    expect(engine.setupComputerAtHome().success).toBe(true);
    const full = vi.spyOn(engine, 'getState');
    const ready = engine.getDesktopRead();
    expect(ready.pcBootState).toBe('powered_off');
    expect(ready.osVersion).toBeNull();
    expect(ready.monitor).toEqual(engine.hardware.getDisplayState().monitor);
    expect(full).not.toHaveBeenCalled();
    full.mockRestore();
  });
  it('reads boot status and desktop icons without cloning Inventory, Hardware or VFS bodies', () => {
    const game = new SimulationEngine();
    expect(game.purchaseStoreItem('silicon_spares', 'bundle_scrapyard').success).toBe(true);
    const baseline = game.getDesktopRead();
    expect(baseline.pcBootState).toBe('awaiting_setup');
    const broad = vi.spyOn(game, 'getState');
    const inventory = vi.spyOn(game.inventory, 'getState');
    const hardware = vi.spyOn(game.hardware, 'getComputerState');
    const os = vi.spyOn(game.os, 'getState');
    const wholeDirectory = vi.spyOn(game.vfs, 'listDirectory');
    const metadata = vi.spyOn(game.vfs, 'listDirectoryMetadata');

    const desktop = game.getDesktopRead();
    const world = game.getWorldRead();
    expect(desktop).toEqual(baseline);
    expect(world.pcBootState).toBe('awaiting_setup');
    expect(desktop.bootMediaItems.some(item => item.catalogItemId === 'media_orion_48_setup')).toBe(true);
    expect(desktop.desktopFiles.length).toBeLessThanOrEqual(256);
    expect(desktop.bootMediaItems.length).toBeLessThanOrEqual(256);
    expect(metadata).toHaveBeenCalledWith('C:/Desktop', 256);
    expect(JSON.parse(JSON.stringify(desktop))).toEqual(desktop);
    expect(broad).not.toHaveBeenCalled();
    expect(inventory).not.toHaveBeenCalled();
    expect(hardware).not.toHaveBeenCalled();
    expect(os).not.toHaveBeenCalled();
    expect(wholeDirectory).not.toHaveBeenCalled();
  });

  it('bounds installer media and never exposes canonical mutable inventory items', () => {
    const game = new SimulationEngine();
    game.inventory.loadState({
      purchaseCounts: {},
      items: Array.from({ length: 400 }, (_, i) => ({
        instanceId: `boot-media-${i}`,
        catalogItemId: 'media_orion_48_setup',
        kind: 'media' as const,
        location: 'inventory' as const,
      })),
    });
    const broad = vi.spyOn(game, 'getState');
    const inventory = vi.spyOn(game.inventory, 'getState');
    const desktop = game.getDesktopRead();
    expect(desktop.pcBootState).toBe('no_computer');
    expect(desktop.bootMediaItems).toHaveLength(256);
    expect(desktop.bootMediaItems[0]?.instanceId).toBe('boot-media-0');
    expect(desktop.bootMediaItems[255]?.instanceId).toBe('boot-media-255');
    desktop.bootMediaItems[0]!.catalogItemId = 'tampered';
    expect(game.getDesktopRead().bootMediaItems[0]?.catalogItemId).toBe('media_orion_48_setup');
    expect(game.inventory.getBootMediaItems(0)).toEqual([]);
    expect(broad).not.toHaveBeenCalled();
    expect(inventory).not.toHaveBeenCalled();
  });

});
