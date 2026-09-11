#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const REQUIRED_EXPORTS = [
  'in_init',
  'in_puppet_load_from_memory',
  'in_puppet_free',
  'in_puppet_get_parameters',
  'in_puppet_get_root_node',
  'in_parameter_get_name',
  'in_parameter_get_value',
  'in_parameter_set_value',
  'in_drawlist_get_commands',
  'in_drawlist_get_vertex_data',
  'in_drawlist_get_index_data',
];

const wasmPath = process.argv[2];
if (!wasmPath) {
  console.error('Usage: node scripts/verify-inochi-wasm-exports.mjs <path/to/inochi2d.wasm>');
  process.exit(2);
}

const bytes = await readFile(wasmPath);
const module = await WebAssembly.compile(bytes);
const exportedNames = new Set(WebAssembly.Module.exports(module).map(({ name }) => name));
const missing = REQUIRED_EXPORTS.filter((name) => !exportedNames.has(name));

if (missing.length > 0) {
  console.error(`Missing required Inochi2D WASM exports: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(JSON.stringify({
  wasmBytes: bytes.byteLength,
  exportCount: exportedNames.size,
  requiredExports: REQUIRED_EXPORTS,
}, null, 2));
