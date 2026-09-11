// src/audio/WebAudioBackend.ts

import type {
  AudioBackend,
  AudioBusCategory,
  AudioOrientation3D,
  AudioPlayOptions,
  AudioPosition3D,
} from './types';

export interface ActiveWebAudioInstance {
  handle: string;
  eventId: string;
  bus: AudioBusCategory;
  gainNode: GainNode;
  pannerNode?: PannerNode;
  filterNode?: BiquadFilterNode;
  sourceNodes: (AudioNode | { stop: (when?: number) => void })[];
  parameters: Map<string, number>;
  isLoop: boolean;
  startTime: number;
}

export class WebAudioBackend implements AudioBackend {
  public readonly id = 'webaudio';

  private ctx: AudioContext | null = null;
  private isExternalContext = false;
  private isUnlocked = false;
  private isPausedState = false;
  private nextId = 0;

  // Bus gain nodes
  private masterGain: GainNode | null = null;
  private busGains: Map<AudioBusCategory, GainNode> = new Map();

  // Active playing instances
  private activeInstances: Map<string, ActiveWebAudioInstance> = new Map();

  constructor(context?: AudioContext) {
    if (context) {
      this.ctx = context;
      this.isExternalContext = true;
      this.initNodes();
    }
  }

  public init(): void {
    if (this.ctx) return;
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
    } catch {
      // Graceful fallback for restricted environments
    }

