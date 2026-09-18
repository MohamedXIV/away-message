// src/tools/content/codegen.ts
// Content compiler facade: parse/validate/generate orchestration only.
// Domain validation and deterministic emitters live in focused modules.

import type { ContentTables } from './shared';
import { validateCharacterContent } from './validators/characters';
import { validatePhysicalGraph } from './validators/physical';
import {
  validateEventModifiers,
  validateWorldAnchors,
  validateWorldAssets,
  validateWorldContent,
  validateWorldItems,
  validateWorldProfiles,
  validateWorldSpaces,
} from './validators/world';

export type { ContentTables } from './shared';
export { validateCharacterId, validateWorldId, parseContentJson, contentHash } from './shared';
export {
  validateEventModifiers,
  validateWorldAnchors,
  validateWorldAssets,
  validateWorldContent,
  validateWorldItems,
  validateWorldProfiles,
  validateWorldSpaces,
} from './validators/world';
export { generateRegistrySource } from './generators/characters';
export { generateWorldRegistrySource } from './generators/world';
export { validatePhysicalGraph } from './validators/physical';

/** Semantic validation against engine rules. Returns error list (empty = valid). */
export function validateContent(tables: ContentTables): string[] {
  return [
    ...validateCharacterContent(tables),
    ...validateWorldContent(tables),
    ...validateWorldItems(tables),
    ...validateWorldSpaces(tables),
    ...validateWorldAnchors(tables),
    ...validateWorldAssets(tables),
    ...validateWorldProfiles(tables),
    ...validateEventModifiers(tables),
    ...validatePhysicalGraph(tables),
  ];
}
