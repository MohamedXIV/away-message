export class SynthAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted = false;
  private activeHandshakeNodes: { stop: () => void } | null = null;

  constructor() {
    // Lazy audio context initialization
  }

  public init(context?: AudioContext): void {
    if (this.ctx) return;
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = context || new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.sfxGain = this.ctx.createGain();

          this.sfxGain.connect(this.masterGain);
          this.masterGain.connect(this.ctx.destination);
        }
      } else if (context) {
        this.ctx = context;
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch {
      // Graceful fallback for headless or restricted environments
    }
  }

  public getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      this.init();
    }
    return this.ctx;
  }

  public setMasterVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime);
    }
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  public stopDialup(): void {
    if (this.activeHandshakeNodes) {
      this.activeHandshakeNodes.stop();
      this.activeHandshakeNodes = null;
    }
  }

  // =========================================================
  // 1. Procedural 10-Stage Dial-up Modem Handshake Simulation
  // =========================================================
  public playDialupHandshake(onComplete?: () => void): { cancel: () => void } {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) {
      onComplete?.();
      return { cancel: () => {} };
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime + 0.05;
    const soundNodes: (AudioNode | { stop: (t?: number) => void })[] = [];

    try {
      // Stage 1: Dial Tone (350Hz + 440Hz, 1.2s)
      const oscDial1 = ctx.createOscillator();
      const oscDial2 = ctx.createOscillator();
      const dialGain = ctx.createGain();
      oscDial1.frequency.value = 350;
      oscDial2.frequency.value = 440;
      dialGain.gain.setValueAtTime(0.15, t0);
      dialGain.gain.setValueAtTime(0.15, t0 + 1.1);
      dialGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);

      oscDial1.connect(dialGain);
      oscDial2.connect(dialGain);
      dialGain.connect(this.sfxGain!);
      oscDial1.start(t0);
      oscDial2.start(t0);
      oscDial1.stop(t0 + 1.2);
      oscDial2.stop(t0 + 1.2);
      soundNodes.push(oscDial1, oscDial2, dialGain);

      // Stage 2: DTMF Dialing (5-5-5-0-1-9-9)
      const dtmfFrequencies: Record<string, [number, number]> = {
        '1': [697, 1209],
        '2': [697, 1336],
        '3': [697, 1477],
        '4': [770, 1209],
        '5': [770, 1336],
        '6': [770, 1477],
        '7': [852, 1209],
        '8': [852, 1336],
        '9': [852, 1477],
        '0': [941, 1336],
      };
      const numberSequence = ['5', '5', '5', '0', '1', '9', '9'];
      let dtmfTime = t0 + 1.3;

      numberSequence.forEach((digit) => {
        const [lowFreq, highFreq] = dtmfFrequencies[digit] ?? [770, 1336];
        const oscLow = ctx.createOscillator();
        const oscHigh = ctx.createOscillator();
        const digitGain = ctx.createGain();

        oscLow.frequency.value = lowFreq;
        oscHigh.frequency.value = highFreq;
        digitGain.gain.setValueAtTime(0.2, dtmfTime);
        digitGain.gain.setValueAtTime(0.2, dtmfTime + 0.065);
        digitGain.gain.exponentialRampToValueAtTime(0.001, dtmfTime + 0.07);

        oscLow.connect(digitGain);
        oscHigh.connect(digitGain);
        digitGain.connect(this.sfxGain!);

        oscLow.start(dtmfTime);
        oscHigh.start(dtmfTime);
        oscLow.stop(dtmfTime + 0.07);
        oscHigh.stop(dtmfTime + 0.07);
        soundNodes.push(oscLow, oscHigh, digitGain);

        dtmfTime += 0.11;
      });

      // Stage 3: Ringback Tone (440Hz + 480Hz)
      const ringTime = dtmfTime + 0.2;
      const oscRing1 = ctx.createOscillator();
      const oscRing2 = ctx.createOscillator();
      const ringGain = ctx.createGain();
      oscRing1.frequency.value = 440;
      oscRing2.frequency.value = 480;
      ringGain.gain.setValueAtTime(0.12, ringTime);
      ringGain.gain.setValueAtTime(0.12, ringTime + 1.2);
      ringGain.gain.exponentialRampToValueAtTime(0.001, ringTime + 1.3);

      oscRing1.connect(ringGain);
      oscRing2.connect(ringGain);
      ringGain.connect(this.sfxGain!);
      oscRing1.start(ringTime);
      oscRing2.start(ringTime);
      oscRing1.stop(ringTime + 1.3);
      oscRing2.stop(ringTime + 1.3);
      soundNodes.push(oscRing1, oscRing2, ringGain);

      // Stage 4 & 5: CED Answer Tone (2100Hz)
      const answerTime = ringTime + 1.5;
      const oscAnswer = ctx.createOscillator();
      const answerGain = ctx.createGain();
      oscAnswer.frequency.value = 2100;
      answerGain.gain.setValueAtTime(0.18, answerTime);
      answerGain.gain.setValueAtTime(0.18, answerTime + 1.8);
      answerGain.gain.exponentialRampToValueAtTime(0.001, answerTime + 1.9);

      oscAnswer.connect(answerGain);
      answerGain.connect(this.sfxGain!);
      oscAnswer.start(answerTime);
      oscAnswer.stop(answerTime + 1.9);
      soundNodes.push(oscAnswer, answerGain);

      // Stage 6 & 7: V.34 Dual-Frequency Probing & Scrambled Noise Hash
      const noiseTime = answerTime + 2.0;
      const noiseDuration = 3.2;
      const bufferSize = Math.floor(ctx.sampleRate * noiseDuration);
      const noiseBuffer = ctx.createBuffer(1, Math.max(1, bufferSize), ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, noiseTime);
      noiseFilter.frequency.linearRampToValueAtTime(2800, noiseTime + 1.5);
      noiseFilter.frequency.linearRampToValueAtTime(1200, noiseTime + 3.0);
      noiseFilter.Q.value = 3.5;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, noiseTime);
      noiseGain.gain.linearRampToValueAtTime(0.22, noiseTime + 0.4);
      noiseGain.gain.setValueAtTime(0.22, noiseTime + 2.8);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, noiseTime + noiseDuration);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain!);

      whiteNoise.start(noiseTime);
      whiteNoise.stop(noiseTime + noiseDuration);
      soundNodes.push(whiteNoise, noiseFilter, noiseGain);

      // Stage 8: Trellis Modulation Squeals
      const squealTime = noiseTime + 0.8;
      const oscSqueal = ctx.createOscillator();
      const squealGain = ctx.createGain();
      oscSqueal.type = 'sawtooth';
      oscSqueal.frequency.setValueAtTime(900, squealTime);
      oscSqueal.frequency.exponentialRampToValueAtTime(2400, squealTime + 0.6);
      oscSqueal.frequency.setValueAtTime(1800, squealTime + 0.9);
      oscSqueal.frequency.exponentialRampToValueAtTime(3200, squealTime + 1.8);

      squealGain.gain.setValueAtTime(0.08, squealTime);
      squealGain.gain.setValueAtTime(0.08, squealTime + 1.8);
      squealGain.gain.exponentialRampToValueAtTime(0.001, squealTime + 2.0);

      oscSqueal.connect(squealGain);
      squealGain.connect(this.sfxGain!);
      oscSqueal.start(squealTime);
      oscSqueal.stop(squealTime + 2.0);
      soundNodes.push(oscSqueal, squealGain);

      // Stage 9 & 10: Carrier Drop & Connection Success Chime
      const connectTime = noiseTime + noiseDuration + 0.1;
      const oscChime1 = ctx.createOscillator();
      const oscChime2 = ctx.createOscillator();
      const chimeGain = ctx.createGain();

      oscChime1.frequency.setValueAtTime(587.33, connectTime); // D5
      oscChime2.frequency.setValueAtTime(880.0, connectTime + 0.15); // A5
      chimeGain.gain.setValueAtTime(0.2, connectTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, connectTime + 0.8);

      oscChime1.connect(chimeGain);
      oscChime2.connect(chimeGain);
      chimeGain.connect(this.sfxGain!);

      oscChime1.start(connectTime);
      oscChime1.stop(connectTime + 0.8);
      oscChime2.start(connectTime + 0.15);
      oscChime2.stop(connectTime + 0.8);
      soundNodes.push(oscChime1, oscChime2, chimeGain);

      const totalDurationMs = (connectTime + 0.8 - ctx.currentTime) * 1000;
      const timeoutId = setTimeout(() => {
        onComplete?.();
      }, Math.max(0, totalDurationMs));

      const cancel = () => {
        clearTimeout(timeoutId);
        soundNodes.forEach((node) => {
          if ('stop' in node && typeof node.stop === 'function') {
            try {
              node.stop();
            } catch {}
          }
          if ('disconnect' in node && typeof node.disconnect === 'function') {
            try {
              node.disconnect();
            } catch {}
          }
        });
      };

      this.activeHandshakeNodes = { stop: cancel };
      return { cancel };
    } catch {
      onComplete?.();
      return { cancel: () => {} };
    }
  }

  // =========================================================
  // 2. Retro UI & Interaction Sound Effects
  // =========================================================

  /** Classic UI Click (15ms square pulse) */
  public playClick(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.015);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
    } catch {}
  }

  /** Window Open / Restore Chirp */
  public playWindowOpen(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }

  /** Window Minimize Chirp */
  public playWindowMinimize(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {}
  }

  /** Classic Error "Donk" Chord */
  public playErrorBeep(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.value = 440;
      osc2.frequency.value = 554.37;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.18);
      osc2.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  /** IM Receive Chime (G5 -> C6) */
  public playImReceive(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.value = 783.99;
      gain1.gain.setValueAtTime(0.18, t0);
      gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

      osc2.type = 'sine';
      osc2.frequency.value = 1046.5;
      gain2.gain.setValueAtTime(0.22, t0 + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(this.sfxGain!);
      gain2.connect(this.sfxGain!);

      osc1.start(t0);
      osc1.stop(t0 + 0.35);
      osc2.start(t0 + 0.12);
      osc2.stop(t0 + 0.55);
    } catch {}
  }

  /** Yahoo-style Buzz / Nudge: three urgent square pulses */
  public playBuzz(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      [0, 0.13, 0.26].forEach((offset, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = index === 1 ? 920 : 720;
        gain.gain.setValueAtTime(0.13, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.08);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.08);
      });
    } catch {}
  }

  /** Yahoo-style room invitation: two-note ascending notification */
  public playInvite(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const notes = [659.25, 987.77];
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t0 + index * 0.12;
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch {}
  }

  /** IM Send Chime (E5 -> G5) */
  public playImSend(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t0);
      osc.frequency.exponentialRampToValueAtTime(783.99, t0 + 0.08);
      gain.gain.setValueAtTime(0.14, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    } catch {}
  }

  /** Door Open (Pulse buddy sign-in) */
  public playDoorOpen(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.linearRampToValueAtTime(260, t0 + 0.2);
      gain.gain.setValueAtTime(0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    } catch {}
  }

  /** Door Slam (Pulse buddy sign-off) */
  public playDoorSlam(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(85, t0);
      osc.frequency.exponentialRampToValueAtTime(25, t0 + 0.18);
      gain.gain.setValueAtTime(0.3, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    } catch {}
  }

  /** Hard Drive Read/Write Head Chatter */
  public playHddChirp(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const pulses = 3;
      for (let i = 0; i < pulses; i++) {
        const pTime = t0 + i * 0.035;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 2400 + Math.random() * 800;
        gain.gain.setValueAtTime(0.04, pTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pTime + 0.01);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(pTime);
        osc.stop(pTime + 0.01);
      }
    } catch {}
  }

  /** BIOS POST Beep (Hardware motherboard speaker) */
  public playBiosBeep(): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, t0); // 880 Hz standard IBM/PC POST beep
      gain.gain.setValueAtTime(0.15, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + 0.12);
    } catch {}
  }

  /** Optical CD-ROM Drive Spindle Acceleration & Laser Track Seek */
  public playCdRomSpin(durationMs = 1200): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const durSec = durationMs / 1000;

      // Spindle motor whine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t0);
      osc.frequency.exponentialRampToValueAtTime(750, t0 + durSec * 0.7);
      osc.frequency.linearRampToValueAtTime(600, t0 + durSec);

      gain.gain.setValueAtTime(0.01, t0);
      gain.gain.linearRampToValueAtTime(0.06, t0 + durSec * 0.3);
      gain.gain.setValueAtTime(0.06, t0 + durSec * 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + durSec);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t0);
      osc.stop(t0 + durSec);

      // Laser stepping chirp halfway through
      const laserTime = t0 + durSec * 0.45;
      const laserOsc = ctx.createOscillator();
      const laserGain = ctx.createGain();
      laserOsc.type = 'sawtooth';
      laserOsc.frequency.setValueAtTime(1200, laserTime);
      laserOsc.frequency.linearRampToValueAtTime(3200, laserTime + 0.05);
      laserGain.gain.setValueAtTime(0.05, laserTime);
      laserGain.gain.exponentialRampToValueAtTime(0.001, laserTime + 0.06);
      laserOsc.connect(laserGain);
      laserGain.connect(this.sfxGain!);
      laserOsc.start(laserTime);
      laserOsc.stop(laserTime + 0.06);
    } catch {}
  }

  /** Sustained Hard Drive Read/Write Activity (Cluster seeks) */
  public playDriveSeek(durationMs = 800): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const bursts = Math.min(16, Math.max(3, Math.floor(durationMs / 60)));
      for (let i = 0; i < bursts; i++) {
        const pTime = t0 + (i * (durationMs / bursts) + (Math.random() * 20 - 10)) / 1000;
        if (pTime < t0) continue;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1800 + Math.random() * 1200;
        gain.gain.setValueAtTime(0.035, pTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pTime + 0.015);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(pTime);
        osc.stop(pTime + 0.015);
      }
    } catch {}
  }

  /** Window motion audio per generation */
  public playWindowSound(action: 'minimize' | 'restore' | 'open' | 'close', osVersion?: string): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const isOrion48 = !osVersion || osVersion.includes('4.8');
      const isOrion50 = osVersion?.includes('5.0');
      const isOrion60 = osVersion?.includes('6.');
      const isOrion70 = osVersion?.includes('7.');

      if (isOrion48) {
        // 4.8 Harbor: Snappy 8-bit mechanical sweep
        osc.type = 'square';
        const startFreq = action === 'minimize' || action === 'close' ? 900 : 450;
        const endFreq = action === 'minimize' || action === 'close' ? 300 : 1100;
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.04);
        gain.gain.setValueAtTime(0.07, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t0);
        osc.stop(t0 + 0.04);
      } else if (isOrion50) {
        // 5.0 Aurora: Gentle melodic whoosh
        osc.type = 'sine';
        const startFreq = action === 'minimize' || action === 'close' ? 650 : 350;
        const endFreq = action === 'minimize' || action === 'close' ? 220 : 800;
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.08);
        gain.gain.setValueAtTime(0.08, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t0);
        osc.stop(t0 + 0.08);
      } else if (isOrion60) {
        // 6.0 Glassline: Fluid dual-harmonic slide
        osc.type = 'triangle';
        const startFreq = action === 'minimize' || action === 'close' ? 880 : 440;
        const endFreq = action === 'minimize' || action === 'close' ? 330 : 990;
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.12);
        gain.gain.setValueAtTime(0.06, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t0);
        osc.stop(t0 + 0.12);
      } else if (isOrion70) {
        // 7.0 Lumen: Subtle ambient breath
        osc.type = 'sine';
        osc.frequency.setValueAtTime(action === 'minimize' ? 420 : 540, t0);
        osc.frequency.linearRampToValueAtTime(action === 'minimize' ? 280 : 720, t0 + 0.14);
        gain.gain.setValueAtTime(0.04, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(t0);
        osc.stop(t0 + 0.15);
      }
    } catch {}
  }

  /** Generation-specific authentic retro startup chimes */
  public playStartupChime(osVersion: string): void {
    const ctx = this.getContext();
    if (!ctx || this.isMuted) return;
    try {
      const t0 = ctx.currentTime + 0.05;

      if (osVersion.includes('4.8')) {
        // Orion 4.8 Harbor: Classic 90s ascending square-wave arpeggio (C4-E4-G4-C5)
        const notes = [261.63, 329.63, 392.0, 523.25];
        notes.forEach((freq, idx) => {
          const noteTime = t0 + idx * 0.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, noteTime);
          gain.gain.setValueAtTime(0.09, noteTime);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + (idx === 3 ? 0.6 : 0.14));
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(noteTime);
          osc.stop(noteTime + (idx === 3 ? 0.6 : 0.14));
        });
      } else if (osVersion.includes('5.0')) {
        // Orion 5.0 Aurora: Warm dual-tone melodic bell (D4 -> A4 -> F#5 resonant chime)
        const chords = [
          { time: t0, freqs: [293.66, 440.0], dur: 0.35, gain: 0.11 },
          { time: t0 + 0.28, freqs: [369.99, 739.99], dur: 0.85, gain: 0.14 },
        ];
        chords.forEach((chord) => {
          chord.freqs.forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, chord.time);
            gain.gain.setValueAtTime(chord.gain, chord.time);
            gain.gain.exponentialRampToValueAtTime(0.001, chord.time + chord.dur);
            osc.connect(gain);
            gain.connect(this.sfxGain!);
            osc.start(chord.time);
            osc.stop(chord.time + chord.dur);
          });
        });
      } else if (osVersion.includes('6.')) {
        // Orion 6.0 Glassline: Lush 4-voice harmonic chord with warmth
        const freqs = [277.18, 415.3, 659.25, 987.77]; // C#4, G#4, E5, B5
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t0 + idx * 0.04);
          gain.gain.setValueAtTime(0.08, t0 + idx * 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(t0 + idx * 0.04);
          osc.stop(t0 + 1.2);
        });
      } else if (osVersion.includes('7.')) {
        // Orion 7.0 Lumen: Ethereal mineral crystalline chord
        const freqs = [369.99, 554.37, 830.61, 1244.5]; // F#4, C#5, G#5, D#6
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0 + idx * 0.06);
          gain.gain.setValueAtTime(0.07, t0 + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
          osc.connect(gain);
          gain.connect(this.sfxGain!);
          osc.start(t0 + idx * 0.06);
          osc.stop(t0 + 1.8);
        });
      }
    } catch {}
  }
}

export const synthAudio = new SynthAudio();

