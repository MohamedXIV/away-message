// src/audio/AudioService.ts

import type {
  AudioBackend,
  AudioBusCategory,
  AudioEnvironmentParameters,
  AudioOrientation3D,
  AudioPlayOptions,
  AudioPosition3D,
  ListenerOrientation,
} from './types';
import { WebAudioBackend } from './WebAudioBackend';
import { mapOrientationNameToVector } from './spatialMapping';

export interface AudioServiceOptions {
  primaryBackend?: AudioBackend;
  fallbackBackend?: AudioBackend;
  masterVolume?: number;
}

interface ActiveInstanceMeta {
  handle: string;
  eventId: string;
  backend: AudioBackend;
  backendId: string;
  parameters: Map<string, number>;
  position?: AudioPosition3D;
  bus?: AudioBusCategory;
}

/**
 * AudioService: Canonical renderer-neutral spatial audio authority.
 *
 * Exposes pure semantic audio events to simulation and presentation layers.
 * Completely isolates callers from AudioContext, nodes, or FMOD handles.
 */
export class AudioService {
  private primaryBackend: AudioBackend;
  private fallbackBackend?: AudioBackend;
  private activeBackend: AudioBackend;
  private usedBackends: Set<AudioBackend> = new Set();
  private busVolumes: Map<AudioBusCategory, number> = new Map();

  private activeInstances: Map<string, ActiveInstanceMeta> = new Map();
  private globalParameters: Map<string, number> = new Map();
  private currentAmbienceHandle?: string;

  private isPausedState = false;
  private isDestroyedState = false;
  private listenerPos: AudioPosition3D = { x: 0, y: 0, z: 0 };
  private listenerOrient: ListenerOrientation = 'forward';

  constructor(options?: AudioServiceOptions) {
    this.primaryBackend = options?.primaryBackend ?? new WebAudioBackend();
    this.fallbackBackend = options?.fallbackBackend;
    this.activeBackend = this.primaryBackend;
    this.usedBackends.add(this.primaryBackend);

    if (options?.masterVolume !== undefined) {
      this.setBusVolume('master', options.masterVolume);
    }
  }

  private activateFallbackBackend(): void {
    if (!this.fallbackBackend || this.fallbackBackend === this.activeBackend) return;
    this.activeBackend = this.fallbackBackend;
    this.usedBackends.add(this.fallbackBackend);

    // Sync global parameters to fallback backend
    for (const [k, v] of this.globalParameters.entries()) {
      this.fallbackBackend.setParameter(k, v);
    }

    // Sync listener position & orientation to fallback backend
    const vector = mapOrientationNameToVector(this.listenerOrient);
    this.fallbackBackend.setListenerPosition(this.listenerPos, vector);

    // Sync bus volumes to fallback backend
    for (const [bus, vol] of this.busVolumes.entries()) {
      this.fallbackBackend.setBusVolume(bus, vol);
    }

    // If service was paused, pause fallback backend as well
    if (this.isPausedState) {
      this.fallbackBackend.pause();
    }
  }

  public async init(): Promise<void> {
    this.usedBackends.add(this.primaryBackend);
    try {
      await this.primaryBackend.init();
      if (this.primaryBackend.isAvailable() || !this.fallbackBackend) return;
    } catch {
      if (!this.fallbackBackend) return;
    }

    // An adapter may fail gracefully by reporting unavailable instead of
    // throwing (the FMOD HTML5 spike deliberately does this). Initialize the
    // fallback before synchronizing service state into it.
    this.usedBackends.add(this.fallbackBackend);
    await this.fallbackBackend.init();
    this.activateFallbackBackend();
  }

  public async unlock(): Promise<void> {
    const promises: (Promise<void> | void)[] = [];
    for (const backend of this.usedBackends) {
      try {
        promises.push(backend.unlock());
      } catch {
        // Ignored
      }
    }
    await Promise.all(promises);
  }

  public play(eventId: string, options?: AudioPlayOptions): string {
    let handle: string;
    let usedBackend = this.activeBackend;

    try {
      this.usedBackends.add(this.activeBackend);
      handle = this.activeBackend.play(eventId, options);
    } catch {
      if (this.fallbackBackend && this.fallbackBackend !== this.activeBackend) {
        this.activateFallbackBackend();
        usedBackend = this.fallbackBackend;
        try {
          handle = this.fallbackBackend.play(eventId, options);
        } catch {
          return '';
        }
      } else {
        return '';
      }
    }

    if (!handle) {
      return '';
    }

    const instanceMeta: ActiveInstanceMeta = {
      handle,
      eventId,
      backend: usedBackend,
      backendId: usedBackend.id,
      parameters: new Map(Object.entries(options?.parameters ?? {})),
      position: options?.position,
      bus: options?.bus,
    };

    // Apply any active global parameters to the new instance
    for (const [k, v] of this.globalParameters.entries()) {
      if (!instanceMeta.parameters.has(k)) {
        usedBackend.setParameter(k, v, handle);
      }
    }

    this.activeInstances.set(handle, instanceMeta);
    return handle;
  }

