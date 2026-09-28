#!/usr/bin/env -S npx tsx
import { readFile } from 'node:fs/promises';
import { bootstrapInochiWebModule, type InochiWebBootstrapExports } from '../src/tooling/away-puppet/InochiWebModuleBootstrap';

interface TintProbeExports extends InochiWebBootstrapExports {
  readonly memory: WebAssembly.Memory;
  nu_malloc(size: number): number | bigint;
  nu_free(pointer: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(pointer: number): void;
  in_puppet_get_root_node(pointer: number): number | bigint;
  in_node_get_name(pointer: number): number | bigint;
  in_node_get_children(pointer: number, countPointer: number): number | bigint;
  in_as_part(pointer: number): number | bigint;
  in_part_get_tint(pointer: number, rPointer: number, gPointer: number, bPointer: number): void;
  in_part_set_tint(pointer: number, r: number, g: number, b: number): boolean;
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

function requirePointer(pointer: number | bigint, operation: string): number {
  const value = Number(pointer);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${operation} returned an invalid pointer`);
  return value;
}

function allocate(api: TintProbeExports, bytes: number): number {
  return requirePointer(api.nu_malloc(bytes), `nu_malloc(${bytes})`);
}

function readCString(api: TintProbeExports, pointer: number | bigint): string {
  const start = Number(pointer);
  if (!Number.isSafeInteger(start) || start <= 0) return '';
  const bytes = new Uint8Array(api.memory.buffer);
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  if (end >= bytes.byteLength) throw new Error(`unterminated WASM string at ${start}`);
  return new TextDecoder().decode(bytes.subarray(start, end));
}

function childPointers(api: TintProbeExports, nodePointer: number): number[] {
  const countPointer = allocate(api, 4);
  try {
    const view = new DataView(api.memory.buffer);
    view.setUint32(countPointer, 0, true);
    const arrayPointer = Number(api.in_node_get_children(nodePointer, countPointer));
    const count = view.getUint32(countPointer, true);
    if (count === 0) return [];
    if (!Number.isSafeInteger(arrayPointer) || arrayPointer <= 0) throw new Error('node children returned a null pointer for a non-zero count');
    return Array.from({ length: count }, (_, index) => view.getUint32(arrayPointer + index * 4, true));
  } finally {
    api.nu_free(countPointer);
  }
}

function findFirstPart(api: TintProbeExports, puppetPointer: number): { nodePointer: number; partPointer: number; nodeName: string } {
  const rootPointer = requirePointer(api.in_puppet_get_root_node(puppetPointer), 'root lookup');
  const pending = [rootPointer];
  const seen = new Set<number>();

  while (pending.length > 0) {
    const nodePointer = pending.pop() as number;
    if (!nodePointer || seen.has(nodePointer)) continue;
    seen.add(nodePointer);

    const partPointer = Number(api.in_as_part(nodePointer));
    if (Number.isSafeInteger(partPointer) && partPointer > 0) {
      return { nodePointer, partPointer, nodeName: readCString(api, api.in_node_get_name(nodePointer)) };
    }
    pending.push(...childPointers(api, nodePointer));
  }
  throw new Error('real puppet exposed no Part node for tint proof');
}

function readTint(api: TintProbeExports, partPointer: number): [number, number, number] {
  const scratch = allocate(api, 12);
  try {
    api.in_part_get_tint(partPointer, scratch, scratch + 4, scratch + 8);
    const view = new DataView(api.memory.buffer);
    return [
      view.getFloat32(scratch, true),
      view.getFloat32(scratch + 4, true),
      view.getFloat32(scratch + 8, true),
    ];
  } finally {
    api.nu_free(scratch);
  }
}

function closeEnough(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => Math.abs(value - (b[index] ?? Number.NaN)) < 1e-5);
}

async function main(): Promise<void> {
  const [wasmPath, puppetPath] = process.argv.slice(2);
  if (!wasmPath || !puppetPath) throw new Error('usage: npx tsx scripts/probe-inochi-wasm-tint.ts <inochi2d.wasm> <puppet.inx>');

  const wasm = await readFile(wasmPath);
  const puppetBytes = await readFile(puppetPath);
  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports as unknown as TintProbeExports;
  bootstrapInochiWebModule(api);

  const sourcePointer = allocate(api, puppetBytes.byteLength);
  let puppetPointer = 0;
  try {
    new Uint8Array(api.memory.buffer, sourcePointer, puppetBytes.byteLength).set(puppetBytes);
    puppetPointer = requirePointer(api.in_puppet_load_from_memory(sourcePointer, puppetBytes.byteLength, 0), 'puppet load');
  } finally {
    api.nu_free(sourcePointer);
  }

  try {
    const candidate = findFirstPart(api, puppetPointer);
    const original = readTint(api, candidate.partPointer);
    const target: [number, number, number] = [0.2, 0.6, 0.8];

    if (!api.in_part_set_tint(candidate.partPointer, ...target)) {
      throw new Error('real Part tint assignment returned false');
    }
    const assigned = readTint(api, candidate.partPointer);
    if (!closeEnough(assigned, target)) {
      throw new Error(`real Part tint readback mismatch: expected ${target.join(',')}, got ${assigned.join(',')}`);
    }

    if (!api.in_part_set_tint(candidate.partPointer, ...original)) {
      throw new Error('real Part tint restore returned false');
    }
    const restored = readTint(api, candidate.partPointer);
    if (!closeEnough(restored, original)) {
      throw new Error(`real Part tint restore mismatch: expected ${original.join(',')}, got ${restored.join(',')}`);
    }

    console.log(JSON.stringify({
      fixture: puppetPath,
      fixtureBytes: puppetBytes.byteLength,
      nodeName: candidate.nodeName,
      original,
      target,
      assignmentReadbackMatched: true,
      restoreReadbackMatched: true,
    }, null, 2));
  } finally {
    api.in_puppet_free(puppetPointer);
  }
}

await main();