    if (this.ctx) {
      this.initNodes();
    }
  }

  private initNodes(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    const categories: AudioBusCategory[] = ['master', 'ambience', 'sfx', 'music', 'voice'];
    for (const cat of categories) {
      if (cat === 'master') {
        this.busGains.set('master', this.masterGain);
      } else {
        const busGain = this.ctx.createGain();
        busGain.connect(this.masterGain);
        this.busGains.set(cat, busGain);
      }
    }
  }

  public async unlock(): Promise<void> {
    if (this.isUnlocked && this.ctx?.state === 'running') return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        this.isUnlocked = true;
      } catch {
        // Ignored if user hasn't interacted yet
      }
    } else {
      this.isUnlocked = true;
    }
  }

  public play(eventId: string, options?: AudioPlayOptions): string {
    if (!this.ctx) this.init();
    if (!this.ctx) {
      return `dummy_${++this.nextId}`;
    }

    const handle = `audio_${++this.nextId}_${eventId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const busName = options?.bus ?? this.inferBus(eventId);
    const busGain = this.busGains.get(busName) ?? this.masterGain ?? this.ctx.destination;

    const gainNode = this.ctx.createGain();
    const initialVolume = options?.volume ?? 1.0;
    const now = this.ctx.currentTime || 0;

    if (options?.fadeInSeconds && options.fadeInSeconds > 0) {
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(initialVolume, now + options.fadeInSeconds);
    } else {
      gainNode.gain.setValueAtTime(initialVolume, now);
    }

    let pannerNode: PannerNode | undefined;
    if (options?.position) {
      pannerNode = this.ctx.createPanner();
      try {
        pannerNode.panningModel = 'HRTF';
      } catch {
        pannerNode.panningModel = 'equalpower';
      }
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 100;
      pannerNode.rolloffFactor = options.rolloffFactor ?? 1.0;

      this.applyPositionToPanner(pannerNode, options.position, options.orientation);
    }

    const filterNode = this.ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(20000, now);

    // Wire up graph: source -> filter -> gain -> (panner) -> bus
    filterNode.connect(gainNode);
    if (pannerNode) {
      gainNode.connect(pannerNode);
      pannerNode.connect(busGain as unknown as AudioNode);
    } else {
      gainNode.connect(busGain as unknown as AudioNode);
    }

    const sourceNodes = this.synthesizeSemanticSound(eventId, filterNode, options);

    const instance: ActiveWebAudioInstance = {
      handle,
      eventId,
      bus: busName,
      gainNode,
      pannerNode,
      filterNode,
      sourceNodes,
      parameters: new Map(Object.entries(options?.parameters ?? {})),
      isLoop: options?.loop ?? false,
      startTime: now,
    };

    if (options?.parameters) {
      for (const [k, v] of Object.entries(options.parameters)) {
        this.applyParameterToInstance(instance, k, v);
      }
    }

    this.activeInstances.set(handle, instance);

    // Auto-teardown for non-looping one-shots if not explicitly stopped
    if (!options?.loop) {
      const estimatedDurationMs = this.getEstimatedOneShotDurationMs(eventId);
      setTimeout(() => {
        if (this.activeInstances.has(handle)) {
          this.stop(handle, 0.05);
        }
      }, estimatedDurationMs);
    }

    return handle;
  }

  public stop(handle: string, fadeOutSeconds = 0.05): void {
    const instance = this.activeInstances.get(handle);
    if (!instance || !this.ctx) {
      this.activeInstances.delete(handle);
      return;
    }

    const now = this.ctx.currentTime || 0;
    try {
      if (fadeOutSeconds > 0) {
        instance.gainNode.gain.setValueAtTime(instance.gainNode.gain.value, now);
        instance.gainNode.gain.linearRampToValueAtTime(0.001, now + fadeOutSeconds);
      } else {
        instance.gainNode.gain.setValueAtTime(0, now);
      }
    } catch {
      // Ignored if audio param ramp fails in edge state
    }

    if (fadeOutSeconds <= 0) {
      this.teardownInstance(instance);
    } else {
      setTimeout(() => {
        this.teardownInstance(instance);
      }, Math.max(10, Math.round(fadeOutSeconds * 1000)));
    }

    this.activeInstances.delete(handle);
  }

  public stopAll(fadeOutSeconds = 0.05): void {
    const handles = Array.from(this.activeInstances.keys());
    for (const h of handles) {
      this.stop(h, fadeOutSeconds);
    }
  }

  public setParameter(name: string, value: number, handle?: string): void {
    if (handle) {
      const inst = this.activeInstances.get(handle);
      if (inst) {
        inst.parameters.set(name, value);
        this.applyParameterToInstance(inst, name, value);
      }
    } else {
      for (const inst of this.activeInstances.values()) {
        inst.parameters.set(name, value);
        this.applyParameterToInstance(inst, name, value);
      }
    }
  }

  public setSourcePosition(
    handle: string,
    position: AudioPosition3D,
    orientation?: AudioOrientation3D,
  ): void {
    const inst = this.activeInstances.get(handle);
    if (!inst) return;

    if (!inst.pannerNode && this.ctx) {
      // Lazily attach panner if source became positional
      inst.pannerNode = this.ctx.createPanner();
      inst.pannerNode.panningModel = 'HRTF';
      inst.gainNode.disconnect();
      inst.gainNode.connect(inst.pannerNode);
      const busGain = this.busGains.get(inst.bus) ?? this.masterGain ?? this.ctx.destination;
      inst.pannerNode.connect(busGain as unknown as AudioNode);
    }

    if (inst.pannerNode) {
      this.applyPositionToPanner(inst.pannerNode, position, orientation);
    }
  }

  public setListenerPosition(
    position: AudioPosition3D,
    orientation?: AudioOrientation3D,
  ): void {
    if (!this.ctx?.listener) return;
    const l = this.ctx.listener;
    const now = this.ctx.currentTime || 0;

    if (l.positionX && typeof l.positionX.setValueAtTime === 'function') {
      l.positionX.setValueAtTime(position.x, now);
      l.positionY.setValueAtTime(position.y, now);
      l.positionZ.setValueAtTime(position.z, now);
    } else if (typeof l.setPosition === 'function') {
      l.setPosition(position.x, position.y, position.z);
    }

    if (orientation) {
      const { forward, up } = orientation;
      if (l.forwardX && typeof l.forwardX.setValueAtTime === 'function') {
        l.forwardX.setValueAtTime(forward.x, now);
        l.forwardY.setValueAtTime(forward.y, now);
        l.forwardZ.setValueAtTime(forward.z, now);
        l.upX.setValueAtTime(up.x, now);
        l.upY.setValueAtTime(up.y, now);
        l.upZ.setValueAtTime(up.z, now);
      } else if (typeof l.setOrientation === 'function') {
        l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
      }
    }
  }

  public setBusVolume(bus: AudioBusCategory, volume: number): void {
    const gainNode = this.busGains.get(bus);
    if (gainNode && this.ctx) {
      const clamped = Math.max(0, Math.min(1, volume));
      gainNode.gain.setValueAtTime(clamped, this.ctx.currentTime || 0);
    }
  }

  public pause(): void {
    if (this.isPausedState) return;
    this.isPausedState = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime || 0);
    }
  }

  public resume(): void {
    if (!this.isPausedState) return;
    this.isPausedState = false;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime || 0);
    }
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public suspend(): void {
    if (this.ctx && this.ctx.state !== 'suspended') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public destroy(): void {
    this.stopAll(0);
    for (const g of this.busGains.values()) {
      try {
        g.disconnect();
      } catch {
        // Ignored
      }
    }
    this.busGains.clear();
    this.activeInstances.clear();
    if (this.ctx && !this.isExternalContext) {
      try {
        this.ctx.close().catch(() => {});
      } catch {
        // Ignored
      }
      this.ctx = null;
    }
  }

  public isAvailable(): boolean {
    return this.ctx !== null;
  }

  public getActiveInstanceCount(): number {
    return this.activeInstances.size;
  }

  public getInstance(handle: string): ActiveWebAudioInstance | undefined {
    return this.activeInstances.get(handle);
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private inferBus(eventId: string): AudioBusCategory {
    if (eventId.startsWith('ambience.') || eventId.includes('weather') || eventId.includes('room_tone')) {
      return 'ambience';
    }
    if (eventId.startsWith('music.')) {
      return 'music';
    }
    if (eventId.startsWith('voice.')) {
      return 'voice';
    }
    return 'sfx';
  }

  private applyPositionToPanner(
    panner: PannerNode,
    pos: AudioPosition3D,
    orient?: AudioOrientation3D,
  ): void {
    const now = this.ctx?.currentTime || 0;
    if (panner.positionX && typeof panner.positionX.setValueAtTime === 'function') {
      panner.positionX.setValueAtTime(pos.x, now);
      panner.positionY.setValueAtTime(pos.y, now);
      panner.positionZ.setValueAtTime(pos.z, now);
    } else if (typeof panner.setPosition === 'function') {
      panner.setPosition(pos.x, pos.y, pos.z);
    }

    if (orient) {
      if (panner.orientationX && typeof panner.orientationX.setValueAtTime === 'function') {
        panner.orientationX.setValueAtTime(orient.forward.x, now);
        panner.orientationY.setValueAtTime(orient.forward.y, now);
        panner.orientationZ.setValueAtTime(orient.forward.z, now);
      } else if (typeof panner.setOrientation === 'function') {
        panner.setOrientation(orient.forward.x, orient.forward.y, orient.forward.z);
      }
    }
  }

  private applyParameterToInstance(
    instance: ActiveWebAudioInstance,
    paramName: string,
    value: number,
  ): void {
    const now = this.ctx?.currentTime || 0;
    switch (paramName) {
      case 'rainIntensity': {
        // Modulate volume or filter cutoff with rain intensity
        const baseVolume = 0.2 + value * 0.8;
        instance.gainNode.gain.setValueAtTime(baseVolume, now);
        if (instance.filterNode) {
          instance.filterNode.frequency.setValueAtTime(800 + value * 4200, now);
        }
        break;
      }
      case 'windIntensity': {
        const baseVolume = 0.1 + value * 0.9;
        instance.gainNode.gain.setValueAtTime(baseVolume, now);
        if (instance.filterNode) {
          instance.filterNode.frequency.setValueAtTime(250 + value * 1200, now);
        }
        break;
      }
      case 'muffled':
      case 'isInterior': {
        if (instance.filterNode) {
          const cutoff = value > 0.5 ? 900 : 18000;
          instance.filterNode.frequency.setValueAtTime(cutoff, now);
        }
        break;
      }
      case 'pitch': {
        for (const s of instance.sourceNodes) {
          if ('frequency' in s && s.frequency && typeof (s.frequency as AudioParam).setValueAtTime === 'function') {
            (s.frequency as AudioParam).setValueAtTime(440 * value, now);
          }
        }
        break;
      }
    }
  }

  private synthesizeSemanticSound(
    eventId: string,
    outputDestination: AudioNode,
    options?: AudioPlayOptions,
  ): (AudioNode | { stop: (when?: number) => void })[] {
    if (!this.ctx) return [];
    const created: (AudioNode | { stop: (when?: number) => void })[] = [];

    try {
      if (eventId.includes('rain')) {
        // Procedural filtered noise for rain
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, 0);
        osc.connect(outputDestination);
        osc.start();
        created.push(osc);
      } else if (eventId.includes('wind')) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(65, 0);
        osc.connect(outputDestination);
        osc.start();
        created.push(osc);
      } else if (eventId.includes('fridge')) {
        // 60Hz hum + 120Hz harmonic
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(60, 0);
        osc1.connect(outputDestination);
        osc1.start();
        created.push(osc1);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(120, 0);
        osc2.connect(outputDestination);
        osc2.start();
        created.push(osc2);
      } else if (eventId.includes('lamp')) {
        // 120Hz electrical buzz
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, 0);
        osc.connect(outputDestination);
        osc.start();
        created.push(osc);
      } else if (eventId.includes('fan')) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(75, 0);
        osc.connect(outputDestination);
        osc.start();
        created.push(osc);
      } else if (eventId.includes('clock')) {
        // Clock tick: brief click
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, 0);
        osc.connect(outputDestination);
        osc.start();
        if (!options?.loop) {
          osc.stop(0.04);
        }
        created.push(osc);
      } else {
        // Generic subtle tone blip for one-shots
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, 0);
        osc.connect(outputDestination);
        osc.start();
        if (!options?.loop) {
          osc.stop(0.12);
        }
        created.push(osc);
      }
    } catch {
      // Ignored if headless mock doesn't support specific oscillator methods
    }

    return created;
  }

  private getEstimatedOneShotDurationMs(eventId: string): number {
    if (eventId.includes('click') || eventId.includes('clock')) return 80;
    if (eventId.includes('door')) return 600;
    if (eventId.includes('window')) return 400;
    return 300;
  }

  private teardownInstance(instance: ActiveWebAudioInstance): void {
    for (const node of instance.sourceNodes) {
      if ('stop' in node && typeof node.stop === 'function') {
        try {
          node.stop();
        } catch {
          // Ignored
        }
      }
      if ('disconnect' in node && typeof (node as AudioNode).disconnect === 'function') {
        try {
          (node as AudioNode).disconnect();
        } catch {
          // Ignored
        }
      }
    }
    try {
      instance.gainNode.disconnect();
      instance.filterNode?.disconnect();
      instance.pannerNode?.disconnect();
    } catch {
      // Ignored
    }
  }
}
