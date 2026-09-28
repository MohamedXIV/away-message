import { bootstrapInochiWebModule, type InochiWebBootstrapExports } from './InochiWebModuleBootstrap';
import {
  createInochiWebLifecycle,
  type InochiWebRuntimeModule,
  type InochiWebRuntimeNode,
  type InochiWebRuntimeParameter,
  type InochiWebRuntimePuppet,
  type InochiWebSourceLoader,
} from './InochiWebLifecycle';
import { createAwayPuppetToolService, type AwayPuppetToolService } from './McpSemanticTools';
import {
  copyInochiDrawList,
  convertInochiDrawListToCharacterFrame,
  decodeInochiTextureRgba,
  type InochiDrawListRawApi,
} from './InochiDrawListBridge';
import type { CharacterMeshFrame, CharacterMeshTexture } from '../../world/characterRenderer';

export interface InochiWasmRuntimeExports extends InochiWebBootstrapExports {
  readonly memory: WebAssembly.Memory;
  nu_malloc(bytes: number): number | bigint;
  nu_free(pointer: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(pointer: number): void;
  in_puppet_get_parameters(pointer: number, countPointer: number): number | bigint;
  in_puppet_get_root_node(pointer: number): number | bigint;
  in_puppet_get_texture_cache?(pointer: number): number | bigint;
  in_parameter_get_name(pointer: number): number | bigint;
  in_parameter_get_dimensions(pointer: number): number;
  in_parameter_get_value(pointer: number): number | bigint;
  in_parameter_set_value(pointer: number, valuesPointer: number): void;
  in_node_get_name(pointer: number): number | bigint;
  in_node_get_enabled(pointer: number): boolean;
  in_node_set_enabled(pointer: number, value: boolean): void;
  in_node_get_children(pointer: number, countPointer: number): number | bigint;
  in_as_part?(pointer: number): number | bigint;
  in_texture_cache_get_texture?(pointer: number, slot: number): number | bigint;
  in_part_get_texture?(pointer: number, attachment: number): number | bigint;
  in_part_set_texture?(pointer: number, attachment: number, texturePointer: number): boolean;
  in_part_get_tint?(pointer: number, rPointer: number, gPointer: number, bPointer: number): void;
  in_part_set_tint?(pointer: number, r: number, g: number, b: number): boolean;
  in_puppet_update?(pointer: number, deltaSeconds: number): void;
  in_puppet_draw?(pointer: number, deltaSeconds: number): void;
  in_puppet_get_drawlist?(pointer: number): number | bigint;
  in_drawlist_get_use_base_vertex?(pointer: number): boolean;
  in_drawlist_get_commands?(pointer: number, countPointer: number): number | bigint;
  in_drawlist_get_vertex_data?(pointer: number, byteCountPointer: number): number | bigint;
  in_drawlist_get_index_data?(pointer: number, byteCountPointer: number): number | bigint;
  in_drawlist_get_allocations?(pointer: number, countPointer: number): number | bigint;
  in_texture_cache_get_size?(pointer: number): number;
  in_texture_get_width?(pointer: number): number;
  in_texture_get_height?(pointer: number): number;
  in_texture_get_channels?(pointer: number): number;
  in_texture_get_pixels?(pointer: number): number | bigint;
}

function requirePointer(pointer: number | bigint, operation: string): number {
  const value = Number(pointer);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Inochi WASM ${operation} failed: runtime returned an invalid pointer`);
  }
  return value;
}

function allocate(exports: InochiWasmRuntimeExports, bytes: number, operation: string): number {
  return requirePointer(exports.nu_malloc(bytes), operation);
}

function readCString(exports: InochiWasmRuntimeExports, pointer: number | bigint): string {
  const start = Number(pointer);
  if (!Number.isSafeInteger(start) || start <= 0) return '';
  const bytes = new Uint8Array(exports.memory.buffer);
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0) end += 1;
  if (end >= bytes.byteLength) throw new Error(`Inochi WASM string at ${start} is unterminated`);
  return new TextDecoder().decode(bytes.subarray(start, end));
}

function withCountPointer<T>(exports: InochiWasmRuntimeExports, read: (countPointer: number) => T): { value: T; count: number } {
  const countPointer = allocate(exports, 4, 'count allocation');
  try {
    const view = new DataView(exports.memory.buffer);
    view.setUint32(countPointer, 0, true);
    const value = read(countPointer);
    return { value, count: view.getUint32(countPointer, true) };
  } finally {
    exports.nu_free(countPointer);
  }
}

function readPointerArray(exports: InochiWasmRuntimeExports, pointer: number | bigint, count: number): number[] {
  const start = Number(pointer);
  if (count === 0) return [];
  if (!Number.isSafeInteger(start) || start <= 0) throw new Error('Inochi WASM pointer array is null');
  const view = new DataView(exports.memory.buffer);
  return Array.from({ length: count }, (_, index) => view.getUint32(start + index * 4, true));
}

function readFloatArray(exports: InochiWasmRuntimeExports, pointer: number | bigint, count: number): number[] {
  const start = Number(pointer);
  if (count === 0) return [];
  if (!Number.isSafeInteger(start) || start <= 0) throw new Error('Inochi WASM float array is null');
  const view = new DataView(exports.memory.buffer);
  return Array.from({ length: count }, (_, index) => view.getFloat32(start + index * 4, true));
}

function parseHexRgb(color: string): readonly [number, number, number] {
  const match = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (!match) throw new Error(`Inochi tint must be #RRGGBB: ${color}`);
  const value = Number.parseInt(match[1]!, 16);
  return [
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
  ];
}

function findNodePointer(exports: InochiWasmRuntimeExports, pointer: number, name: string): number {
  if (readCString(exports, exports.in_node_get_name(pointer)) === name) return pointer;
  const { value, count } = withCountPointer(
    exports,
    (countPointer) => exports.in_node_get_children(pointer, countPointer),
  );
  for (const childPointer of readPointerArray(exports, value, count)) {
    const found = findNodePointer(exports, childPointer, name);
    if (found > 0) return found;
  }
  return 0;
}

class WasmParameter implements InochiWebRuntimeParameter {
  readonly name: string;

