import { describe, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('#172 directory-scoped UI and owner-backed app reads', () => {
  it('serializes directory metadata only, never large document bodies, while single-file read stays exact', () => {
    const engine = new SimulationEngine();
    const payload = 'PRIVATE_DOCUMENT_CONTENT'.repeat(10000);
    for (const [folder, name] of [
      ['C:/Desktop', 'Visible.txt'],
      ['C:/Documents', 'Other.txt'],
    ] as const) {
      const result = engine.dispatchAction({
        type: 'VFS_CREATE_FILE',
        file: {
          name,
          path: `${folder}/${name}`,
          parentPath: folder,
          kind: 'text',
          sizeBytes: payload.length,
          content: payload,
          metadata: { textContent: payload },
        },
      });
      expect(result.success).toBe(true);
    }
    const giant = vi.spyOn(engine, 'getState');
    const ownerSnapshot = vi.spyOn(engine.vfs, 'getState');
    const directory = engine.getDirectoryRead('C:/Desktop');
    expect(directory.files.some(f => f.name === 'Visible.txt')).toBe(true);
    expect(directory.files.some(f => f.name === 'Other.txt')).toBe(false);
    expect(JSON.stringify(directory)).not.toContain('PRIVATE_DOCUMENT_CONTENT');
    expect(JSON.stringify(directory).length).toBeLessThan(12000);
    expect(directory.freeDiskBytes).toBe(engine.vfs.getFreeDiskBytes());
    expect(JSON.parse(JSON.stringify(directory))).toEqual(directory);
    expect(engine.getDirectoryRead('C:/Documents').files.some(f => f.name === 'Other.txt')).toBe(true);

    const content = engine.getFileRead('C:/Desktop/Visible.txt');
    expect(content.file?.content).toBe(payload);
    expect(engine.getFileRead('C:/Documents/missing.txt').file).toBeNull();
    expect(engine.getFileRead('').file).toBeNull();
    expect(giant).not.toHaveBeenCalled();
    expect(ownerSnapshot).not.toHaveBeenCalled();
    giant.mockRestore();
    ownerSnapshot.mockRestore();
  });

  it('keeps app OS/hardware/software contracts serializable without whole-world assembly', () => {
    const engine = new SimulationEngine();
    const giant = vi.spyOn(engine, 'getState');
    const social = vi.spyOn(engine.social, 'getState');
    const app = engine.getAppRead();
    expect(app.revision).toBe(engine.getRevision());
    expect(app.os.currentOsId).toBe(engine.os.getCurrentOsId());
    expect(app.hardware.ramMB).toBe(engine.hardware.getState().ramMB);
    expect(app.installedSoftware).toEqual(engine.software.getInstalledSoftware());
    expect(JSON.parse(JSON.stringify(app))).toEqual(app);
    expect(giant).not.toHaveBeenCalled();
    expect(social).not.toHaveBeenCalled();
    giant.mockRestore();
    social.mockRestore();
  });
});
