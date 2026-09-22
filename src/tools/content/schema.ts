// src/tools/content/schema.ts
// TinyBase schema derived from the canonical Zod authored-content row schemas.
// The game does not read this authoring store as runtime simulation truth.

import { createStore } from 'tinybase';
import { createZodSchematizer } from 'tinybase/schematizers/schematizer-zod';
import { CONTENT_ROW_SCHEMAS } from './contentSchemas';

const schematizer = createZodSchematizer();

export const CONTENT_SCHEMA = schematizer.toTablesSchema(CONTENT_ROW_SCHEMAS);

export type ContentStore = ReturnType<typeof createContentStore>;

/** Empty schema-valid store (callers hydrate from content/store.json or generated code). */
export function createContentStore() {
  return createStore().setTablesSchema(CONTENT_SCHEMA);
}