  constructor(
    private readonly exports: InochiWasmRuntimeExports,
    private readonly pointer: number,
  ) {
    this.name = readCString(exports, exports.in_parameter_get_name(pointer));
  }

  get value(): number[] {
    const dimensions = this.exports.in_parameter_get_dimensions(this.pointer);
    if (!Number.isInteger(dimensions) || dimensions <= 0) return [];
    return readFloatArray(this.exports, this.exports.in_parameter_get_value(this.pointer), dimensions);
  }

  set value(next: number[]) {
    const dimensions = this.exports.in_parameter_get_dimensions(this.pointer);
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new Error(`Inochi parameter ${this.name} has invalid dimensionality`);
    }
    if (next.length !== dimensions) {
      throw new Error(`Inochi parameter ${this.name} expects ${dimensions} values, received ${next.length}`);
    }

    const valuesPointer = allocate(this.exports, dimensions * 4, 'parameter value allocation');
    try {
      const view = new DataView(this.exports.memory.buffer);
      next.forEach((value, index) => view.setFloat32(valuesPointer + index * 4, value, true));
      this.exports.in_parameter_set_value(this.pointer, valuesPointer);
    } finally {
      this.exports.nu_free(valuesPointer);
    }
  }
}

class WasmNode implements InochiWebRuntimeNode {
  readonly name: string;

  constructor(
    private readonly exports: InochiWasmRuntimeExports,
    private readonly pointer: number,
  ) {
    this.name = readCString(exports, exports.in_node_get_name(pointer));
  }

  get enabled(): boolean { return this.exports.in_node_get_enabled(this.pointer); }
  set enabled(value: boolean) { this.exports.in_node_set_enabled(this.pointer, value); }

  get children(): ReadonlyArray<InochiWebRuntimeNode | null> {
    const { value, count } = withCountPointer(
      this.exports,
      (countPointer) => this.exports.in_node_get_children(this.pointer, countPointer),
    );
    return readPointerArray(this.exports, value, count).map((childPointer) => new WasmNode(this.exports, childPointer));
  }
}

/**
 * Adapts the corrected low-level CFFI/WebAssembly boundary to the same small
 * wrapper shape consumed by `createInochiWebLifecycle`. Raw pointers never
 * cross this tooling boundary into Away semantic/MCP callers.
 */