  public stop(handle: string, fadeOutSeconds = 0.05): void {
    const inst = this.activeInstances.get(handle);
    if (!inst) return;
    inst.backend.stop(handle, fadeOutSeconds);
    this.activeInstances.delete(handle);
    if (this.currentAmbienceHandle === handle) {
      this.currentAmbienceHandle = undefined;
    }
  }

  public stopAll(fadeOutSeconds = 0.05): void {
    for (const backend of this.usedBackends) {
      backend.stopAll(fadeOutSeconds);
    }
    this.activeInstances.clear();
    this.currentAmbienceHandle = undefined;
  }

  public isInstanceActive(handle: string): boolean {
    return this.activeInstances.has(handle);
  }

  public setParameter(name: string, value: number, handle?: string): void {
    if (handle) {
      const inst = this.activeInstances.get(handle);
      if (inst) {
        inst.parameters.set(name, value);
        inst.backend.setParameter(name, value, handle);
      }
    } else {
      this.setGlobalParameter(name, value);
    }
  }

  public getParameter(name: string, handle: string): number | undefined {
    return this.activeInstances.get(handle)?.parameters.get(name);
  }

  public setGlobalParameter(name: string, value: number): void {
    this.globalParameters.set(name, value);
    for (const backend of this.usedBackends) {
      backend.setParameter(name, value);
    }
    for (const inst of this.activeInstances.values()) {
      inst.parameters.set(name, value);
    }
  }

  public getGlobalParameter(name: string): number | undefined {
    return this.globalParameters.get(name);
  }

  public updateEnvironment(params: AudioEnvironmentParameters): void {
    if (params.rainIntensity !== undefined) {
      this.setGlobalParameter('rainIntensity', params.rainIntensity);
    }
    if (params.windIntensity !== undefined) {
      this.setGlobalParameter('windIntensity', params.windIntensity);
    }
    if (params.isInterior !== undefined) {
      this.setGlobalParameter('isInterior', params.isInterior ? 1 : 0);
    }
    if (params.muffled !== undefined) {
      this.setGlobalParameter('muffled', params.muffled ? 1 : 0);
    }
    if (params.windowOpen !== undefined) {
      this.setGlobalParameter('windowOpen', params.windowOpen ? 1 : 0);
    }
  }

  public setSourcePosition(
    handle: string,
    position: AudioPosition3D,
    orientation?: AudioOrientation3D,
  ): void {
    const inst = this.activeInstances.get(handle);
    if (!inst) return;
    inst.position = position;
    inst.backend.setSourcePosition(handle, position, orientation);
  }

  public setListenerPosition(
    position: AudioPosition3D,
    orientation?: AudioOrientation3D,
  ): void {
    this.listenerPos = position;
    for (const backend of this.usedBackends) {
      backend.setListenerPosition(position, orientation);
    }
  }

  public setListenerOrientation(orientation: ListenerOrientation): void {
    this.listenerOrient = orientation;
    const vector = mapOrientationNameToVector(orientation);
    this.setListenerPosition(this.listenerPos, vector);
  }

  public getListenerOrientation(): ListenerOrientation {
    return this.listenerOrient;
  }

  public setBusVolume(bus: AudioBusCategory, volume: number): void {
    this.busVolumes.set(bus, volume);
    for (const backend of this.usedBackends) {
      backend.setBusVolume(bus, volume);
    }
  }

  public transitionAmbience(
    eventId: string,
    options?: { fadeDurationSeconds?: number; volume?: number; loop?: boolean },
  ): string {
    const fadeDuration = options?.fadeDurationSeconds ?? 1.5;

    if (this.currentAmbienceHandle) {
      this.stop(this.currentAmbienceHandle, fadeDuration);
    }

    const newHandle = this.play(eventId, {
      loop: options?.loop ?? true,
      volume: options?.volume ?? 1.0,
      bus: 'ambience',
      fadeInSeconds: fadeDuration,
    });

    this.currentAmbienceHandle = newHandle;
    return newHandle;
  }

  public pause(): void {
    if (this.isPausedState) return;
    this.isPausedState = true;
    for (const backend of this.usedBackends) {
      backend.pause();
    }
  }

  public resume(): void {
    if (!this.isPausedState) return;
    this.isPausedState = false;
    for (const backend of this.usedBackends) {
      backend.resume();
    }
  }

  public suspend(): void {
    for (const backend of this.usedBackends) {
      backend.suspend();
    }
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }

  public destroy(): void {
    if (this.isDestroyedState) return;
    this.isDestroyedState = true;
    this.stopAll(0);
    const destroyed = new Set<AudioBackend>();
    for (const backend of this.usedBackends) {
      if (!destroyed.has(backend)) {
        destroyed.add(backend);
        backend.destroy();
      }
    }
    this.usedBackends.clear();
  }

  public getActiveBackendId(): string {
    return this.activeBackend.id;
  }
}

// Canonical singleton instance for presentation and UI
export const audioService = new AudioService();
