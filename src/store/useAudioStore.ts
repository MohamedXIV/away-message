import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { soundManager, SoundSettings } from '../audio/SoundManager';

export type SoundEffectName =
  | 'click'
  | 'window_open'
  | 'window_minimize'
  | 'error'
  | 'im_recv'
  | 'im_send'
  | 'door_open'
  | 'door_slam'
  | 'hdd_chirp';

export interface AudioStoreState {
  masterVolume: number;
  volume: number; // Convenience alias for masterVolume
  sfxVolume: number;
  ambienceVolume: number;
  musicVolume: number;
  isMuted: boolean;
  soundEnabled: boolean; // Convenience alias for !isMuted
  isDialupPlaying: boolean;
  isAudioUnlocked: boolean;
}

export interface AudioStoreActions {
  unlockAudio: () => void;
  playSound: (name: SoundEffectName) => void;
  startDialupHandshake: (onComplete?: () => void) => () => void;
  stopDialup: () => void;
  setMasterVolume: (vol: number) => void;
  setVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setAmbienceVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;
  setMute: (muted: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleMute: () => void;
}

export type AudioStore = AudioStoreState & AudioStoreActions;

let activeDialupCancel: (() => void) | null = null;

export const useAudioStore = create<AudioStore>()(
  subscribeWithSelector((set, get) => {
    const initialSettings: SoundSettings = soundManager.getSettings();

    return {
      masterVolume: initialSettings.masterVolume,
      volume: initialSettings.masterVolume,
      sfxVolume: initialSettings.sfxVolume,
      ambienceVolume: initialSettings.ambienceVolume,
      musicVolume: initialSettings.musicVolume,
      isMuted: initialSettings.isMuted,
      soundEnabled: !initialSettings.isMuted,
      isDialupPlaying: false,
      isAudioUnlocked: false,

      unlockAudio: () => {
        soundManager.unlockAudio();
        set({ isAudioUnlocked: true });
      },

      playSound: (name: SoundEffectName) => {
        soundManager.play(name);
      },

      startDialupHandshake: (onComplete?: () => void) => {
        if (activeDialupCancel) {
          activeDialupCancel();
          activeDialupCancel = null;
        }

        set({ isDialupPlaying: true });

        const handle = soundManager.playDialup(() => {
          set({ isDialupPlaying: false });
          activeDialupCancel = null;
          if (onComplete) onComplete();
        });

        activeDialupCancel = handle.cancel;

        return () => {
          handle.cancel();
          set({ isDialupPlaying: false });
          activeDialupCancel = null;
        };
      },

      stopDialup: () => {
        if (activeDialupCancel) {
          activeDialupCancel();
          activeDialupCancel = null;
        }
        set({ isDialupPlaying: false });
      },

      setMasterVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        soundManager.setMasterVolume(clamped);
        set({ masterVolume: clamped, volume: clamped });
      },

      setVolume: (vol: number) => {
        get().setMasterVolume(vol);
      },

      setSfxVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ sfxVolume: clamped });
      },

      setAmbienceVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ ambienceVolume: clamped });
      },

      setMusicVolume: (vol: number) => {
        const clamped = Math.max(0, Math.min(1, vol));
        set({ musicVolume: clamped });
      },

      setMute: (muted: boolean) => {
        soundManager.setMute(muted);
        set({ isMuted: muted, soundEnabled: !muted });
      },

      setSoundEnabled: (enabled: boolean) => {
        get().setMute(!enabled);
      },

      toggleMute: () => {
        const newMuted = !get().isMuted;
        get().setMute(newMuted);
      },
    };
  })
);
