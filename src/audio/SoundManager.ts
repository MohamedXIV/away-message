import { synthAudio, SynthAudio } from './SynthAudio';

export interface SoundSettings {
  masterVolume: number;   // 0.0 .. 1.0
  sfxVolume: number;      // 0.0 .. 1.0
  ambienceVolume: number; // 0.0 .. 1.0
  musicVolume: number;    // 0.0 .. 1.0
  isMuted: boolean;
}

const STORAGE_KEY = 'away_message_sound_settings';

export class SoundManager {
  private synth: SynthAudio;
  private settings: SoundSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    ambienceVolume: 0.7,
    musicVolume: 0.8,
    isMuted: false,
  };
  private isUnlocked = false;

  constructor(synth: SynthAudio = synthAudio) {
    this.synth = synth;
    this.loadSettings();
  }

  /**
   * Unlocks Web Audio Context on first user gesture.
   */
  public unlockAudio(): void {
    if (this.isUnlocked) return;
    this.synth.init();
    const ctx = this.synth.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.isUnlocked = true;
        })
        .catch(() => {});
    } else {
      this.isUnlocked = true;
    }
  }

  public play(
    sound:
      | 'click'
      | 'window_open'
      | 'window_minimize'
      | 'error'
      | 'im_recv'
      | 'im_send'
      | 'door_open'
      | 'door_slam'
      | 'hdd_chirp'
      | 'buzz'
      | 'invite'
  ): void {
    this.unlockAudio();
    if (this.settings.isMuted) return;

    switch (sound) {
      case 'click':
        return this.synth.playClick();
      case 'window_open':
        return this.synth.playWindowOpen();
      case 'window_minimize':
        return this.synth.playWindowMinimize();
      case 'error':
        return this.synth.playErrorBeep();
      case 'im_recv':
        return this.synth.playImReceive();
      case 'im_send':
        return this.synth.playImSend();
      case 'door_open':
        return this.synth.playDoorOpen();
      case 'door_slam':
        return this.synth.playDoorSlam();
      case 'hdd_chirp':
        return this.synth.playHddChirp();
      case 'buzz':
        return this.synth.playBuzz();
      case 'invite':
        return this.synth.playInvite();
    }
  }

  public playDialup(onComplete?: () => void): { cancel: () => void } {
    this.unlockAudio();
    return this.synth.playDialupHandshake(onComplete);
  }

  public setMasterVolume(vol: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, vol));
    this.synth.setMasterVolume(this.settings.masterVolume);
    this.saveSettings();
  }

  public setMute(muted: boolean): void {
    this.settings.isMuted = muted;
    this.synth.setMute(muted);
    this.saveSettings();
  }

  public getSettings(): Readonly<SoundSettings> {
    return { ...this.settings };
  }

  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.settings = { ...this.settings, ...JSON.parse(stored) };
          this.synth.setMasterVolume(this.settings.masterVolume);
          this.synth.setMute(this.settings.isMuted);
        }
      }
    } catch {}
  }

  private saveSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {}
  }
}

export const soundManager = new SoundManager(synthAudio);
