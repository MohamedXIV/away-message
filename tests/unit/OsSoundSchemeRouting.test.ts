import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveWindowSoundProfile } from '../../src/desktop/host/OsSoundScheme';
import { getOsPresentationProfile } from '../../src/desktop/host/OsPresentation';
import type { OsVersion } from '../../src/engine/types';

const CANONICAL_RELEASES: OsVersion[] = [
  'Orion_4.8',
  'Orion_5.0',
  'Orion_6.0',
  'Orion_7.0',
];

const synthAudioSource = readFileSync(
  fileURLToPath(new URL('../../src/audio/SynthAudio.ts', import.meta.url)),
  'utf8',
);

const osSoundSchemeSource = readFileSync(
  fileURLToPath(new URL('../../src/desktop/host/OsSoundScheme.ts', import.meta.url)),
  'utf8',
);

describe('OS-owned sound scheme routing', () => {
  it('routes window sounds from the presentation sound scheme instead of Orion version strings', () => {
    const profiles = CANONICAL_RELEASES.map((osId) => {
      const presentation = getOsPresentationProfile(osId);
      return resolveWindowSoundProfile(presentation.soundSchemeId, 'open');
    });

    expect(profiles.map((profile) => profile.schemeId)).toEqual([
      'orion48',
      'orion50',
      'orion60',
      'orion70',
    ]);
    expect(new Set(profiles.map((profile) => `${profile.waveform}:${profile.durationSeconds}`)).size).toBe(4);
  });

  it('keeps close/minimize direction owned by the same scheme profile', () => {
    const presentation = getOsPresentationProfile('Orion_6.0');
    const opening = resolveWindowSoundProfile(presentation.soundSchemeId, 'open');
    const closing = resolveWindowSoundProfile(presentation.soundSchemeId, 'close');

    expect(opening.schemeId).toBe(closing.schemeId);
    expect(opening.endFrequencyHz).toBeGreaterThan(opening.startFrequencyHz);
    expect(closing.endFrequencyHz).toBeLessThan(closing.startFrequencyHz);
  });

  it('keeps SynthAudio and startup chimes scheme-owned with no legacy Orion-version adapter', () => {
    expect(synthAudioSource).not.toContain("osVersion.includes('4.8')");
    expect(synthAudioSource).not.toContain("osVersion.includes('5.0')");
    expect(synthAudioSource).not.toContain("osVersion.includes('6.')");
    expect(synthAudioSource).not.toContain("osVersion.includes('7.')");
    expect(synthAudioSource).not.toContain("osVersion?.includes('5.0')");
    expect(synthAudioSource).not.toContain("osVersion?.includes('6.')");
    expect(synthAudioSource).not.toContain("osVersion?.includes('7.')");
    expect(synthAudioSource).toContain('resolveWindowSoundProfile');
    expect(synthAudioSource).toContain('soundSchemeId');
    expect(osSoundSchemeSource).not.toContain('legacySynthVersionForSoundScheme');
  });
});
