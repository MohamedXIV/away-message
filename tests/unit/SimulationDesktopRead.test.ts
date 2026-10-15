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
});
