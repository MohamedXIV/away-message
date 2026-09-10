// tools/pull-content.ts — content/store.json → generated registries:
//   src/engine/coreBuddies.generated.ts (characters) + src/engine/worldContent.generated.ts (town)
// Run: npm run content:pull | Verify: npm run content:check
// Validation failures exit non-zero with every error listed (fail loudly).

import { readFileSync, writeFileSync } from 'node:fs';
import type { Tables } from 'tinybase';
import { createContentStore } from '../src/tools/content/schema';
import { parseContentJson, validateContent, generateRegistrySource, generateWorldRegistrySource } from '../src/tools/content/codegen';

const root = new URL('..', import.meta.url);
const storePath = new URL('content/store.json', root);
const outPath = new URL('src/engine/coreBuddies.generated.ts', root);
const outWorldPath = new URL('src/engine/worldContent.generated.ts', root);

const raw = readFileSync(storePath, 'utf8');
const tables = parseContentJson(raw);

// Schema-level load first (TinyBase enforces cell types on the way in).
const store = createContentStore();
try {
  store.setTables(tables as unknown as Tables);
} catch (err) {
  console.error(`content/store.json failed schema load: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// Semantic validation against engine rules (rich error list).
const errors = validateContent(tables);
if (errors.length > 0) {
  console.error(`content/store.json invalid (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const source = generateRegistrySource(tables);
const worldSource = generateWorldRegistrySource(tables);
if (process.argv.includes('--check')) {
  let current = '';
  let currentWorld = '';
  try {
    current = readFileSync(outPath, 'utf8');
    currentWorld = readFileSync(outWorldPath, 'utf8');
  } catch {
    console.error('content:check failed — generated file missing. Run npm run content:pull.');
    process.exit(1);
  }
  if (current !== source) {
    console.error('content:check failed — src/engine/coreBuddies.generated.ts is stale. Run npm run content:pull.');
    process.exit(1);
  }
  if (currentWorld !== worldSource) {
    console.error('content:check failed — src/engine/worldContent.generated.ts is stale. Run npm run content:pull.');
    process.exit(1);
  }
  console.log('content:check ok — generated registries match content/store.json.');
} else {
  writeFileSync(outPath, source);
  writeFileSync(outWorldPath, worldSource);
  const ids = Object.keys(tables['characters'] ?? {}).length;
  const pools = Object.keys(tables['dialoguePools'] ?? {}).length;
  const districts = Object.keys(tables['districts'] ?? {}).length;
  const places = Object.keys(tables['places'] ?? {}).length;
  const stops = Object.keys(tables['transitStops'] ?? {}).length;
  const lines = Object.keys(tables['busLines'] ?? {}).length;
  console.log(`content:pull ok — ${ids} characters, ${pools} dialogue pools → src/engine/coreBuddies.generated.ts`);
  console.log(`content:pull ok — ${districts} districts, ${places} places, ${stops} stops, ${lines} bus lines → src/engine/worldContent.generated.ts`);
}
