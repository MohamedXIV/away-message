import { describe, expect, it } from 'vitest';
import { CONTENT_ROW_SCHEMAS } from '../../src/tools/content/contentSchemas';
import { CONTENT_SCHEMA, createContentStore } from '../../src/tools/content/schema';

describe('content schema source of truth (#100)', () => {
  it('derives the TinyBase schema from one Zod row-schema catalog', () => {
    expect(Object.keys(CONTENT_ROW_SCHEMAS).sort()).toEqual(Object.keys(CONTENT_SCHEMA).sort());

    const store = createContentStore();
    expect(() =>
      store.setRow('places', 'place_test', {
        districtId: 'district_test',
        name: 'Test Place',
        transitAccess: [],
        legacyIds: [],
      }),
    ).not.toThrow();

    expect(store.getRow('places', 'place_test')).toEqual({
      districtId: 'district_test',
      name: 'Test Place',
      transitAccess: [],
      legacyIds: [],
    });
  });

  it('preserves current defaults while Phase B migration is staged', () => {
    const store = createContentStore();
    store.setRow('characters', 'actor_test', {
      role: 'test_role',
      displayName: 'Test Actor',
    });

    expect(store.getCell('characters', 'actor_test', 'roles')).toEqual([]);
    expect(store.getCell('characters', 'actor_test', 'reach')).toBe('local');
    expect(store.getCell('characters', 'actor_test', 'languages')).toEqual([{ lang: 'en', level: 5 }]);
  });
});
