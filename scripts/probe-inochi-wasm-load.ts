#!/usr/bin/env -S npx tsx
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  bootstrapInochiWebModule,
  type InochiWebBootstrapExports,
  type InochiWebScratchpad,
} from '../src/tooling/away-puppet/InochiWebModuleBootstrap';

const PINNED_UPSTREAM_COMMIT = 'ec702261dd6428141bfd0b174a015f8af872d3ed';
const PINNED_ARTIFACT_DIGEST = '59b0c88dafb93be310c2a0f965ab07f2a50fc675b241bb521065d64db648a178';
const PINNED_WASM_SHA256 = '49dd528af9e58341513f363ca5b0639da80a20f1c6f1a95f47c0c67da788dd0a';
const UPSTREAM_EMPTY08_SHA256 = 'b56a0377034fed6bf658820b1a009252605c1c47ffbb58168d011dc129d330fd';
const EMPTY08_LABEL = 'Inochi2D/inochi2d examples/empty08.inx';
const EMPTY08_BASE64 = `VFJOU1JUUwAAAAKmeyJtZXRhIjp7Im5hbWUiOiJUZXN0IFB1cHBldCIsInZl
cnNpb24iOiJ2MC44LjYiLCJyaWdnZXIiOiIiLCJhcnRpc3QiOiJJbm9jaGky
RCBQcm9qZWN0IiwicmlnaHRzIjpudWxsLCJjb3B5cmlnaHQiOiIiLCJsaWNl
bnNlVVJMIjoiIiwiY29udGFjdCI6IiIsInJlZmVyZW5jZSI6IiIsInRodW1i
bmFpbElkIjo0Mjk0OTY3Mjk1LCJwcmVzZXJ2ZVBpeGVscyI6ZmFsc2V9LCJw
aHlzaWNzIjp7InBpeGVsc1Blck1ldGVyIjoxMDAwLjAsImdyYXZpdHkiOjku
OH0sIm5vZGVzIjp7InV1aWQiOjM3NjA0Nzk3MjEsIm5hbWUiOiJSb290Iiwi
dHlwZSI6Ik5vZGUiLCJlbmFibGVkIjp0cnVlLCJ6c29ydCI6MC4wLCJ0cmFu
c2Zvcm0iOnsidHJhbnMiOlswLjAsMC4wLDAuMF0sInJvdCI6WzAuMCwwLjAs
MC4wXSwic2NhbGUiOlsxLjAsMS4wXX0sImxvY2tUb1Jvb3QiOmZhbHNlLCJj
aGlsZHJlbiI6W3sidXVpZCI6MTg3MjM3Mjk5LCJuYW1lIjoiTm9kZSIsInR5
cGUiOiJOb2RlIiwiZW5hYmxlZCI6dHJ1ZSwienNvcnQiOjAuMCwidHJhbnNm
b3JtIjp7InRyYW5zIjpbMC4wLDAuMCwwLjBdLCJyb3QiOlswLjAsMC4wLDAu
MF0sInNjYWxlIjpbMS4wLDEuMF19LCJsb2NrVG9Sb290IjpmYWxzZX1dfSwi
cGFyYW0iOm51bGwsImF1dG9tYXRpb24iOm51bGwsImFuaW1hdGlvbnMiOm51
bGwsImdyb3VwcyI6W119VEVYX1NFQ1QAAAAA`;

interface AllocatingWasmApi {
  nu_malloc(size: number): number | bigint;
}

interface LoadReadyWasmApi extends AllocatingWasmApi, InochiWebBootstrapExports {}

