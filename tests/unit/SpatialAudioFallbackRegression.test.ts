// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from '../../src/audio/AudioService';
import { FmodBackend } from '../../src/audio/FmodBackend';
import type {
  AudioBackend,
  AudioBusCategory,
  AudioOrientation3D,
  AudioPlayOptions,
  AudioPosition3D,
} from '../../src/audio/types';

function createAvailableFallback(): AudioBackend & { play: ReturnType<typeof vi.fn> } {
  const play = vi.fn((eventId: string, _options?: AudioPlayOptions) => `fallback_${eventId}`);
  return {
    id: 'fallback_probe',
    init: vi.fn(),
    unlock: vi.fn(),
    play,
    stop: vi.fn(),
    stopAll: vi.fn(),
    setParameter: vi.fn(),
    setSourcePosition: vi.fn((_handle: string, _position: AudioPosition3D, _orientation?: AudioOrientation3D) => {}),
    setListenerPosition: vi.fn((_position: AudioPosition3D, _orientation?: AudioOrientation3D) => {}),
    setBusVolume: vi.fn((_bus: AudioBusCategory, _volume: number) => {}),
    pause: vi.fn(),
    resume: vi.fn(),
    suspend: vi.fn(),
    destroy: vi.fn(),
    isAvailable: vi.fn(() => true),
    getActiveInstanceCount: vi.fn(() => 0),
  };
}

function createResumeResettingBackend() {
  let masterVolume = 1;
  const setBusVolume = vi.fn((bus: AudioBusCategory, volume: number) => {
    if (bus === 'master') masterVolume = volume;
  });
  const backend: AudioBackend = {
    id: 'resume_reset_probe',
    init: vi.fn(),
    unlock: vi.fn(),
    play: vi.fn((eventId: string) => `probe_${eventId}`),
    stop: vi.fn(),
    stopAll: vi.fn(),
    setParameter: vi.fn(),
    setSourcePosition: vi.fn(),
    setListenerPosition: vi.fn(),
    setBusVolume,
    pause: vi.fn(() => { masterVolume = 0; }),
    resume: vi.fn(() => { masterVolume = 1; }),
    suspend: vi.fn(),
    destroy: vi.fn(),
    isAvailable: vi.fn(() => true),
    getActiveInstanceCount: vi.fn(() => 0),
  };
  return { backend, setBusVolume, getMasterVolume: () => masterVolume };
}

describe('spatial audio fallback regressions (#22)', () => {
  afterEach(() => {
    delete (window as unknown as { FMOD?: unknown }).FMOD;
  });

  it('activates fallback when the real FMOD adapter reports unavailable without throwing', async () => {
    delete (window as unknown as { FMOD?: unknown }).FMOD;
    const primary = new FmodBackend();
    const fallback = createAvailableFallback();
    const service = new AudioService({ primaryBackend: primary, fallbackBackend: fallback });

    await service.init();
    const handle = service.play('sfx.door_open');

    expect(primary.isAvailable()).toBe(false);
    expect(service.getActiveBackendId()).toBe('fallback_probe');
    expect(handle).toBe('fallback_sfx.door_open');
    expect(fallback.play).toHaveBeenCalledTimes(1);
  });

  it('restores service-owned master volume after pause and resume', () => {
    const probe = createResumeResettingBackend();
    const service = new AudioService({ primaryBackend: probe.backend });

    service.setBusVolume('master', 0.35);
    expect(probe.getMasterVolume()).toBe(0.35);

    service.pause();
    expect(probe.getMasterVolume()).toBe(0);

    service.resume();
    expect(probe.getMasterVolume()).toBe(0.35);
    expect(probe.setBusVolume).toHaveBeenLastCalledWith('master', 0.35);
  });
});
