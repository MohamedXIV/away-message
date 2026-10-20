import { describe, expect, it } from 'vitest';
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
});
