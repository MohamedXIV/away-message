import { describe, expect, it } from 'vitest';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

describe('world projection ownership', () => {
  it('rejects a view that does not belong to the requested place', () => {
    expect(() =>
      createWorldSceneProjection({
        placeId: 'place_b1',
        viewId: 'view_a1',
      })
    ).toThrow(/view_a1.*place_b1|place_b1.*view_a1/i);
  });
});
