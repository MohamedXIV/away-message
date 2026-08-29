import { describe, expect, it } from 'vitest';
import { generateFindItCandidates } from '../../src/internet/searchIndex';
import { getSiteArchetype } from '../../src/ai/siteArchetypes';

describe('FindIt generated discovery', () => {
  it('creates deterministic local candidates from a search phrase', () => {
    const results = generateFindItCandidates('late night synth music');

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.isGenerated)).toBe(true);
    expect(results[0]?.url).toBe('http://late-night-synth-music.local/');
    expect(results[1]?.url).toBe('http://late-night-synth-music-directory.local/');
    expect(results[0]?.snippet).toContain('Click to let Voyager generate the site');
  });

  it('selects multiple deterministic archetypes across generated hosts', () => {
    const archetypes = new Set([
      'alpha.local',
      'beta.local',
      'gamma.local',
      'delta.local',
      'epsilon.local',
      'zeta.local',
      'eta.local',
      'theta.local',
    ].map((host) => getSiteArchetype(host).id));

    expect(archetypes.size).toBeGreaterThanOrEqual(3);
  });

  it('does not create a result for an empty query', () => {
    expect(generateFindItCandidates('   ')).toEqual([]);
  });
});