interface InochiWasmExports extends LoadReadyWasmApi {
  memory: WebAssembly.Memory;
  nu_free(ptr: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(ptr: number): void;
  in_puppet_get_name(ptr: number): number | bigint;
  in_puppet_get_author(ptr: number): number | bigint;
  in_puppet_get_parameters(ptr: number, countPtr: number): number | bigint;
  in_puppet_get_root_node(ptr: number): number | bigint;
  in_parameter_get_name(ptr: number): number | bigint;
  in_parameter_get_dimensions(ptr: number): number;
  in_parameter_get_lower_bounds(ptr: number): number | bigint;
  in_parameter_get_upper_bounds(ptr: number): number | bigint;
  in_parameter_get_value(ptr: number): number | bigint;
  in_parameter_set_value(ptr: number, valuesPtr: number): void;
  in_node_get_name(ptr: number): number | bigint;
  in_node_get_type(ptr: number): number | bigint;
  in_node_get_children(ptr: number, countPtr: number): number | bigint;
}

export interface BootstrappedPuppetInput {
  readonly sourcePointer: number;
  readonly scratchpad: InochiWebScratchpad;
}

export interface ProbeFixture {
  readonly path: string | undefined;
  readonly label: string;
}

export type ProbeMode = 'load' | 'inventory' | 'parameter-read' | 'mutation' | 'runtime';

interface InventoryProof {
  readonly name: string;
  readonly author: string;
  readonly parameterCount: number;
  readonly parameterNames: readonly string[];
  readonly nodeCount: number;
  readonly rootNode: string;
}

interface ParameterSample {
  readonly name: string;
  readonly dimensions: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
  readonly value: readonly number[];
}

interface ParameterReadProof extends InventoryProof {
  readonly samples: readonly ParameterSample[];
}

interface MutationProof extends ParameterReadProof {
  readonly mutatedParameters: readonly string[];
}

interface RuntimeProof extends MutationProof {
  readonly reloadMatched: boolean;
}

export function allocatePuppetInputOrThrow(api: AllocatingWasmApi, byteLength: number): number {
  const pointer = Number(api.nu_malloc(byteLength));
  if (!Number.isSafeInteger(pointer) || pointer <= 0) {
    throw new Error(
      `Inochi WASM allocator refused ${byteLength} bytes; refusing to write puppet input at address 0 or grow exported memory manually`,
    );
  }
  return pointer;
}

export function assertAcceptedWasmHash(actualHash: string, allowCandidate: boolean): void {
  if (!allowCandidate && actualHash !== PINNED_WASM_SHA256) {
    throw new Error(
      `unexpected wasm sha256 ${actualHash}; expected ${PINNED_WASM_SHA256} from ${PINNED_UPSTREAM_COMMIT}`,
    );
  }
}

export function resolveProbeFixture(args: readonly string[]): ProbeFixture {
  const fixtureFlagIndex = args.indexOf('--fixture');
  if (fixtureFlagIndex < 0) return { path: undefined, label: EMPTY08_LABEL };
  const fixturePath = args[fixtureFlagIndex + 1];
  if (!fixturePath || fixturePath.startsWith('--')) {
    throw new Error('--fixture requires a puppet file path');
  }
  return { path: fixturePath, label: fixturePath };
}

export function resolveProbeMode(args: readonly string[]): ProbeMode {
  if (args.includes('--runtime-proof')) return 'runtime';
  if (args.includes('--mutation-proof')) return 'mutation';
  if (args.includes('--inventory-proof')) return 'inventory';
  if (args.includes('--fixture')) return 'parameter-read';
  return 'load';
}

export function readWasmCString(memory: WebAssembly.Memory, pointer: number): string {
  if (!pointer) return '';
  const bytes = new Uint8Array(memory.buffer);
  let end = pointer;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  if (end >= bytes.byteLength) throw new Error(`unterminated WASM string at ${pointer}`);
  return new TextDecoder().decode(bytes.subarray(pointer, end));
}

export function readWasmPointerArray(memory: WebAssembly.Memory, pointer: number, count: number): number[] {
  if (!pointer || count === 0) return [];
  return Array.from(new Uint32Array(memory.buffer, pointer, count));
}

function readWasmFloatArray(memory: WebAssembly.Memory, pointer: number, count: number): number[] {
  if (!pointer || count === 0) return [];
  const view = new DataView(memory.buffer, pointer);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(view.getFloat32(index * 4, true));
  }
  return values;
}

