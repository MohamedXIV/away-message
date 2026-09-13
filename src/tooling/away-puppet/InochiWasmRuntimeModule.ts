import { bootstrapInochiWebModule, type InochiWebBootstrapExports } from './InochiWebModuleBootstrap';
import type {
  InochiWebRuntimeModule,
  InochiWebRuntimeNode,
  InochiWebRuntimeParameter,
  InochiWebRuntimePuppet,
} from './InochiWebLifecycle';

export interface InochiWasmRuntimeExports extends InochiWebBootstrapExports {
  readonly memory: WebAssembly.Memory;
  nu_malloc(bytes: number): number | bigint;
  nu_free(pointer: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(pointer: number): void;
  in_puppet_get_parameters(pointer: number, countPointer: number): number | bigint;
  in_puppet_get_root_node(pointer: number): number | bigint;
  in_parameter_get_name(pointer: number): number | bigint;
  in_parameter_get_dimensions(pointer: number): number;
  in_parameter_get_value(pointer: number): number | bigint;
  in_parameter_set_value(pointer: number, valuesPointer: number): void;
  in_node_get_name(pointer: number): number | bigint;
  in_node_get_enabled(pointer: number): boolean;
  in_node_set_enabled(pointer: number, value: boolean): void;
  in_node_get_children(pointer: number, countPointer: number): number | bigint;
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

      free(): void {
        if (this.disposed) return;
        this.disposed = true;
        exports.in_puppet_free(this.pointer);
      }
    },
  };
}