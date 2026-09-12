// src/audio/types.ts

/**
 * 3D spatial coordinate in normalized scene space.
 * - x: -1.0 (far left) to +1.0 (far right)
 * - y: -1.0 (bottom / floor) to +1.0 (top / ceiling)
 * - z: -1.0 (rear / behind) to +1.0 (front / deep)
 */
export interface AudioPosition3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D orientation defined by forward and up unit vectors.
 */
export interface AudioOrientation3D {
  forward: AudioPosition3D;
  up: AudioPosition3D;
}

/**
 * Canonical listener direction aliases for 2D/2.5D physical scenes.
 */
export type ListenerOrientation = 'forward' | 'back' | 'left' | 'right' | number;

/**
 * Category buses for volume control and routing.
 */
export type AudioBusCategory = 'master' | 'ambience' | 'sfx' | 'music' | 'voice';

/**
 * Playback options for a semantic audio event.
 */
export interface AudioPlayOptions {
  loop?: boolean;
  volume?: number; // 0.0 .. 1.0 (default 1.0)
  pitch?: number; // rate multiplier (default 1.0)
  bus?: AudioBusCategory; // default 'sfx' or inferred from event category
  position?: AudioPosition3D;
  orientation?: AudioOrientation3D;
  rolloffFactor?: number;
  maxDistance?: number;
  parameters?: Record<string, number>;
  fadeInSeconds?: number;
}

/**
 * Authored spatial audio source definition.
 */
export interface SpatialAudioSourceDef {
  id: string;
  eventId: string;
  x: number;
  y: number;
  z?: number;
  loop?: boolean;
  volume?: number;
  bus?: AudioBusCategory;
  rolloffFactor?: number;
  parameters?: Record<string, number>;
  attachedTargetName?: string;
}

/**
 * Environment-level parameters communicated to the audio system.
 */
export interface AudioEnvironmentParameters {
  rainIntensity?: number; // 0.0 .. 1.0
  windIntensity?: number; // 0.0 .. 1.0
  timeOfDay?: string;
  isInterior?: boolean;
  windowOpen?: boolean;
  muffled?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Renderer-neutral Audio Backend interface.
 */
export interface AudioBackend {
  readonly id: string;
  init(): Promise<void> | void;
  unlock(): Promise<void> | void;
  play(eventId: string, options?: AudioPlayOptions): string;
  stop(handle: string, fadeOutSeconds?: number): void;
  stopAll(fadeOutSeconds?: number): void;
  setParameter(name: string, value: number, handle?: string): void;
  setSourcePosition(handle: string, position: AudioPosition3D, orientation?: AudioOrientation3D): void;
  setListenerPosition(position: AudioPosition3D, orientation?: AudioOrientation3D): void;
  setBusVolume(bus: AudioBusCategory, volume: number): void;
  pause(): void;
  resume(): void;
  suspend(): void;
  destroy(): void;
  isAvailable(): boolean;
  getActiveInstanceCount(): number;
}
