// src/audio/FmodBackend.ts

import type {
  AudioBackend,
  AudioBusCategory,
  AudioOrientation3D,
  AudioPlayOptions,
  AudioPosition3D,
} from './types';

export interface FmodDiagnostics {
  runtimeDetected: boolean;
  banksLoaded: boolean;
  blockerReason?: string;
  loadedBanks: string[];
}

/**
 * FMOD Studio HTML5 Backend Adapter & Evaluation Spike.
 *
 * Implements the renderer-neutral AudioBackend contract for FMOD Studio HTML5.
 * Checks for runtime presence and manages graceful degradation when proprietary
 * binaries or .bank assets are absent.
 */
export class FmodBackend implements AudioBackend {
  public readonly id = 'fmod_html5';

  private isRuntimeDetected = false;
  private areBanksLoaded = false;
  private blockerReason?: string;
  private nextId = 0;
  private activeInstances: Map<string, unknown> = new Map();

  constructor() {
    this.detectRuntime();
  }

  public async init(): Promise<void> {
    this.detectRuntime();
    if (!this.isRuntimeDetected) {
      this.blockerReason =
        'FMOD Studio HTML5 runtime (fmodstudio.js / fmodstudio.wasm) not found in bundle. Commercial license and proprietary WASM binaries are required for compilation.';
      return;
    }

    // In a setup where FMOD WASM is present:
    // 1. Initialize FMOD System: FMOD.Studio_System_Create()
    // 2. Load Master.bank and Master.strings.bank via FS.createPreloadedFile
    // 3. Mark areBanksLoaded = true
  }

  public async unlock(): Promise<void> {
    // FMOD HTML5 requires audio output resume on user gesture via FMOD mixer suspend/resume
  }

  public play(eventId: string, options?: AudioPlayOptions): string {
    const handle = `fmod_${++this.nextId}_${eventId}`;
    if (!this.isAvailable()) {
      // In unavailable state, return dummy handle
      return handle;
    }

    // Map semantic ID to FMOD event path (e.g. "sfx.door_open" -> "event:/sfx/door_open")
    // const fmodPath = `event:/${eventId.replace(/\./g, '/')}`;
    // const eventDesc = this.studioSystem.getEvent(fmodPath);
    // const instance = eventDesc.createInstance();
    // instance.start();

    this.activeInstances.set(handle, { eventId, options });
    return handle;
  }

  public stop(handle: string, _fadeOutSeconds = 0.05): void {
    this.activeInstances.delete(handle);
  }

  public stopAll(_fadeOutSeconds = 0.05): void {
    this.activeInstances.clear();
  }

  public setParameter(_name: string, _value: number, _handle?: string): void {
    // Maps to FMOD Studio instance.setParameterByName() or studioSystem.setParameterByName()
  }

  public setSourcePosition(
    _handle: string,
    _position: AudioPosition3D,
    _orientation?: AudioOrientation3D,
  ): void {
    // Maps to FMOD_3D_ATTRIBUTES: position, velocity, forward, up
  }

  public setListenerPosition(
    _position: AudioPosition3D,
    _orientation?: AudioOrientation3D,
  ): void {
    // Maps to studioSystem.setListenerAttributes(0, attributes)
  }

  public setBusVolume(_bus: AudioBusCategory, _volume: number): void {
    // Maps to studioSystem.getBus(`bus:/${bus}`).setVolume(volume)
  }

  public pause(): void {
    // Maps to studioSystem.getBus('bus:/').setPaused(true)
  }

  public resume(): void {
    // Maps to studioSystem.getBus('bus:/').setPaused(false)
  }

  public suspend(): void {
    // Maps to studioSystem.getBus('bus:/').setMute(true)
  }

  public destroy(): void {
    this.stopAll();
  }

  public isAvailable(): boolean {
    return this.isRuntimeDetected && this.areBanksLoaded;
  }

  public getActiveInstanceCount(): number {
    return this.activeInstances.size;
  }

  public getDiagnostics(): FmodDiagnostics {
    return {
      runtimeDetected: this.isRuntimeDetected,
      banksLoaded: this.areBanksLoaded,
      blockerReason: this.blockerReason,
      loadedBanks: [],
    };
  }

  private detectRuntime(): void {
    if (typeof window !== 'undefined' && (window as unknown as { FMOD?: unknown }).FMOD) {
      this.isRuntimeDetected = true;
    } else {
      this.isRuntimeDetected = false;
      this.blockerReason =
        'FMOD Studio HTML5 runtime (fmodstudio.js / fmodstudio.wasm) not found in browser bundle.';
    }
  }
}
