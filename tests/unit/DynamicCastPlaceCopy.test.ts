import { describe, expect, it } from 'vitest';
import { DOOR_OPTIONS } from '../../src/world/data/roomInteractables';
import { CITY_NODES } from '../../src/engine/CityMap';
import { GIGS } from '../../src/engine/JobDirector';

/** #213: place/activity copy must never invent a guaranteed core cast. */
describe('#213 dynamic-cast place copy', () => {
  it('keeps ordinary town locations and activities free of protected fixture characters', () => {
    const copy = [
      ...DOOR_OPTIONS.map(option => option.title + ' ' + option.description),
      ...Object.values(CITY_NODES).map(node => node.name + ' ' + node.blurb + ' ' + node.hint),
      ...Object.values(GIGS).map(gig => gig.title + ' ' + gig.blurb),
    ];
    for (const text of copy) {
      expect(text).not.toMatch(/\b(?:Maya|Ryan|Nora|Henderson)\b/i);
    }
  });
});
