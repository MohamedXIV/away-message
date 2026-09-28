#!/usr/bin/env -S npx tsx
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { bootstrapInochiWebModule, type InochiWebBootstrapExports } from '../src/tooling/away-puppet/InochiWebModuleBootstrap';
import { copyInochiDrawList, INOCHI_DRAW_COMMAND_STRIDE, type InochiCopiedDrawList } from '../src/tooling/away-puppet/InochiDrawListBridge';

interface InochiDrawProofExports extends InochiWebBootstrapExports {
  readonly memory: WebAssembly.Memory;
  nu_malloc(bytes: number): number | bigint;
  nu_free(pointer: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(pointer: number): void;
  in_puppet_update(pointer: number, delta: number): void;
  in_puppet_draw(pointer: number, delta: number): void;
  in_puppet_get_drawlist(pointer: number): number | bigint;
  in_drawlist_get_use_base_vertex(pointer: number): boolean;
  in_drawlist_get_commands(pointer: number, countPointer: number): number | bigint;
  in_drawlist_get_vertex_data(pointer: number, byteCountPointer: number): number | bigint;
  in_drawlist_get_index_data(pointer: number, byteCountPointer: number): number | bigint;
  in_drawlist_get_allocations(pointer: number, countPointer: number): number | bigint;
}

function requirePointer(pointer: number | bigint, operation: string): number {
  const value = Number(pointer);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${operation} returned an invalid pointer`);
  return value;
}

function allocate(api: InochiDrawProofExports, bytes: number): number {
  return requirePointer(api.nu_malloc(bytes), `nu_malloc(${bytes})`);
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

export function validateRealDrawListProof(drawList: InochiCopiedDrawList): void {
  if (!Number.isSafeInteger(drawList.commandCount) || drawList.commandCount <= 0) {
    throw new Error('real puppet produced no draw commands');
  }
  if (drawList.commandBytes.byteLength !== drawList.commandCount * INOCHI_DRAW_COMMAND_STRIDE) {
    throw new Error('copied draw-command bytes do not match the ABI command count');
  }
  if (drawList.vertexBytes.byteLength <= 0) throw new Error('real puppet produced no copied vertex data');
  if (drawList.indexBytes.byteLength <= 0) throw new Error('real puppet produced no copied index data');
  if (drawList.allocations.length <= 0) throw new Error('real puppet produced no draw allocations');
  if (!drawList.allocations.some(({ vtxCount, idxCount }) => vtxCount > 0 && idxCount > 0)) {
    throw new Error('real puppet draw allocations contain no renderable geometry');
  }
}

export async function proveRealWasmDrawList(wasmPath: string, fixturePath: string): Promise<InochiCopiedDrawList> {
  const wasm = await readFile(wasmPath);
  const puppetBytes = await readFile(fixturePath);
  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports as unknown as InochiDrawProofExports;
  bootstrapInochiWebModule(api);

  const sourcePointer = allocate(api, puppetBytes.byteLength);
  let puppetPointer = 0;
  try {
    new Uint8Array(api.memory.buffer, sourcePointer, puppetBytes.byteLength).set(puppetBytes);
    puppetPointer = requirePointer(
      api.in_puppet_load_from_memory(sourcePointer, puppetBytes.byteLength, 0),
      'in_puppet_load_from_memory',
    );
  } finally {
    api.nu_free(sourcePointer);
  }

  try {
    api.in_puppet_update(puppetPointer, 1 / 60);
    api.in_puppet_draw(puppetPointer, 1 / 60);
    const drawListPointer = requirePointer(api.in_puppet_get_drawlist(puppetPointer), 'in_puppet_get_drawlist');
    const copied = copyInochiDrawList({
      memory: api.memory,
      alloc: (bytes) => allocate(api, bytes),
      free: (pointer) => api.nu_free(pointer),
      getUseBaseVertex: (pointer) => api.in_drawlist_get_use_base_vertex(pointer),
      getCommands: (pointer, countPointer) => Number(api.in_drawlist_get_commands(pointer, countPointer)),
      getVertexData: (pointer, byteCountPointer) => Number(api.in_drawlist_get_vertex_data(pointer, byteCountPointer)),
      getIndexData: (pointer, byteCountPointer) => Number(api.in_drawlist_get_index_data(pointer, byteCountPointer)),
      getAllocations: (pointer, countPointer) => Number(api.in_drawlist_get_allocations(pointer, countPointer)),
    }, drawListPointer);
    validateRealDrawListProof(copied);
    return copied;
  } finally {
    api.in_puppet_free(puppetPointer);
  }
}

async function main(): Promise<void> {
  const [wasmPath, fixturePath] = process.argv.slice(2);
  if (!wasmPath || !fixturePath) {
    throw new Error('usage: npx tsx scripts/probe-inochi-wasm-draw-list.ts <inochi2d.wasm> <puppet.inx>');
  }

  const wasm = await readFile(wasmPath);
  const fixture = await readFile(fixturePath);
  const copied = await proveRealWasmDrawList(wasmPath, fixturePath);
  console.log(JSON.stringify({
    wasmSha256: sha256(wasm),
    fixture: fixturePath,
    fixtureSha256: sha256(fixture),
    fixtureBytes: fixture.byteLength,
    drawListProof: {
      useBaseVertex: copied.useBaseVertex,
      commandCount: copied.commandCount,
      commandBytes: copied.commandBytes.byteLength,
      vertexBytes: copied.vertexBytes.byteLength,
      indexBytes: copied.indexBytes.byteLength,
      allocationCount: copied.allocations.length,
      renderableAllocationCount: copied.allocations.filter(({ vtxCount, idxCount }) => vtxCount > 0 && idxCount > 0).length,
    },
  }, null, 2));
}

const argvEntry = process.argv[1];
if (argvEntry && import.meta.url === pathToFileURL(argvEntry).href) await main();
