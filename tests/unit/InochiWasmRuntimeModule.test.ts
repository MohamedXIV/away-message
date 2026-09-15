import { describe, expect, it } from 'vitest';
import {
  createInochiWasmPuppetToolService,
  createInochiWasmRuntimeModule,
} from '../../src/tooling/away-puppet/InochiWasmRuntimeModule';
import type { AwayRigMetadata } from '../../src/tooling/away-puppet/SemanticPuppet';

class FakeWasmExports {
  readonly memory = new WebAssembly.Memory({ initial: 1 });
  private next = 1024;
  private readonly names = new Map<number, number>();
  private readonly values = new Map<number, number>();
  private readonly enabled = new Map<number, boolean>([[400, true], [401, true]]);
  readonly freedPuppets: number[] = [];
  readonly loadedBytes: number[][] = [];

  constructor() {
    this.names.set(300, this.writeCString('Body Mass'));
    this.names.set(400, this.writeCString('Root'));
    this.names.set(401, this.writeCString('Hair'));
    this.values.set(300, 0);
  }

  private alloc(bytes: number): number {
    const pointer = this.next;
    this.next += Math.max(bytes, 4);
    return pointer;
  }

  private writeCString(value: string): number {
    const bytes = new TextEncoder().encode(`${value}\0`);
    const pointer = this.alloc(bytes.length);
    new Uint8Array(this.memory.buffer, pointer, bytes.length).set(bytes);
    return pointer;
  }

  in_init(): void {}
  nu_realloc(_pointer: number, bytes: number): number { return this.alloc(bytes); }
  nu_malloc(bytes: number): number { return this.alloc(bytes); }
  nu_free(_pointer: number): void {}

  in_puppet_load_from_memory(pointer: number, length: number): number {
    this.loadedBytes.push(Array.from(new Uint8Array(this.memory.buffer, pointer, length)));
    return 200;
  }
  in_puppet_free(pointer: number): void { this.freedPuppets.push(pointer); }
  in_puppet_get_parameters(_pointer: number, countPointer: number): number {
    new DataView(this.memory.buffer).setUint32(countPointer, 1, true);
    const array = this.alloc(4);
    new DataView(this.memory.buffer).setUint32(array, 300, true);
    return array;
  }
  in_puppet_get_root_node(_pointer: number): number { return 400; }

  in_parameter_get_name(pointer: number): number { return this.names.get(pointer) ?? 0; }
  in_parameter_get_dimensions(_pointer: number): number { return 1; }
  in_parameter_get_value(pointer: number): number {
    const out = this.alloc(4);
    new DataView(this.memory.buffer).setFloat32(out, this.values.get(pointer) ?? 0, true);
    return out;
  }
  in_parameter_set_value(pointer: number, valuesPointer: number): void {
    this.values.set(pointer, new DataView(this.memory.buffer).getFloat32(valuesPointer, true));
  }

  in_node_get_name(pointer: number): number { return this.names.get(pointer) ?? 0; }
  in_node_get_enabled(pointer: number): boolean { return this.enabled.get(pointer) ?? false; }
  in_node_set_enabled(pointer: number, value: boolean): void { this.enabled.set(pointer, value); }
  in_node_get_children(pointer: number, countPointer: number): number {
    const children = pointer === 400 ? [401] : [];
    new DataView(this.memory.buffer).setUint32(countPointer, children.length, true);
    if (children.length === 0) return 0;
    const array = this.alloc(children.length * 4);
    children.forEach((child, index) => new DataView(this.memory.buffer).setUint32(array + index * 4, child, true));
    return array;
  }
}

const metadata: AwayRigMetadata = {
  namespace: 'away-message/puppet',
  contractVersion: 1,
  morphs: {
    'body.mass': { parameterId: 'Body Mass', min: -1, max: 1, default: 0 },
  },
  slots: {
    'hair.front': { nodeId: 'Hair' },
  },
  tints: {},
  expressions: {},
  poses: {},
};

describe('corrected low-level Inochi WASM runtime module (#34)', () => {
  it('loads real bytes through CFFI shape and exposes semantic wrapper-compatible parameters/nodes', () => {
    const exports = new FakeWasmExports();
    const module = createInochiWasmRuntimeModule(exports);
    const puppet = new module.Puppet(new Uint8Array([7, 8, 9]).buffer);

    expect(exports.loadedBytes).toEqual([[7, 8, 9]]);
    expect(puppet.parameters.map((parameter) => parameter.name)).toEqual(['Body Mass']);
    expect(puppet.parameters[0]?.value).toEqual([0]);

    if (!puppet.parameters[0]) throw new Error('expected parameter');
    puppet.parameters[0].value = [0.75];
    expect(puppet.parameters[0].value[0]).toBeCloseTo(0.75);

    expect(puppet.root?.name).toBe('Root');
    expect(puppet.root?.children[0]?.name).toBe('Hair');
    if (!puppet.root?.children[0]) throw new Error('expected child node');
    puppet.root.children[0].enabled = false;
    expect(puppet.root.children[0].enabled).toBe(false);

    puppet.free();
    puppet.free();
    expect(exports.freedPuppets).toEqual([200]);
  });

  it('fails closed when the real loader returns a null puppet pointer', () => {
    const exports = new FakeWasmExports();
    exports.in_puppet_load_from_memory = () => 0;
    const module = createInochiWasmRuntimeModule(exports);

    expect(() => new module.Puppet(new Uint8Array([1]).buffer)).toThrow(/load.*failed/i);
  });

  it('wires puppet.open directly through the corrected WASM loader without exposing raw ids', () => {
    const exports = new FakeWasmExports();
    const sources = new Map<string, number[]>([
      ['first.inp', [1, 2, 3]],
      ['second.inp', [9, 8, 7]],
    ]);
    const service = createInochiWasmPuppetToolService(
      exports,
      (source) => {
        const bytes = sources.get(source);
        if (!bytes) throw new Error(`Unknown fixture: ${source}`);
        return { source, bytes: new Uint8Array(bytes).buffer, metadata };
      },
      'first.inp',
    );

    expect(exports.loadedBytes).toEqual([[1, 2, 3]]);
    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0 });
    expect(service.call('puppet.open', { source: 'second.inp' })).toMatchObject({ ok: true, source: 'second.inp' });
    expect(exports.loadedBytes).toEqual([[1, 2, 3], [9, 8, 7]]);
    expect(exports.freedPuppets).toEqual([200]);

    expect(service.listTools()).not.toContain('nu_malloc');
    expect(service.listTools()).not.toContain('in_puppet_load_from_memory');
    service.dispose();
    expect(exports.freedPuppets).toEqual([200, 200]);
  });
});
