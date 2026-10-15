import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { DesktopStorageCommands } from '../../src/engine/kernel/DesktopStorageCommands';

function desktop(engine: SimulationEngine): DesktopStorageCommands {
  return (engine as unknown as { core: { desktopCommands: DesktopStorageCommands } }).core.desktopCommands;
}

describe('DesktopStorageCommands — canonical VFS, downloads and software authorities', () => {
  it('passes unrelated actions to the one outer dispatcher without side effects', () => {
    const engine = new SimulationEngine();
    const handler = desktop(engine);
    expect(handler).toBeInstanceOf(DesktopStorageCommands);
    const before = engine.exportSnapshot();
    expect(handler.dispatch({
      type: 'WORLD_SET_FLAG', key: 'desktop_boundary_probe', value: true,
    }, engine.clock.getTotalMinutes())).toBeNull();
    expect(engine.world.getFlag('desktop_boundary_probe')).toBeUndefined();
    expect(engine.exportSnapshot().vfs).toEqual(before.vfs);
  });

  it('enforces existing overdue rent download policy before touching DownloadManager', () => {
    const engine = new SimulationEngine();
    engine.world.setFlag('rent_overdue', true);
    const before = engine.getState().downloads.length;

    const result = engine.dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: 'test-network',
      url: 'https://offline.example/demo.zip',
      fileName: 'demo.zip',
      totalBytes: 1000,
      sourceMaxKbps: 80,
      fileKind: 'archive',
      manager: 'browser',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('rent');
    expect(engine.getState().downloads).toHaveLength(before);
  });

  it('shares the one canonical trash and download command response path', () => {
    const engine = new SimulationEngine();
    const handler = desktop(engine);
    const atMinute = engine.clock.getTotalMinutes();

    expect(handler.dispatch({ type: 'VFS_EMPTY_TRASH' }, atMinute))
      .toEqual(engine.dispatchAction({ type: 'VFS_EMPTY_TRASH' }));
    expect(handler.dispatch({ type: 'DOWNLOAD_CANCEL', taskId: 'missing' }, atMinute))
      .toEqual(engine.dispatchAction({ type: 'DOWNLOAD_CANCEL', taskId: 'missing' }));
  });
});
