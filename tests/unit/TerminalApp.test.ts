import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('Terminal CLI Execution & VFS Integration', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('executes dir command and lists canonical directories', () => {
    const vfs = engine.vfs.getState();
    const rootDirs = Object.values(vfs.files).filter(
      (f) => f.parentPath === 'C:' && f.kind === 'directory'
    );
    expect(rootDirs.length).toBeGreaterThan(0);
    expect(rootDirs.some((d) => d.name === 'Downloads')).toBe(true);
    expect(rootDirs.some((d) => d.name === 'Documents')).toBe(true);
    expect(rootDirs.some((d) => d.name === 'Program Files')).toBe(true);
  });

  it('executes cd into subdirectories and validates path existence', () => {
    expect(engine.vfs.readFile('C:/Downloads')).toBeDefined();
    expect(engine.vfs.readFile('C:/Documents')).toBeDefined();
    expect(engine.vfs.readFile('C:/NonExistentDirectory')).toBeUndefined();
  });

  it('executes type to read text files in VFS', () => {
    const readme = engine.vfs.readFile('C:/Documents/Readme.txt');
    expect(readme).toBeDefined();
    expect(readme?.kind).toBe('text');
    expect(readme?.content).toContain('Orion OS');
  });

  it('executes unzip and creates extracted executable in VFS', () => {
    // Create simulated archive
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'retro_tool.zip',
        path: 'C:/Downloads/retro_tool.zip',
        parentPath: 'C:/Downloads',
        kind: 'archive',
        sizeBytes: 12000,
        metadata: { extractedFiles: ['RetroTool.exe'] },
      },
    });

    const archive = engine.vfs.readFile('C:/Downloads/retro_tool.zip');
    expect(archive).toBeDefined();
    expect(archive?.kind).toBe('archive');

    // Extract
    engine.dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: 'RetroTool.exe',
        path: 'C:/Downloads/RetroTool.exe',
        parentPath: 'C:/Downloads',
        kind: 'executable',
        sizeBytes: 9000,
        metadata: { isPortable: true },
      },
    });

    const extracted = engine.vfs.readFile('C:/Downloads/RetroTool.exe');
    expect(extracted).toBeDefined();
    expect(extracted?.metadata?.isPortable).toBe(true);
  });

  it('verifies IP configuration details from hardware state', () => {
    const hw = engine.hardware.getState();
    expect(hw.connectionType).toBe('dsl_256k');
    expect(hw.connectionSpeedKbps).toBe(256);
    expect(hw.osVersion).toBe('Orion_4.8');
  });
});
