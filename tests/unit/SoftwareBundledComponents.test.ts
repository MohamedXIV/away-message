import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { SoftwareRegistry } from '../../src/engine/SoftwareRegistry';

describe('OS-bundled system components', () => {
  it('does not silently register Voyager as ordinary installed software when Orion is present', () => {
    const eventBus = new EventBus();
    const vfs = new FileSystemEngine(eventBus);
    const registry = new SoftwareRegistry(eventBus, vfs, {
      getOsVersion: () => 'Orion_4.8',
      getRamMb: () => 512,
      getCpuTier: () => 1,
    });

    expect(registry.isInstalled('app.browser')).toBe(false);
    expect(registry.getInstalledSoftware()).toEqual([]);
  });
});
