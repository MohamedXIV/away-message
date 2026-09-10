import type { ContentTables } from './codegen';
import { generateRegistrySource, validateContent } from './codegen';
import { validateWorldContent } from './world';
import { generateWorldRegistrySource } from './worldCodegen';

export interface ContentArtifacts {
  errors: string[];
  coreSource: string;
  worldSource: string;
}

/** One validation/codegen boundary for every authored content artifact. */
export function buildContentArtifacts(tables: ContentTables): ContentArtifacts {
  const errors = [...validateContent(tables), ...validateWorldContent(tables)];
  if (errors.length > 0) {
    return { errors, coreSource: '', worldSource: '' };
  }
  return {
    errors: [],
    coreSource: generateRegistrySource(tables),
    worldSource: generateWorldRegistrySource(tables),
  };
}
