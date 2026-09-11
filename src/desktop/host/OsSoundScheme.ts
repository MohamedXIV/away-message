import type { OsPresentationProfile } from './OsPresentation';

export type OsSoundSchemeId = OsPresentationProfile['soundSchemeId'];
export type OsWindowSoundAction = 'minimize' | 'restore' | 'open' | 'close';

export interface WindowSoundProfile {
  schemeId: OsSoundSchemeId;
  waveform: OscillatorType;
  durationSeconds: number;
  gain: number;
  openingStartFrequencyHz: number;
  openingEndFrequencyHz: number;
  closingStartFrequencyHz: number;
  closingEndFrequencyHz: number;
}

const WINDOW_SOUND_PROFILES: Record<OsSoundSchemeId, WindowSoundProfile> = {
  orion48: {
    schemeId: 'orion48',
    waveform: 'square',
    durationSeconds: 0.04,
    gain: 0.07,
    openingStartFrequencyHz: 450,
    openingEndFrequencyHz: 1100,
    closingStartFrequencyHz: 900,
    closingEndFrequencyHz: 300,
  },
  orion50: {
    schemeId: 'orion50',
    waveform: 'sine',
    durationSeconds: 0.08,
    gain: 0.08,
    openingStartFrequencyHz: 350,
    openingEndFrequencyHz: 800,
    closingStartFrequencyHz: 650,
    closingEndFrequencyHz: 220,
  },
  orion60: {
    schemeId: 'orion60',
    waveform: 'triangle',
    durationSeconds: 0.12,
    gain: 0.06,
    openingStartFrequencyHz: 440,
    openingEndFrequencyHz: 990,
    closingStartFrequencyHz: 880,
    closingEndFrequencyHz: 330,
  },
  orion70: {
    schemeId: 'orion70',
    waveform: 'sine',
    durationSeconds: 0.15,
    gain: 0.04,
    openingStartFrequencyHz: 540,
    openingEndFrequencyHz: 720,
    closingStartFrequencyHz: 420,
    closingEndFrequencyHz: 280,
  },
};

export interface ResolvedWindowSoundProfile extends WindowSoundProfile {
  action: OsWindowSoundAction;
  startFrequencyHz: number;
  endFrequencyHz: number;
}

export function resolveWindowSoundProfile(
  schemeId: OsSoundSchemeId,
  action: OsWindowSoundAction,
): ResolvedWindowSoundProfile {
  const profile = WINDOW_SOUND_PROFILES[schemeId];
  const closing = action === 'minimize' || action === 'close';
  return {
    ...profile,
    action,
    startFrequencyHz: closing
      ? profile.closingStartFrequencyHz
      : profile.openingStartFrequencyHz,
    endFrequencyHz: closing
      ? profile.closingEndFrequencyHz
      : profile.openingEndFrequencyHz,
  };
}
