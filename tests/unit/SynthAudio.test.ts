import { describe, it, expect, beforeEach } from 'vitest';
import { SynthAudio } from '../../src/audio/SynthAudio';
import { SoundManager } from '../../src/audio/SoundManager';

// Mock Web Audio API for headless Node test environment
class MockAudioNode {
  connect() {}
  disconnect() {}
}

class MockAudioParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  frequency = new MockAudioParam();
  type = 'sine';
  start() {}
  stop() {}
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  type = 'lowpass';
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  start() {}
  stop() {}
}

class MockAudioBuffer {
  getChannelData() {
    return new Float32Array(100);
  }
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = new MockAudioNode();

  createGain() {
    return new MockGainNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  createBuffer() {
    return new MockAudioBuffer();
  }
  async resume() {
    this.state = 'running';
  }
}

describe('SynthAudio & SoundManager (Procedural Audio Synthesis)', () => {
  let synth: SynthAudio;
  let soundManager: SoundManager;

  beforeEach(() => {
    synth = new SynthAudio();
    synth.init(new MockAudioContext() as unknown as AudioContext);
    soundManager = new SoundManager(synth);
  });

  it('initializes without errors in headless mode', () => {
    expect(synth.getContext()).toBeDefined();
  });

  it('triggers UI sound effects without throwing exceptions', () => {
    expect(() => soundManager.play('click')).not.toThrow();
    expect(() => soundManager.play('window_open')).not.toThrow();
    expect(() => soundManager.play('window_minimize')).not.toThrow();
    expect(() => soundManager.play('error')).not.toThrow();
    expect(() => soundManager.play('im_recv')).not.toThrow();
    expect(() => soundManager.play('im_send')).not.toThrow();
    expect(() => soundManager.play('door_open')).not.toThrow();
    expect(() => soundManager.play('door_slam')).not.toThrow();
    expect(() => soundManager.play('hdd_chirp')).not.toThrow();
  });

  it('plays procedural 10-stage dialup handshake and provides cancel handler', () => {
    let completed = false;
    const { cancel } = soundManager.playDialup(() => {
      completed = true;
    });

    expect(typeof cancel).toBe('function');
    expect(completed).toBe(false);
    cancel();
  });

  it('manages volume settings and mute state correctly', () => {
    soundManager.setMasterVolume(0.5);
    expect(soundManager.getSettings().masterVolume).toBe(0.5);

    soundManager.setMute(true);
    expect(soundManager.getSettings().isMuted).toBe(true);

    soundManager.setMute(false);
    expect(soundManager.getSettings().isMuted).toBe(false);
  });
});
