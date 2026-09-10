import { describe, expect, it } from 'vitest';
import {
  buildDistrictRow,
  buildPlaceRow,
  normalizeWorldContentId,
} from '../../src/tools/studio/worldAuthoring';

describe('Content Studio world basics authoring', () => {
  it('normalizes stable authoring ids without inventing a parallel schema', () => {
    expect(normalizeWorldContentId('  Riverside Cafe!  ')).toBe('riverside_cafe');
    expect(normalizeWorldContentId('___')).toBe('');
  });

  it('creates district rows in the canonical TinyBase shape', () => {
    expect(buildDistrictRow('Riverside')).toEqual({
      name: 'Riverside',
      mapX: 50,
      mapY: 50,
      tags: '[]',
    });
  });

  it('creates a place only against an existing district', () => {
    expect(buildPlaceRow('Corner Cafe', 'district_a', ['district_a', 'district_b'])).toEqual({
      districtId: 'district_a',
      name: 'Corner Cafe',
      transitAccess: '[]',
    });

    expect(() => buildPlaceRow('Lost Cafe', 'missing', ['district_a'])).toThrow(
      "Unknown district 'missing'",
    );
  });
});
