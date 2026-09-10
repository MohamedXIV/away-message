// tools/pull-content.ts — content/store.json → generated runtime registries
// Run: npm run content:pull | Verify: npm run content:check
// Validation failures exit non-zero with every error listed (fail loudly).

import { readFileSync, writeFileSync } from 'node:fs';
import type { Tables } from 'tinybase';
import { createContentStore } from '../src/tools/content/schema';
import { parseContentJson } from '../src/tools/content/codegen';
import { buildContentArtifacts } from '../src/tools/content/pipeline';

const root = new URL('..', import.meta.url);
const storePath = new URL('content/store.json', root);
const coreOutPath = new URL('src/engine/coreBuddies.generated.ts', root);
const worldOutPath = new URL('src/engine/worldContent.generated.ts', root);

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

const artifacts = buildContentArtifacts(tables);
if (artifacts.errors.length > 0) {
  console.error(`content/store.json invalid (${artifacts.errors.length}):`);
  for (const error of artifacts.errors) console.error(`  - ${error}`);
  process.exit(1);
}

function readGenerated(path: URL, label: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.error(`content:check failed — ${label} missing. Run npm run content:pull.`);
    process.exit(1);
  }
}

if (process.argv.includes('--check')) {
  const currentCore = readGenerated(coreOutPath, 'src/engine/coreBuddies.generated.ts');
  const currentWorld = readGenerated(worldOutPath, 'src/engine/worldContent.generated.ts');
  const stale: string[] = [];
  if (currentCore !== artifacts.coreSource) stale.push('src/engine/coreBuddies.generated.ts');
  if (currentWorld !== artifacts.worldSource) stale.push('src/engine/worldContent.generated.ts');
  if (stale.length > 0) {
    console.error(`content:check failed — stale generated file(s): ${stale.join(', ')}. Run npm run content:pull.`);
    process.exit(1);
  }
  console.log('content:check ok — generated registries match content/store.json.');
} else {
  writeFileSync(coreOutPath, artifacts.coreSource);
  writeFileSync(worldOutPath, artifacts.worldSource);
  const ids = Object.keys(tables['characters'] ?? {}).length;
  const districts = Object.keys(tables['districtDefinitions'] ?? {}).length;
  const places = Object.keys(tables['placeDefinitions'] ?? {}).length;
  console.log(`content:pull ok — ${ids} characters, ${districts} districts, ${places} places → generated runtime registries`);
}