export function writeWasmFloatArray(memory: WebAssembly.Memory, pointer: number, values: readonly number[]): void {
  const view = new DataView(memory.buffer, pointer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
}

export function bootstrapAndAllocatePuppetInput(api: LoadReadyWasmApi, byteLength: number): BootstrappedPuppetInput {
  const { scratchpad } = bootstrapInochiWebModule(api);
  return {
    sourcePointer: allocatePuppetInputOrThrow(api, byteLength),
    scratchpad,
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function wasiImports(): WebAssembly.Imports {
  const ok = (): number => 0;
  return {
    wasi_snapshot_preview1: {
      fd_close: ok,
      fd_fdstat_get: ok,
      fd_fdstat_set_flags: ok,
      fd_prestat_get: ok,
      fd_prestat_dir_name: ok,
      fd_read: ok,
      fd_seek: ok,
      fd_write: ok,
      path_open: ok,
      proc_exit: ok,
    },
  };
}

function withCountPointer<T>(api: InochiWasmExports, read: (countPtr: number) => T): { value: T; count: number } {
  const countPtr = allocatePuppetInputOrThrow(api, 4);
  try {
    new DataView(api.memory.buffer).setUint32(countPtr, 0, true);
    const value = read(countPtr);
    return { value, count: new DataView(api.memory.buffer).getUint32(countPtr, true) };
  } finally {
    api.nu_free(countPtr);
  }
}

function enumerateNodes(api: InochiWasmExports, rootPtr: number): { count: number; rootName: string } {
  const pending = [rootPtr];
  const seen = new Set<number>();
  let rootName = '';
  while (pending.length > 0) {
    const nodePtr = pending.pop() as number;
    if (!nodePtr || seen.has(nodePtr)) continue;
    seen.add(nodePtr);
    const name = readWasmCString(api.memory, Number(api.in_node_get_name(nodePtr)));
    readWasmCString(api.memory, Number(api.in_node_get_type(nodePtr)));
    if (nodePtr === rootPtr) rootName = name;
    const { value: childrenPtr, count } = withCountPointer(api, (countPtr) => Number(api.in_node_get_children(nodePtr, countPtr)));
    pending.push(...readWasmPointerArray(api.memory, childrenPtr, count));
  }
  return { count: seen.size, rootName };
}

function parameterPointers(api: InochiWasmExports, puppetPtr: number): { count: number; pointers: number[] } {
  const { value: parameterArrayPtr, count } = withCountPointer(api, (countPtr) => Number(api.in_puppet_get_parameters(puppetPtr, countPtr)));
  return { count, pointers: readWasmPointerArray(api.memory, parameterArrayPtr, count) };
}

function proveInventory(api: InochiWasmExports, puppetPtr: number): InventoryProof {
  const name = readWasmCString(api.memory, Number(api.in_puppet_get_name(puppetPtr)));
  const author = readWasmCString(api.memory, Number(api.in_puppet_get_author(puppetPtr)));
  const parameters = parameterPointers(api, puppetPtr);
  const rootPtr = Number(api.in_puppet_get_root_node(puppetPtr));
  if (!rootPtr) throw new Error('real puppet returned null root node');
  const nodes = enumerateNodes(api, rootPtr);
  return {
    name,
    author,
    parameterCount: parameters.count,
    parameterNames: parameters.pointers.map((parameterPtr) => readWasmCString(api.memory, Number(api.in_parameter_get_name(parameterPtr)))),
    nodeCount: nodes.count,
    rootNode: nodes.rootName,
  };
}

function proveParameterReads(api: InochiWasmExports, puppetPtr: number): ParameterReadProof {
  const inventory = proveInventory(api, puppetPtr);
  const parameters = parameterPointers(api, puppetPtr);
  const samples: ParameterSample[] = [];
  for (const parameterPtr of parameters.pointers) {
    if (samples.length >= 2) break;
    const dimensions = api.in_parameter_get_dimensions(parameterPtr);
    if (dimensions <= 0) continue;
    const lower = readWasmFloatArray(api.memory, Number(api.in_parameter_get_lower_bounds(parameterPtr)), dimensions);
    const upper = readWasmFloatArray(api.memory, Number(api.in_parameter_get_upper_bounds(parameterPtr)), dimensions);
    const value = readWasmFloatArray(api.memory, Number(api.in_parameter_get_value(parameterPtr)), dimensions);
    if (lower.length !== dimensions || upper.length !== dimensions || value.length !== dimensions) {
      throw new Error('real parameter arrays did not match reported dimensionality');
    }
    samples.push({
      name: readWasmCString(api.memory, Number(api.in_parameter_get_name(parameterPtr))),
      dimensions,
      lower,
      upper,
      value,
    });
  }
  if (samples.length < 2) throw new Error(`real puppet exposed ${parameters.count} parameters but fewer than two readable parameters`);
  return { ...inventory, samples };
}

function mutateTwoParameters(api: InochiWasmExports, puppetPtr: number): string[] {
  const parameters = parameterPointers(api, puppetPtr);
  const mutated: string[] = [];
  for (const parameterPtr of parameters.pointers) {
    if (mutated.length >= 2) break;
    const dimensions = api.in_parameter_get_dimensions(parameterPtr);
    if (dimensions <= 0) continue;
    const original = readWasmFloatArray(api.memory, Number(api.in_parameter_get_value(parameterPtr)), dimensions);
    const lower = readWasmFloatArray(api.memory, Number(api.in_parameter_get_lower_bounds(parameterPtr)), dimensions);
    const upper = readWasmFloatArray(api.memory, Number(api.in_parameter_get_upper_bounds(parameterPtr)), dimensions);
    const target = original.map((value, index) => {
      const low = lower[index] ?? value;
      const high = upper[index] ?? value;
      if (Math.abs(value - low) > 1e-5) return low;
      if (Math.abs(value - high) > 1e-5) return high;
      return value;
    });
    if (target.every((value, index) => Math.abs(value - (original[index] ?? value)) <= 1e-5)) continue;
    const valuesPtr = allocatePuppetInputOrThrow(api, dimensions * 4);
    try {
      writeWasmFloatArray(api.memory, valuesPtr, target);
      api.in_parameter_set_value(parameterPtr, valuesPtr);
      const observed = readWasmFloatArray(api.memory, Number(api.in_parameter_get_value(parameterPtr)), dimensions);
      if (!observed.some((value, index) => Math.abs(value - (original[index] ?? value)) > 1e-5)) throw new Error('parameter mutation did not change real WASM state');
      writeWasmFloatArray(api.memory, valuesPtr, original);
      api.in_parameter_set_value(parameterPtr, valuesPtr);
      const restored = readWasmFloatArray(api.memory, Number(api.in_parameter_get_value(parameterPtr)), dimensions);
      if (restored.some((value, index) => Math.abs(value - (original[index] ?? value)) > 1e-5)) throw new Error('parameter restore did not recover original real WASM state');
    } finally {
      api.nu_free(valuesPtr);
    }
    mutated.push(readWasmCString(api.memory, Number(api.in_parameter_get_name(parameterPtr))));
  }
  if (mutated.length < 2) throw new Error(`real puppet exposed ${parameters.count} parameters but fewer than two mutable parameters`);
  return mutated;
}

function proveMutation(api: InochiWasmExports, puppetPtr: number): MutationProof {
  const parameterReadProof = proveParameterReads(api, puppetPtr);
  return { ...parameterReadProof, mutatedParameters: mutateTwoParameters(api, puppetPtr) };
}

function loadPuppetBytes(api: InochiWasmExports, puppetBytes: Uint8Array): number {
  const sourcePtr = allocatePuppetInputOrThrow(api, puppetBytes.byteLength);
  try {
    new Uint8Array(api.memory.buffer, sourcePtr, puppetBytes.byteLength).set(puppetBytes);
    return Number(api.in_puppet_load_from_memory(sourcePtr, puppetBytes.byteLength, 0));
  } finally {
    api.nu_free(sourcePtr);
  }
}

function proveRuntime(api: InochiWasmExports, puppetPtr: number, puppetBytes: Uint8Array): RuntimeProof {
  const mutationProof = proveMutation(api, puppetPtr);
  api.in_puppet_free(puppetPtr);
  const reloadPtr = loadPuppetBytes(api, puppetBytes);
  if (!reloadPtr) throw new Error('real puppet failed deterministic reload after dispose');
  let reloadMatched = false;
  try {
    const reloadedName = readWasmCString(api.memory, Number(api.in_puppet_get_name(reloadPtr)));
    const { count: reloadParameterCount } = withCountPointer(api, (countPtr) => Number(api.in_puppet_get_parameters(reloadPtr, countPtr)));
    reloadMatched = reloadedName === mutationProof.name && reloadParameterCount === mutationProof.parameterCount;
    if (!reloadMatched) throw new Error('reloaded puppet metadata/parameter inventory changed');
  } finally {
    api.in_puppet_free(reloadPtr);
  }
  return { ...mutationProof, reloadMatched };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wasmPath = args[0];
  const expectBlocked = args.includes('--expect-blocked');
  const allowCandidate = args.includes('--allow-candidate-wasm');
  const proofMode = resolveProbeMode(args);
  if (!wasmPath || wasmPath.startsWith('--')) {
    throw new Error('usage: npx tsx scripts/probe-inochi-wasm-load.ts <inochi2d.wasm> [--fixture <puppet.inx>] [--inventory-proof] [--mutation-proof] [--runtime-proof] [--expect-blocked] [--allow-candidate-wasm]');
  }
  const fixture = resolveProbeFixture(args);
  const wasm = await readFile(wasmPath);
  const wasmHash = sha256(wasm);
  assertAcceptedWasmHash(wasmHash, allowCandidate);
  const puppetBytes = fixture.path ? await readFile(fixture.path) : Buffer.from(EMPTY08_BASE64.replace(/\s+/g, ''), 'base64');
  const puppetHash = sha256(puppetBytes);
  if (!fixture.path && puppetHash !== UPSTREAM_EMPTY08_SHA256) throw new Error('embedded upstream empty08.inx fixture digest mismatch');
  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports as unknown as InochiWasmExports;
  const baseEvidence = { upstreamCommit: PINNED_UPSTREAM_COMMIT, artifactDigest: allowCandidate ? undefined : `sha256:${PINNED_ARTIFACT_DIGEST}`, candidateWasm: allowCandidate, wasmSha256: wasmHash, fixture: fixture.label, fixtureSha256: puppetHash, fixtureBytes: puppetBytes.byteLength };
  let scratchpad: InochiWebScratchpad;
  try {
    scratchpad = bootstrapInochiWebModule(api).scratchpad;
  } catch (error) {
    console.log(JSON.stringify({ ...baseEvidence, blockedAt: 'bootstrap', requestedBytes: puppetBytes.byteLength, error: error instanceof Error ? error.message : String(error) }, null, 2));
    if (expectBlocked) return;
    throw error;
  }
  let puppetPtr = 0;
  try {
    puppetPtr = loadPuppetBytes(api, puppetBytes);
  } catch (error) {
    console.log(JSON.stringify({ ...baseEvidence, blockedAt: 'input-allocation', requestedBytes: puppetBytes.byteLength, error: error instanceof Error ? error.message : String(error) }, null, 2));
    if (expectBlocked) return;
    throw error;
  }
  if (!puppetPtr) {
    console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr }, null, 2));
    if (expectBlocked) return;
    throw new Error(`upstream WASM in_puppet_load_from_memory returned null for ${fixture.label}`);
  }
  if (expectBlocked) {
    api.in_puppet_free(puppetPtr);
    throw new Error('upstream WASM load unexpectedly succeeded; re-evaluate the documented blocker');
  }
  if (proofMode === 'inventory') {
    try {
      console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr, inventoryProof: proveInventory(api, puppetPtr) }, null, 2));
    } finally {
      api.in_puppet_free(puppetPtr);
    }
    return;
  }
  if (proofMode === 'parameter-read') {
    try {
      console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr, parameterReadProof: proveParameterReads(api, puppetPtr) }, null, 2));
    } finally {
      api.in_puppet_free(puppetPtr);
    }
    return;
  }
  if (proofMode === 'mutation') {
    try {
      console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr, mutationProof: proveMutation(api, puppetPtr) }, null, 2));
    } finally {
      api.in_puppet_free(puppetPtr);
    }
    return;
  }
  if (proofMode === 'runtime') {
    console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr, runtimeProof: proveRuntime(api, puppetPtr, puppetBytes) }, null, 2));
    return;
  }
  console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr }, null, 2));
  api.in_puppet_free(puppetPtr);
}

const argvEntry = process.argv[1];
if (argvEntry && import.meta.url === pathToFileURL(argvEntry).href) {
  await main();
}
