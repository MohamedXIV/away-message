#!/usr/bin/env -S npx tsx
import { readFile } from 'node:fs/promises';
import { bootstrapInochiWebModule, type InochiWebBootstrapExports } from '../src/tooling/away-puppet/InochiWebModuleBootstrap';

interface SlotProbeExports extends InochiWebBootstrapExports {
  readonly memory: WebAssembly.Memory;
  nu_malloc(size: number): number | bigint;
  nu_free(pointer: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(pointer: number): void;
  in_puppet_get_root_node(pointer: number): number | bigint;
  in_puppet_get_texture_cache(pointer: number): number | bigint;
  in_node_get_name(pointer: number): number | bigint;
  in_node_get_children(pointer: number, countPointer: number): number | bigint;
  in_as_part(pointer: number): number | bigint;
  in_texture_cache_get_size(pointer: number): number;
  in_texture_cache_get_texture(pointer: number, slot: number): number | bigint;
  in_part_get_texture(pointer: number, attachment: number): number | bigint;
  in_part_set_texture(pointer: number, attachment: number, texturePointer: number): boolean;
}

interface SlotCandidate {
  readonly partPointer: number;
  readonly nodeName: string;
  readonly attachment: number;
  readonly originalTexturePointer: number;
  readonly replacementTexturePointer: number;
  readonly replacementTextureIndex: number;
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

function allocate(api: SlotProbeExports, bytes: number): number {
  return requirePointer(api.nu_malloc(bytes), `nu_malloc(${bytes})`);
}

function readCString(api: SlotProbeExports, pointer: number | bigint): string {
  const start = Number(pointer);
  if (!Number.isSafeInteger(start) || start <= 0) return '';
  const bytes = new Uint8Array(api.memory.buffer);
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  if (end >= bytes.byteLength) throw new Error(`unterminated WASM string at ${start}`);
  return new TextDecoder().decode(bytes.subarray(start, end));
}

function childPointers(api: SlotProbeExports, nodePointer: number): number[] {
  const countPointer = allocate(api, 4);
  try {
    const view = new DataView(api.memory.buffer);
    view.setUint32(countPointer, 0, true);
    const arrayPointer = Number(api.in_node_get_children(nodePointer, countPointer));
    const count = view.getUint32(countPointer, true);
    if (count === 0) return [];
    if (!Number.isSafeInteger(arrayPointer) || arrayPointer <= 0) throw new Error('node children returned a null pointer for a non-zero count');
    const arrayView = new DataView(api.memory.buffer);
    return Array.from({ length: count }, (_, index) => arrayView.getUint32(arrayPointer + index * 4, true));
  } finally {
    api.nu_free(countPointer);
  }
}

function findSlotCandidate(api: SlotProbeExports, puppetPointer: number): SlotCandidate {
  const rootPointer = requirePointer(api.in_puppet_get_root_node(puppetPointer), 'root lookup');
  const cachePointer = requirePointer(api.in_puppet_get_texture_cache(puppetPointer), 'texture-cache lookup');
  const textureCount = api.in_texture_cache_get_size(cachePointer);
  if (!Number.isInteger(textureCount) || textureCount <= 0) throw new Error('real puppet exposes no cached textures for slot proof');

  const cachedTextures = Array.from({ length: textureCount }, (_, index) => ({
    index,
    pointer: Number(api.in_texture_cache_get_texture(cachePointer, index)),
  })).filter(({ pointer }) => Number.isSafeInteger(pointer) && pointer > 0);
  if (cachedTextures.length === 0) throw new Error('real puppet texture cache contains no usable texture pointers');

  const pending = [rootPointer];
  const seen = new Set<number>();
  while (pending.length > 0) {
    const nodePointer = pending.pop() as number;
    if (!nodePointer || seen.has(nodePointer)) continue;
    seen.add(nodePointer);

    const partPointer = Number(api.in_as_part(nodePointer));
    if (Number.isSafeInteger(partPointer) && partPointer > 0) {
      for (let attachment = 0; attachment < 8; attachment += 1) {
        const originalTexturePointer = Number(api.in_part_get_texture(partPointer, attachment));
        const replacement = cachedTextures.find(({ pointer }) => pointer !== originalTexturePointer);
        if (replacement) {
          return {
            partPointer,
            nodeName: readCString(api, api.in_node_get_name(nodePointer)),
            attachment,
            originalTexturePointer,
            replacementTexturePointer: replacement.pointer,
            replacementTextureIndex: replacement.index,
          };
        }
      }
    }

    pending.push(...childPointers(api, nodePointer));
  }

  throw new Error('real puppet exposed no Part/attachment with a distinct cached replacement texture');
}

async function main(): Promise<void> {
  const [wasmPath, puppetPath] = process.argv.slice(2);
  if (!wasmPath || !puppetPath) throw new Error('usage: npx tsx scripts/probe-inochi-wasm-slot.ts <inochi2d.wasm> <puppet.inx>');

  const wasm = await readFile(wasmPath);
  const puppetBytes = await readFile(puppetPath);
  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports as unknown as SlotProbeExports;
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
    const candidate = findSlotCandidate(api, puppetPointer);
    if (!api.in_part_set_texture(candidate.partPointer, candidate.attachment, candidate.replacementTexturePointer)) {
      throw new Error('real Part texture assignment returned false');
    }
    const readbackPointer = Number(api.in_part_get_texture(candidate.partPointer, candidate.attachment));
    if (readbackPointer !== candidate.replacementTexturePointer) {
      throw new Error(`real Part texture readback mismatch: expected ${candidate.replacementTexturePointer}, got ${readbackPointer}`);
    }

    if (!api.in_part_set_texture(candidate.partPointer, candidate.attachment, candidate.originalTexturePointer)) {
      throw new Error('real Part texture restore returned false');
    }
    const restoredPointer = Number(api.in_part_get_texture(candidate.partPointer, candidate.attachment));
    if (restoredPointer !== candidate.originalTexturePointer) {
      throw new Error(`real Part texture restore mismatch: expected ${candidate.originalTexturePointer}, got ${restoredPointer}`);
    }

    console.log(JSON.stringify({
      fixture: puppetPath,
      fixtureBytes: puppetBytes.byteLength,
      nodeName: candidate.nodeName,
      attachment: candidate.attachment,
      replacementTextureIndex: candidate.replacementTextureIndex,
      assignmentReadbackMatched: true,
      restoreReadbackMatched: true,
    }, null, 2));
  } finally {
    api.in_puppet_free(puppetPointer);
  }
}

await main();
