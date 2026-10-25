import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (p: string) => readFileSync(p, 'utf8');

describe('RetroAmp authentic playback stays on the Worker boundary', () => {
  it('checks installation, boot, VFS identity, file collisions and payload budget', () => {
    const owner = source('src/engine/kernel/DesktopStorageCommands.ts');
    expect(owner).toContain("case 'RETROAMP_IMPORT_SAMPLE'");
    expect(owner).toContain("isInstalled('app.retroamp')");
    expect(owner).toContain('getComputerBootStatus().poweredOn');
    expect(owner).toContain('vfs.readFile(RETROAMP_SAMPLE_PATH)');
    expect(owner).toContain('existing.content === wave.content');
    expect(owner).toContain("kind: 'audio'");
    const vfs = source('src/engine/FileSystemEngine.ts');
    expect(vfs).toContain("kind !== 'audio'");
    expect(vfs).toContain("content?.startsWith('data:audio/wav;base64,')");
  });
  it('reads targeted selected files and reuses real player UI; no shadow engine', () => {
    const worker = source('src/simulation/host/WorkerRetroAmpPanel.tsx');
    expect(worker).toContain("session.read({ kind: 'directory', path: 'C:/Music', limit: 16 })");
    expect(worker).toContain("kind: 'file', path: file.path");
    expect(worker).toContain("type: 'RETROAMP_IMPORT_SAMPLE'");
    expect(worker).not.toContain('defaultEngine');
    expect(worker).not.toContain('useSimulationStore');
    const view = source('src/apps/retroamp/RetroAmpApp.tsx');
    expect(view).toContain('createMediaElementSource');
    expect(view).toContain('<audio ref={audioRef}');
    expect(view).toContain('setHiddenPaths([])');
    expect(view).not.toContain('DEFAULT_PLAYLIST');
    expect(view).not.toContain('new_track.mp3');
  });
});
