import { beforeEach, describe, expect, it, vi } from 'vitest';

const audioMocks = vi.hoisted(() => ({
  unlock: vi.fn(),
}));

vi.mock('../../src/audio/AudioService', () => ({
  audioService: {
    unlock: audioMocks.unlock,
  },
}));

import { useAudioStore } from '../../src/store/useAudioStore';

describe('Audio bootstrap', () => {
  beforeEach(() => {
    audioMocks.unlock.mockClear();
    useAudioStore.setState({ isAudioUnlocked: false });
  });

  it('unlocks the renderer-neutral AudioService with the first audio gesture', () => {
    useAudioStore.getState().unlockAudio();

    expect(audioMocks.unlock).toHaveBeenCalledTimes(1);
    expect(useAudioStore.getState().isAudioUnlocked).toBe(true);
  });
});
