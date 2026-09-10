import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseContentJson } from '../../src/tools/content/codegen';
import { generateWorldRegistrySource } from '../../src/tools/content/worldCodegen';

function loadStore() {
  return parseContentJson(readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8'));
}

describe('generated world content registry', () => {
  it('stays in sync with the authored TinyBase source', () => {
    const committed = readFileSync(new URL('../../src/engine/worldContent.generated.ts', import.meta.url), 'utf8');
    expect(generateWorldRegistrySource(loadStore())).toBe(committed);
  });
});
