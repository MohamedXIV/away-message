// @vitest-environment jsdom
// tests/unit/SpatialAudio.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioService } from '../../src/audio/AudioService';
import { WebAudioBackend } from '../../src/audio/WebAudioBackend';
import { FmodBackend } from '../../src/audio/FmodBackend';
import {
  mapViewCoordinatesToAudioPosition,
  mapOrientationNameToVector,
} from '../../src/audio/spatialMapping';
import { createTechnicalFixtureProjection } from '../../src/world/phaser/technicalFixture';
import type { AudioBackend } from '../../src/audio/types';

// ============================================================================
// Mock Web Audio Implementation for Node / Headless Test Environment
// ============================================================================

class MockAudioParam {
  public value = 0;
  public setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  public exponentialRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
}

class MockAudioNode {
  public connectedTo: MockAudioNode[] = [];
  public isDisconnected = false;

  public connect(dest: MockAudioNode): void {
    this.connectedTo.push(dest);
    this.isDisconnected = false;
  }

  public disconnect(): void {
    this.connectedTo = [];
    this.isDisconnected = true;
  }
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

class MockPannerNode extends MockAudioNode {
  public panningModel = 'HRTF';
  public distanceModel = 'inverse';
  public refDistance = 1;
  public maxDistance = 100;
  public rolloffFactor = 1;

  public positionX = new MockAudioParam();
  public positionY = new MockAudioParam();
  public positionZ = new MockAudioParam();

  public orientationX = new MockAudioParam();
  public orientationY = new MockAudioParam();
  public orientationZ = new MockAudioParam();

  public setPosition(x: number, y: number, z: number): void {
    this.positionX.setValueAtTime(x);
    this.positionY.setValueAtTime(y);
    this.positionZ.setValueAtTime(z);
  }

  public setOrientation(x: number, y: number, z: number): void {
    this.orientationX.setValueAtTime(x);
    this.orientationY.setValueAtTime(y);
    this.orientationZ.setValueAtTime(z);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  public frequency = new MockAudioParam();
  public Q = new MockAudioParam();
  public type = 'lowpass';
}

class MockOscillatorNode extends MockAudioNode {
  public frequency = new MockAudioParam();
  public type = 'sine';
  public isStarted = false;
  public isStopped = false;

  public start(): void {
    this.isStarted = true;
  }

  public stop(): void {
    this.isStopped = true;
  }
}

class MockAudioListener {
  public positionX = new MockAudioParam();
  public positionY = new MockAudioParam();
  public positionZ = new MockAudioParam();

  public forwardX = new MockAudioParam();
  public forwardY = new MockAudioParam();
  public forwardZ = new MockAudioParam();

  public upX = new MockAudioParam();
  public upY = new MockAudioParam();
  public upZ = new MockAudioParam();

  public setPosition(x: number, y: number, z: number): void {
    this.positionX.setValueAtTime(x);
    this.positionY.setValueAtTime(y);
    this.positionZ.setValueAtTime(z);
  }

  public setOrientation(
    x: number,
    y: number,
    z: number,
    xUp: number,
    yUp: number,
    zUp: number,
  ): void {
    this.forwardX.setValueAtTime(x);
    this.forwardY.setValueAtTime(y);
    this.forwardZ.setValueAtTime(z);
    this.upX.setValueAtTime(xUp);
    this.upY.setValueAtTime(yUp);
    this.upZ.setValueAtTime(zUp);
  }
}

class MockAudioContext {
  public state: 'running' | 'suspended' | 'closed' = 'running';
  public currentTime = 10;
  public destination = new MockAudioNode();
  public listener = new MockAudioListener();

  public createGain(): MockGainNode {
    return new MockGainNode();
  }

  public createPanner(): MockPannerNode {
    return new MockPannerNode();
  }

  public createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode();
  }

  public createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }

  public createBufferSource(): MockAudioNode {
    return new MockAudioNode();
  }

  public async resume(): Promise<void> {
    this.state = 'running';
  }

