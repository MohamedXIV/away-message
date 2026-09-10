import { describe, expect, it } from 'vitest';
import { CONTENT_SCHEMA } from '../../src/tools/content/schema';

describe('World content item/container schema (#51)', () => {
  it('declares authored item definitions', () => {
    expect(CONTENT_SCHEMA).toHaveProperty('items');
    const items = (CONTENT_SCHEMA as Record<string, Record<string, unknown>>)['items'];
    expect(items).toEqual(expect.objectContaining({
      name: expect.any(Object),
      kind: expect.any(Object),
      portable: expect.any(Object),
      volume: expect.any(Object),
      tags: expect.any(Object),
    }));
  });

  it('declares authored container definitions', () => {
    expect(CONTENT_SCHEMA).toHaveProperty('containers');
    const containers = (CONTENT_SCHEMA as Record<string, Record<string, unknown>>)['containers'];
    expect(containers).toEqual(expect.objectContaining({
      name: expect.any(Object),
      capacity: expect.any(Object),
      allowedItemKinds: expect.any(Object),
      tags: expect.any(Object),
    }));
  });
});
