import { describe, expect, it, vi } from 'vitest';
import { DesktopStorageCommands } from '../../src/engine/kernel/DesktopStorageCommands';
import { FileSystemEngine } from '../../src/engine/FileSystemEngine';
import { EventBus } from '../../src/engine/EventBus';
import { createRetroAmpSample, RETROAMP_SAMPLE_PATH } from '../../src/engine/kernel/RetroAmpSample';

describe('RetroAmp owner-authored media', () => {
  it('produces reproducible real RIFF PCM, rather than an invented MP3', () => {
    const first = createRetroAmpSample();
    expect(RETROAMP_SAMPLE_PATH).toBe('C:/Music/Motel Night Loop.wav');
    expect(first).toEqual(createRetroAmpSample());
    const raw = atob(first.content.slice('data:audio/wav;base64,'.length));
    const bytes = Uint8Array.from(raw, character => character.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    expect(raw.slice(0, 4)).toBe('RIFF');
    expect(raw.slice(8, 12)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true)).toBe(64000);
    expect(view.getUint32(4, true)).toBe(first.sizeBytes - 8);
    expect(first.sizeBytes).toBe(64044);
    expect(new Set(bytes.slice(44)).size).toBeGreaterThan(16);
    expect(first.content.length).toBeLessThan(96000);
  });

  const makeOwner = (installed = true, poweredOn = true) => {
    const vfs = new FileSystemEngine(new EventBus());
    const publish = vi.fn();
    const owners = {
      vfs,
      software: { isInstalled: () => installed },
      os: { getCurrentOsId: () => 'Orion_4.8' },
      hardware: { getComputerBootStatus: () => ({ assembled: true, poweredOn }) },
    } as unknown as ConstructorParameters<typeof DesktopStorageCommands>[0];
    const commands = new DesktopStorageCommands(owners, publish);
    return { vfs, publish, commands };
  };

  it('refuses to create audio without installed RetroAmp or a powered-on OS', () => {
    for (const [installed, powered] of [[false, true], [true, false]]) {
      const owner = makeOwner(installed, powered);
      const answer = owner.commands.dispatch({ type: 'RETROAMP_IMPORT_SAMPLE' }, 300);
      expect(answer?.success).toBe(false);
      expect(owner.vfs.readFile(RETROAMP_SAMPLE_PATH)).toBeUndefined();
      expect(owner.publish).not.toHaveBeenCalled();
    }
  });

  it('creates real playable audio once and rejects a tampered same-name file', () => {
    const owner = makeOwner();
    expect(owner.commands.dispatch({ type: 'RETROAMP_IMPORT_SAMPLE' }, 300)?.success).toBe(true);
    const file = owner.vfs.readFile(RETROAMP_SAMPLE_PATH);
    expect(file?.kind).toBe('audio');
    expect(file?.sizeBytes).toBe(64044);
    expect(file?.content).toBe(createRetroAmpSample().content);
    expect(file?.appAssociation).toBe('app.retroamp');
    expect(owner.publish).toHaveBeenCalledTimes(1);
    const again = owner.commands.dispatch({ type: 'RETROAMP_IMPORT_SAMPLE' }, 301);
    expect(again?.success).toBe(true);
    expect(owner.publish).toHaveBeenCalledTimes(1);

    const tampered = makeOwner();
    tampered.vfs.createFile({
      name: 'Motel Night Loop.wav', path: RETROAMP_SAMPLE_PATH,
      parentPath: 'C:/Music', kind: 'audio', sizeBytes: 4,
      content: 'data:audio/wav;base64,ZmFrZQ==',
    }, 0);
    const refused = tampered.commands.dispatch({ type: 'RETROAMP_IMPORT_SAMPLE' }, 302);
    expect(refused?.success).toBe(false);
    expect(tampered.publish).not.toHaveBeenCalled();
    expect(tampered.vfs.readFile(RETROAMP_SAMPLE_PATH)?.content).toContain('ZmFrZQ==');
  });
});