  public async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  public async close(): Promise<void> {
    this.state = 'closed';
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Data-Driven Spatial Audio API & Architecture (#22)', () => {
  let mockContext: MockAudioContext;
  let webAudioBackend: WebAudioBackend;
  let audioService: AudioService;

  beforeEach(() => {
    mockContext = new MockAudioContext();
    webAudioBackend = new WebAudioBackend(mockContext as unknown as AudioContext);
    audioService = new AudioService({
      primaryBackend: webAudioBackend,
    });
  });

  // --------------------------------------------------------------------------
  // 1. Semantic Decoupling (Game code does not know backend types)
  // --------------------------------------------------------------------------
  it('1. allows game-facing code to play and stop audio without referencing backend types', () => {
    // Play semantic one-shot
    const handle = audioService.play('sfx.door_open', {
      volume: 0.8,
      bus: 'sfx',
    });

    expect(typeof handle).toBe('string');
    expect(handle).toBeTruthy();
    expect(audioService.isInstanceActive(handle)).toBe(true);

    // Stop via semantic handle
    audioService.stop(handle);
    expect(audioService.isInstanceActive(handle)).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 2. Semantic Event Resolution Through Backend
  // --------------------------------------------------------------------------
  it('2. resolves semantic event IDs into sound instances via the active backend', () => {
    const handleSfx = audioService.play('sfx.window_open');
    const handleAmbience = audioService.play('ambience.weather.rain', {
      loop: true,
      bus: 'ambience',
      parameters: { rainIntensity: 0.8 },
    });

    expect(audioService.isInstanceActive(handleSfx)).toBe(true);
    expect(audioService.isInstanceActive(handleAmbience)).toBe(true);
    expect(webAudioBackend.getActiveInstanceCount()).toBe(2);

    audioService.stopAll();
    expect(webAudioBackend.getActiveInstanceCount()).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 3. Deterministic Source / Listener Orientation Mapping
  // --------------------------------------------------------------------------
  describe('3. Deterministic Source & Listener Orientation Mapping', () => {
    it('maps normalized 2D viewport coordinates to pseudo-3D audio coordinates', () => {
      // Screen center (0.5, 0.5) -> Audio center (0, 0, 0)
      const center = mapViewCoordinatesToAudioPosition(0.5, 0.5, 0);
      expect(center.x).toBeCloseTo(0, 4);
      expect(center.y).toBeCloseTo(0, 4);
      expect(center.z).toBeCloseTo(0, 4);

      // Top-left window (0.1, 0.2, 0.5) -> Audio (-0.8, 0.6, 0.5)
      const windowPos = mapViewCoordinatesToAudioPosition(0.1, 0.2, 0.5);
      expect(windowPos.x).toBeCloseTo(-0.8, 4);
      expect(windowPos.y).toBeCloseTo(0.6, 4);
      expect(windowPos.z).toBeCloseTo(0.5, 4);

      // Bottom-right fridge (0.9, 0.85, -0.4) -> Audio (0.8, -0.7, -0.4)
      const fridgePos = mapViewCoordinatesToAudioPosition(0.9, 0.85, -0.4);
      expect(fridgePos.x).toBeCloseTo(0.8, 4);
      expect(fridgePos.y).toBeCloseTo(-0.7, 4);
      expect(fridgePos.z).toBeCloseTo(-0.4, 4);
    });

    it('maps named listener orientations to deterministic unit vectors', () => {
      const forward = mapOrientationNameToVector('forward');
      expect(forward.forward).toEqual({ x: 0, y: 0, z: 1 });
      expect(forward.up).toEqual({ x: 0, y: 1, z: 0 });

      const back = mapOrientationNameToVector('back');
      expect(back.forward).toEqual({ x: 0, y: 0, z: -1 });

      const left = mapOrientationNameToVector('left');
      expect(left.forward).toEqual({ x: -1, y: 0, z: 0 });

      const right = mapOrientationNameToVector('right');
      expect(right.forward).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('updates listener orientation deterministically on AudioService', () => {
      audioService.setListenerOrientation('left');
      expect(mockContext.listener.forwardX.value).toBe(-1);
      expect(mockContext.listener.forwardY.value).toBe(0);
      expect(mockContext.listener.forwardZ.value).toBe(0);

      audioService.setListenerOrientation('forward');
      expect(mockContext.listener.forwardX.value).toBe(0);
      expect(mockContext.listener.forwardZ.value).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Positional Updates Do Not Duplicate Instances
  // --------------------------------------------------------------------------
  it('4. updates existing positional source without creating duplicate instances', () => {
    const handle = audioService.play('device.fridge_hum', {
      loop: true,
      position: { x: 0.8, y: -0.5, z: 0.2 },
    });

    expect(webAudioBackend.getActiveInstanceCount()).toBe(1);

    // Update position multiple times (e.g. animated or moved source)
    audioService.setSourcePosition(handle, { x: 0.5, y: -0.5, z: 0.2 });
    audioService.setSourcePosition(handle, { x: 0.2, y: -0.5, z: 0.2 });
    audioService.setSourcePosition(handle, { x: 0.0, y: -0.5, z: 0.2 });

    // Instance count remains exactly 1
    expect(webAudioBackend.getActiveInstanceCount()).toBe(1);

    const instance = webAudioBackend.getInstance(handle);
    expect(instance).toBeDefined();
    expect(instance?.pannerNode?.positionX.value).toBeCloseTo(0.0, 4);

    audioService.stop(handle);
    expect(webAudioBackend.getActiveInstanceCount()).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 5. Parameter Updates Reach Active Semantic Events
  // --------------------------------------------------------------------------
  it('5. propagates parameter updates to active semantic events and global listeners', () => {
    const rainHandle = audioService.play('ambience.weather.rain', {
      loop: true,
      parameters: { rainIntensity: 0.2 },
    });

    // Update parameter per-instance
    audioService.setParameter('rainIntensity', 0.9, rainHandle);
    expect(audioService.getParameter('rainIntensity', rainHandle)).toBe(0.9);

    // Update parameter globally
    audioService.setGlobalParameter('windIntensity', 0.7);
    expect(audioService.getGlobalParameter('windIntensity')).toBe(0.7);

    // Environment batch update helper
    audioService.updateEnvironment({
      rainIntensity: 0.65,
      windIntensity: 0.45,
      isInterior: true,
    });

    expect(audioService.getGlobalParameter('rainIntensity')).toBe(0.65);
    expect(audioService.getGlobalParameter('windIntensity')).toBe(0.45);
    expect(audioService.getGlobalParameter('isInterior')).toBe(1);

    audioService.stop(rainHandle);
  });

  // --------------------------------------------------------------------------
  // 6. Pause / Resume / Suspend Lifecycle is Idempotent
  // --------------------------------------------------------------------------
  it('6. executes pause, resume, and suspend idempotently without state corruption', async () => {
    audioService.play('ambience.room_tone', { loop: true });

    expect(audioService.isPaused()).toBe(false);

    // Multiple pauses in a row
    audioService.pause();
    audioService.pause();
    expect(audioService.isPaused()).toBe(true);

    // Multiple resumes
    audioService.resume();
    audioService.resume();
    expect(audioService.isPaused()).toBe(false);

    // Multiple suspends
    audioService.suspend();
    audioService.suspend();
    expect(mockContext.state).toBe('suspended');

    // Unlock
    await audioService.unlock();
    expect(mockContext.state).toBe('running');

    audioService.stopAll();
  });

  // --------------------------------------------------------------------------
  // 7. Switching / Destroying Physical Views Does Not Leak Nodes
  // --------------------------------------------------------------------------
  it('7. clears and disconnects all audio nodes when switching or destroying views', () => {
    const handle1 = audioService.play('device.clock_tick', { loop: true, position: { x: -0.6, y: 0.5, z: 0 } });
    const handle2 = audioService.play('device.lamp_buzz', { loop: true, position: { x: 0.6, y: 0.2, z: 0 } });
    audioService.play('ambience.room_tone', { loop: true });

    expect(webAudioBackend.getActiveInstanceCount()).toBe(3);

    const inst1 = webAudioBackend.getInstance(handle1);
    const inst2 = webAudioBackend.getInstance(handle2);

    expect((inst1?.gainNode as unknown as MockGainNode).isDisconnected).toBe(false);
    expect((inst2?.gainNode as unknown as MockGainNode).isDisconnected).toBe(false);

    // Destroy audio session (e.g. leaving scene or navigating)
    audioService.destroy();

    expect(webAudioBackend.getActiveInstanceCount()).toBe(0);
    expect((inst1?.gainNode as unknown as MockGainNode).isDisconnected).toBe(true);
    expect((inst2?.gainNode as unknown as MockGainNode).isDisconnected).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Backend Failure Falls Back Safely
  // --------------------------------------------------------------------------
  it('8. falls back safely to secondary backend when primary backend fails', () => {
    const brokenBackend: AudioBackend = {
      id: 'failing_mock',
      init: vi.fn(),
      unlock: vi.fn(),
      play: vi.fn(() => {
        throw new Error('FMOD hardware allocation failed');
      }),
      stop: vi.fn(),
      stopAll: vi.fn(),
      setParameter: vi.fn(),
      setSourcePosition: vi.fn(),
      setListenerPosition: vi.fn(),
      setBusVolume: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      suspend: vi.fn(),
      destroy: vi.fn(),
      isAvailable: vi.fn(() => false),
      getActiveInstanceCount: vi.fn(() => 0),
    };

    const fallbackBackend = new WebAudioBackend(mockContext as unknown as AudioContext);
    const resilientService = new AudioService({
      primaryBackend: brokenBackend,
      fallbackBackend,
    });

    // Should not throw; should fall back to fallbackBackend
    expect(() => {
      const handle = resilientService.play('sfx.click');
      expect(typeof handle).toBe('string');
    }).not.toThrow();

    expect(fallbackBackend.getActiveInstanceCount()).toBe(1);
    resilientService.stopAll();
  });

  // --------------------------------------------------------------------------
  // 9. FMOD Feasibility & Diagnostics
  // --------------------------------------------------------------------------
  describe('9. FMOD HTML5 Feasibility & Diagnostics', () => {
    it('reports unavailability cleanly when FMOD runtime / banks are missing', async () => {
      const fmodBackend = new FmodBackend();
      expect(fmodBackend.isAvailable()).toBe(false);

      await fmodBackend.init();
      expect(fmodBackend.isAvailable()).toBe(false);

      const status = fmodBackend.getDiagnostics();
      expect(status.runtimeDetected).toBe(false);
      expect(status.banksLoaded).toBe(false);
      expect(status.blockerReason).toMatch(/FMOD Studio HTML5 runtime.*not found/i);
    });

    it('exposes identical AudioBackend interface structure', () => {
      const fmodBackend = new FmodBackend();
      expect(typeof fmodBackend.play).toBe('function');
      expect(typeof fmodBackend.stop).toBe('function');
      expect(typeof fmodBackend.setParameter).toBe('function');
      expect(typeof fmodBackend.setSourcePosition).toBe('function');
      expect(typeof fmodBackend.setListenerPosition).toBe('function');
      expect(typeof fmodBackend.pause).toBe('function');
      expect(typeof fmodBackend.resume).toBe('function');
      expect(typeof fmodBackend.destroy).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // 10. Technical Fixture & Physical Presentation Integration
  // --------------------------------------------------------------------------
  describe('10. Technical Fixture & Physical Presentation Integration', () => {
    it('authors spatial audio sources and forward orientation in technical fixture', () => {
      const projection = createTechnicalFixtureProjection();
      expect(projection.spatialAudioSources?.length).toBeGreaterThanOrEqual(2);
      expect(projection.listenerOrientation).toBe('forward');

      const clockSrc = projection.spatialAudioSources?.find((s) => s.id === 'fixture_clock_tick');
      expect(clockSrc).toBeDefined();
      expect(clockSrc?.eventId).toBe('device.clock_tick');
      expect(clockSrc?.loop).toBe(true);

      const lampSrc = projection.spatialAudioSources?.find((s) => s.id === 'fixture_lamp_buzz');
      expect(lampSrc).toBeDefined();
      expect(lampSrc?.eventId).toBe('device.lamp_buzz');

      const windowSrc = projection.spatialAudioSources?.find((s) => s.id === 'fixture_window_weather');
      expect(windowSrc).toBeDefined();
      expect(windowSrc?.eventId).toBe('ambience.weather.rain');
    });
  });

  // --------------------------------------------------------------------------
  // 11. Backend Ownership and Resilient Fallback Transition
  // --------------------------------------------------------------------------
  describe('11. Backend Ownership & Fallback Transition Integrity', () => {
    function createMockBackend(id: string) {
      let counter = 0;
      const mockPlay = vi.fn((eventId: string) => `${id}_handle_${++counter}_${eventId}`);
      const mockStop = vi.fn();
      const mockStopAll = vi.fn();
      const mockSetParameter = vi.fn();
      const mockSetSourcePosition = vi.fn();
      const mockSetListenerPosition = vi.fn();
      const mockSetBusVolume = vi.fn();
      const mockPause = vi.fn();
      const mockResume = vi.fn();
      const mockSuspend = vi.fn();
      const mockDestroy = vi.fn();
      const mockInit = vi.fn();
      const mockUnlock = vi.fn();

      const backend: AudioBackend = {
        id,
        init: mockInit,
        unlock: mockUnlock,
        play: mockPlay,
        stop: mockStop,
        stopAll: mockStopAll,
        setParameter: mockSetParameter,
        setSourcePosition: mockSetSourcePosition,
        setListenerPosition: mockSetListenerPosition,
        setBusVolume: mockSetBusVolume,
        pause: mockPause,
        resume: mockResume,
        suspend: mockSuspend,
        destroy: mockDestroy,
        isAvailable: vi.fn(() => true),
        getActiveInstanceCount: vi.fn(() => counter),
      };

      return {
        backend,
        mockPlay,
        mockStop,
        mockStopAll,
        mockSetParameter,
        mockSetSourcePosition,
        mockSetListenerPosition,
        mockSetBusVolume,
        mockPause,
        mockResume,
        mockSuspend,
        mockDestroy,
        mockInit,
        mockUnlock,
      };
    }

    it('proves a handle remains owned by the backend that created it across fallback transition', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      // 1. Play first sound on primary backend
      const handle1 = service.play('sfx.door_open');
      expect(handle1).toBe('primary_backend_handle_1_sfx.door_open');
      expect(primary.mockPlay).toHaveBeenCalledTimes(1);
      expect(fallback.mockPlay).not.toHaveBeenCalled();
      expect(service.isInstanceActive(handle1)).toBe(true);

      // 2. Primary backend fails on next play -> triggers fallback
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary device disconnected');
      });

      const handle2 = service.play('sfx.bell');
      expect(handle2).toBe('fallback_backend_handle_1_sfx.bell');
      expect(fallback.mockPlay).toHaveBeenCalledTimes(1);

      // 3. Service now has activeBackend as fallback, but handle1 MUST still be active and owned by primary
      expect(service.getActiveBackendId()).toBe('fallback_backend');
      expect(service.isInstanceActive(handle1)).toBe(true);
      expect(service.isInstanceActive(handle2)).toBe(true);
    });

    it('routes stop(handle) strictly to the backend that created the handle', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      const handle1 = service.play('sfx.door_open');
      // Trigger fallback
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      const handle2 = service.play('sfx.bell');

      // Stop handle1: MUST target primary backend, NOT fallback
      service.stop(handle1, 0.1);
      expect(primary.mockStop).toHaveBeenCalledWith(handle1, 0.1);
      expect(fallback.mockStop).not.toHaveBeenCalled();
      expect(service.isInstanceActive(handle1)).toBe(false);
      expect(service.isInstanceActive(handle2)).toBe(true);

      // Stop handle2: MUST target fallback backend
      service.stop(handle2, 0.2);
      expect(fallback.mockStop).toHaveBeenCalledWith(handle2, 0.2);
      expect(service.isInstanceActive(handle2)).toBe(false);
    });

    it('routes setParameter(..., handle) strictly to the owning backend', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      const handle1 = service.play('sfx.engine');
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      const handle2 = service.play('sfx.radio');

      // Set parameter on primary handle
      service.setParameter('rpm', 3000, handle1);
      expect(primary.mockSetParameter).toHaveBeenCalledWith('rpm', 3000, handle1);
      expect(fallback.mockSetParameter).not.toHaveBeenCalledWith('rpm', 3000, handle1);

      // Set parameter on fallback handle
      service.setParameter('tuning', 104.5, handle2);
      expect(fallback.mockSetParameter).toHaveBeenCalledWith('tuning', 104.5, handle2);
      expect(primary.mockSetParameter).not.toHaveBeenCalledWith('tuning', 104.5, handle2);
    });

    it('routes setSourcePosition(handle, ...) strictly to the owning backend', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      const handle1 = service.play('device.clock_tick');
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      const handle2 = service.play('device.lamp_buzz');

      const pos1 = { x: -0.5, y: 0.2, z: 0.1 };
      const pos2 = { x: 0.8, y: -0.4, z: 0.0 };

      service.setSourcePosition(handle1, pos1);
      expect(primary.mockSetSourcePosition).toHaveBeenCalledWith(handle1, pos1, undefined);
      expect(fallback.mockSetSourcePosition).not.toHaveBeenCalledWith(handle1, pos1, undefined);

      service.setSourcePosition(handle2, pos2);
      expect(fallback.mockSetSourcePosition).toHaveBeenCalledWith(handle2, pos2, undefined);
      expect(primary.mockSetSourcePosition).not.toHaveBeenCalledWith(handle2, pos2, undefined);
    });

    it('stopAll cleans up all initialized/used backends without double-stopping', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      const handle1 = service.play('sfx.one');
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      const handle2 = service.play('sfx.two');

      expect(service.isInstanceActive(handle1)).toBe(true);
      expect(service.isInstanceActive(handle2)).toBe(true);

      service.stopAll(0.05);

      expect(primary.mockStopAll).toHaveBeenCalledTimes(1);
      expect(fallback.mockStopAll).toHaveBeenCalledTimes(1);
      expect(service.isInstanceActive(handle1)).toBe(false);
      expect(service.isInstanceActive(handle2)).toBe(false);
    });

    it('destroy cleans up all initialized/used backends without double-destroying even when called repeatedly', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const unusedFallback = createMockBackend('unused_fallback');

      // Case A: Service with fallback that got activated
      const serviceA = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      serviceA.play('sfx.one');
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      serviceA.play('sfx.two');

      serviceA.destroy();
      serviceA.destroy(); // Repeated call must be idempotent

      expect(primary.mockDestroy).toHaveBeenCalledTimes(1);
      expect(fallback.mockDestroy).toHaveBeenCalledTimes(1);

      // Case B: Service where fallback was never initialized or used
      const serviceB = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: unusedFallback.backend,
      });

      serviceB.play('sfx.only_primary');
      serviceB.destroy();

      expect(unusedFallback.mockDestroy).not.toHaveBeenCalled();
    });

    it('fallback transition remains deterministic and does not duplicate active instance state', () => {
      const primary = createMockBackend('primary_backend');
      const fallback = createMockBackend('fallback_backend');
      const service = new AudioService({
        primaryBackend: primary.backend,
        fallbackBackend: fallback.backend,
      });

      const handle1 = service.play('sfx.step');
      expect(service.isInstanceActive(handle1)).toBe(true);

      // Primary fails, fallback succeeds
      primary.mockPlay.mockImplementationOnce(() => {
        throw new Error('Primary failure');
      });
      const handle2 = service.play('sfx.jump');
      expect(service.isInstanceActive(handle2)).toBe(true);

      // Now both fail -> returns empty string, must NOT create phantom active instances
      fallback.mockPlay.mockImplementationOnce(() => {
        throw new Error('Fallback also failed');
      });
      const handle3 = service.play('sfx.impossible');
      expect(handle3).toBe('');
      expect(service.isInstanceActive('')).toBe(false);

      // Only handle1 and handle2 remain active
      expect(service.isInstanceActive(handle1)).toBe(true);
      expect(service.isInstanceActive(handle2)).toBe(true);
    });
  });
});
