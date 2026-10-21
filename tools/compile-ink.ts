import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { SimpleJson } from 'inkjs/engine/SimpleJson';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_ROOT = join(ROOT, 'src', 'narrative', 'ink');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ink')) out.push(full);
  }
  return out;
}

let failures = 0;
const files = walk(SRC_ROOT);
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const compiler = new Compiler(source);
  let story: any;
  try {
    story = compiler.Compile();
  } catch (e) {
    console.error(`[compile-ink] ${relative(ROOT, file)}: ${(e as Error).message}`);
    failures++;
    continue;
  }
  if (compiler.errors && compiler.errors.length > 0) {
    console.error(`[compile-ink] ${relative(ROOT, file)}:`);
    for (const err of compiler.errors) console.error('  ' + err);
    failures++;
    continue;
  }
  const writer = new SimpleJson.Writer();
  story.ToJson(writer);
  const outPath = file + '.json';
  writeFileSync(outPath, writer.toString() + '\n');
  console.log(`[compile-ink] wrote ${relative(ROOT, outPath)} (${compiler.warnings.length} warnings)`);
  for (const w of compiler.warnings) console.warn('  ' + w);
}

if (failures > 0) {
  console.error(`[compile-ink] ${failures} file(s) failed.`);
  process.exit(1);
}
console.log(`[compile-ink] done: ${files.length} file(s).`);
