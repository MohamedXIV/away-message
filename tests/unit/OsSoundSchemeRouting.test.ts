import { describe, expect, it } from 'vitest';
import { resolveWindowSoundProfile } from '../../src/desktop/host/OsSoundScheme';
import { getOsPresentationProfile } from '../../src/desktop/host/OsPresentation';
import type { OsVersion } from '../../src/engine/types';

const CANONICAL_RELEASES: OsVersion[] = [
  'Orion_4.8',
  'Orion_5.0',
  'Orion_6.0',
  'Orion_7.0',
];

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
});