export function createInochiWasmRuntimeModule(exports: InochiWasmRuntimeExports): InochiWebRuntimeModule {
  bootstrapInochiWebModule(exports);

  return {
    Puppet: class WasmPuppet implements InochiWebRuntimePuppet {
      private readonly pointer: number;
      readonly parameters: readonly InochiWebRuntimeParameter[];
      readonly root: InochiWebRuntimeNode | null;
      private disposed = false;
      private readonly renderTextures = new Map<number, CharacterMeshTexture>();

      constructor(bytes: ArrayBufferLike) {
        const source = new Uint8Array(bytes);
        const sourcePointer = allocate(exports, source.byteLength, 'puppet input allocation');
        let puppetPointer = 0;

        try {
          new Uint8Array(exports.memory.buffer, sourcePointer, source.byteLength).set(source);
          puppetPointer = Number(exports.in_puppet_load_from_memory(sourcePointer, source.byteLength, 0));
        } finally {
          exports.nu_free(sourcePointer);
        }

        this.pointer = requirePointer(puppetPointer, 'puppet load');

        try {
          const { value: parameterArray, count } = withCountPointer(
            exports,
            (countPointer) => exports.in_puppet_get_parameters(this.pointer, countPointer),
          );
          this.parameters = readPointerArray(exports, parameterArray, count)
            .map((parameterPointer) => new WasmParameter(exports, parameterPointer));

          const rootPointer = Number(exports.in_puppet_get_root_node(this.pointer));
          this.root = rootPointer > 0 ? new WasmNode(exports, rootPointer) : null;
        } catch (error) {
          exports.in_puppet_free(this.pointer);
          this.disposed = true;
          throw error;
        }
      }

      captureRenderFrame(deltaMs: number): CharacterMeshFrame {
        if (this.disposed) throw new Error('Inochi WASM puppet is disposed');
        if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Inochi render delta must be a finite non-negative number');
        const required = [
          exports.in_puppet_update,
          exports.in_puppet_draw,
          exports.in_puppet_get_drawlist,
          exports.in_drawlist_get_use_base_vertex,
          exports.in_drawlist_get_commands,
          exports.in_drawlist_get_vertex_data,
          exports.in_drawlist_get_index_data,
          exports.in_drawlist_get_allocations,
          exports.in_puppet_get_texture_cache,
          exports.in_texture_cache_get_size,
          exports.in_texture_cache_get_texture,
          exports.in_texture_get_width,
          exports.in_texture_get_height,
          exports.in_texture_get_channels,
          exports.in_texture_get_pixels,
        ];
        if (required.some((candidate) => typeof candidate !== 'function')) {
          throw new Error('Renderer capture is unavailable through this Inochi WASM build');
        }

        const deltaSeconds = deltaMs / 1000;
        exports.in_puppet_update!(this.pointer, deltaSeconds);
        exports.in_puppet_draw!(this.pointer, deltaSeconds);
        const drawListPointer = requirePointer(exports.in_puppet_get_drawlist!(this.pointer), 'draw-list lookup');

        const raw: InochiDrawListRawApi = {
          memory: exports.memory,
          alloc: (bytes) => allocate(exports, bytes, 'draw-list scratch allocation'),
          free: (ptr) => exports.nu_free(ptr),
          getUseBaseVertex: (ptr) => exports.in_drawlist_get_use_base_vertex!(ptr),
          getCommands: (ptr, out) => Number(exports.in_drawlist_get_commands!(ptr, out)),
          getVertexData: (ptr, out) => Number(exports.in_drawlist_get_vertex_data!(ptr, out)),
          getIndexData: (ptr, out) => Number(exports.in_drawlist_get_index_data!(ptr, out)),
          getAllocations: (ptr, out) => Number(exports.in_drawlist_get_allocations!(ptr, out)),
        };
        const copied = copyInochiDrawList(raw, drawListPointer);

        const cachePointer = requirePointer(exports.in_puppet_get_texture_cache!(this.pointer), 'texture cache lookup');
        const textureCount = exports.in_texture_cache_get_size!(cachePointer);
        if (!Number.isSafeInteger(textureCount) || textureCount < 0) throw new Error('Inochi texture cache returned an invalid size');

        const textures = new Map<number, CharacterMeshTexture>();
        for (let slot = 0; slot < textureCount; slot += 1) {
          const texturePointer = requirePointer(exports.in_texture_cache_get_texture!(cachePointer, slot), `texture ${slot} lookup`);
          let texture = this.renderTextures.get(texturePointer);
          if (!texture) {
            const width = exports.in_texture_get_width!(texturePointer);
            const height = exports.in_texture_get_height!(texturePointer);
            const channels = exports.in_texture_get_channels!(texturePointer);
            if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
              throw new Error(`Inochi texture ${slot} has invalid dimensions`);
            }
            if (![1, 2, 3, 4].includes(channels)) throw new Error(`Inochi texture ${slot} has unsupported channel count ${channels}`);
            const byteLength = width * height * channels;
            if (!Number.isSafeInteger(byteLength) || byteLength <= 0) throw new Error(`Inochi texture ${slot} byte length overflow`);
            const pixelsPointer = requirePointer(exports.in_texture_get_pixels!(texturePointer), `texture ${slot} pixels`);
            if (pixelsPointer + byteLength > exports.memory.buffer.byteLength) throw new Error(`Inochi texture ${slot} pixels exceed WASM memory`);
            const pixels = new Uint8Array(new Uint8Array(exports.memory.buffer, pixelsPointer, byteLength));
            texture = decodeInochiTextureRgba(`inochi-texture-${slot}`, width, height, channels, pixels);
            this.renderTextures.set(texturePointer, texture);
          }
          textures.set(texturePointer, texture);
        }

        return convertInochiDrawListToCharacterFrame(copied, textures);
      }

      assignPartTexture(nodeName: string, textureIndex: number, attachment: number): void {
        if (this.disposed) throw new Error('Inochi WASM puppet is disposed');
        if (
          typeof exports.in_as_part !== 'function'
          || typeof exports.in_puppet_get_texture_cache !== 'function'
          || typeof exports.in_texture_cache_get_texture !== 'function'
          || typeof exports.in_part_set_texture !== 'function'
        ) {
          throw new Error('Slot assignment is unavailable through this Inochi WASM build');
        }

        const rootPointer = requirePointer(exports.in_puppet_get_root_node(this.pointer), 'root node lookup');
        const nodePointer = findNodePointer(exports, rootPointer, nodeName);
        if (nodePointer <= 0) throw new Error(`Unknown Inochi node: ${nodeName}`);
        const partPointer = requirePointer(exports.in_as_part(nodePointer), `part cast for ${nodeName}`);
        const cachePointer = requirePointer(exports.in_puppet_get_texture_cache(this.pointer), 'texture cache lookup');
        const texturePointer = requirePointer(exports.in_texture_cache_get_texture(cachePointer, textureIndex), `texture ${textureIndex} lookup`);
        if (!exports.in_part_set_texture(partPointer, attachment, texturePointer)) {
          throw new Error(`Inochi WASM part texture assignment failed for ${nodeName}`);
        }
        if (typeof exports.in_part_get_texture === 'function') {
          const observed = Number(exports.in_part_get_texture(partPointer, attachment));
          if (observed !== texturePointer) {
            throw new Error(`Inochi WASM part texture assignment readback failed for ${nodeName}`);
          }
        }
      }

      assignPartTint(nodeName: string, color: string): void {
        if (this.disposed) throw new Error('Inochi WASM puppet is disposed');
        if (typeof exports.in_as_part !== 'function' || typeof exports.in_part_set_tint !== 'function') {
          throw new Error('Part tint is unavailable through this Inochi WASM build');
        }
        const rootPointer = requirePointer(exports.in_puppet_get_root_node(this.pointer), 'root node lookup');
        const nodePointer = findNodePointer(exports, rootPointer, nodeName);
        if (nodePointer <= 0) throw new Error(`Unknown Inochi node: ${nodeName}`);
        const partPointer = requirePointer(exports.in_as_part(nodePointer), `part cast for ${nodeName}`);
        const [r, g, b] = parseHexRgb(color);
        if (!exports.in_part_set_tint(partPointer, r, g, b)) {
          throw new Error(`Inochi WASM part tint assignment failed for ${nodeName}`);
        }
        if (typeof exports.in_part_get_tint === 'function') {
          const readbackPointer = allocate(exports, 12, 'part tint readback allocation');
          try {
            exports.in_part_get_tint(partPointer, readbackPointer, readbackPointer + 4, readbackPointer + 8);
            const view = new DataView(exports.memory.buffer);
            const observed = [
              view.getFloat32(readbackPointer, true),
              view.getFloat32(readbackPointer + 4, true),
              view.getFloat32(readbackPointer + 8, true),
            ];
            if (observed.some((value, index) => Math.abs(value - [r, g, b][index]!) > 1e-5)) {
              throw new Error(`Inochi WASM part tint assignment readback failed for ${nodeName}`);
            }
          } finally {
            exports.nu_free(readbackPointer);
          }
        }
      }

      free(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.renderTextures.clear();
        exports.in_puppet_free(this.pointer);
      }
    },
  };
}

/**
 * Production composition for the MCP semantic service over the corrected
 * low-level WASM loader. `puppet.open` always resolves bytes + Away metadata
 * through `loadSource`, then loads those bytes through the real CFFI adapter.
 * Raw Inochi pointers/allocator functions remain confined to this module.
 */
export function createInochiWasmPuppetToolService(
  exports: InochiWasmRuntimeExports,
  loadSource: InochiWebSourceLoader,
  initialSource: string,
): AwayPuppetToolService {
  const lifecycle = createInochiWebLifecycle(createInochiWasmRuntimeModule(exports), loadSource);
  const initial = lifecycle.open(initialSource);
  return createAwayPuppetToolService(initial.puppet, {
    disposeInitial: initial.dispose,
    open: lifecycle.open,
  });
}