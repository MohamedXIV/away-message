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
  readonly tintAssignments: Array<{ partPointer: number; r: number; g: number; b: number }> = [];
  readonly textureAssignments: Array<{ partPointer: number; attachment: number; texturePointer: number }> = [];
  private readonly partTextures = new Map<string, number>();
  private readonly partTints = new Map<number, readonly [number, number, number]>();

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

  in_as_part(pointer: number): number { return pointer === 401 ? 501 : 0; }
  in_puppet_get_texture_cache(_pointer: number): number { return 600; }
  in_texture_cache_get_texture(_pointer: number, slot: number): number { return 700 + slot; }
  in_part_get_texture(partPointer: number, attachment: number): number {
    return this.partTextures.get(`${partPointer}:${attachment}`) ?? 0;
  }
  in_part_set_texture(partPointer: number, attachment: number, texturePointer: number): boolean {
    this.partTextures.set(`${partPointer}:${attachment}`, texturePointer);
    this.textureAssignments.push({ partPointer, attachment, texturePointer });
    return true;
  }
  in_part_get_tint(partPointer: number, rPointer: number, gPointer: number, bPointer: number): void {
    const [r, g, b] = this.partTints.get(partPointer) ?? [1, 1, 1];
    const view = new DataView(this.memory.buffer);
    view.setFloat32(rPointer, r, true);
    view.setFloat32(gPointer, g, true);
    view.setFloat32(bPointer, b, true);
  }
  in_part_set_tint(partPointer: number, r: number, g: number, b: number): boolean {
    this.partTints.set(partPointer, [r, g, b]);
    this.tintAssignments.push({ partPointer, r, g, b });
    return true;
  }
}


class FakeRenderWasmExports extends FakeWasmExports {
  readonly drawListPointer = 5000;
  readonly textureCachePointer = 6000;
  readonly texturePointer = 7000;
  readonly commandPointer = 8000;
  readonly vertexPointer = 9000;
  readonly indexPointer = 10000;
  readonly allocationPointer = 11000;
  readonly pixelPointer = 12000;
  texturePixelReads = 0;

  constructor() {
    super();
    const view = new DataView(this.memory.buffer);

    // in_drawcmd_t (WASM32): texture[8], state/blend/mask, alloc/vtx/idx/count/type, vars[64].
    view.setUint32(this.commandPointer, this.texturePointer, true);
    view.setUint32(this.commandPointer + 32, 0, true);
    view.setUint32(this.commandPointer + 36, 0, true);
    view.setUint32(this.commandPointer + 44, 0, true);
    view.setUint32(this.commandPointer + 48, 0, true);
    view.setUint32(this.commandPointer + 52, 0, true);
    view.setUint32(this.commandPointer + 56, 6, true);
    view.setUint32(this.commandPointer + 60, 0x0101, true);
    view.setFloat32(this.commandPointer + 64, 1, true);
    view.setFloat32(this.commandPointer + 68, 1, true);
    view.setFloat32(this.commandPointer + 72, 1, true);
    view.setFloat32(this.commandPointer + 92, 1, true);

    [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [1, 1, 1, 1],
      [-1, 1, 0, 1],
    ].forEach((vertex, index) => {
      const offset = this.vertexPointer + index * 16;
      vertex.forEach((value, component) => view.setFloat32(offset + component * 4, value, true));
    });
    [0, 1, 2, 0, 2, 3].forEach((value, index) => view.setUint32(this.indexPointer + index * 4, value, true));
    [0, 0, 6, 4, 0].forEach((value, index) => view.setUint32(this.allocationPointer + index * 4, value, true));
    new Uint8Array(this.memory.buffer, this.pixelPointer, 4).set([10, 20, 30, 255]);
  }

  in_puppet_update(_pointer: number, _deltaSeconds: number): void {}
  in_puppet_draw(_pointer: number, _deltaSeconds: number): void {}
  in_puppet_get_drawlist(_pointer: number): number { return this.drawListPointer; }
  in_drawlist_get_use_base_vertex(_pointer: number): boolean { return true; }
  in_drawlist_get_commands(_pointer: number, countPointer: number): number {
    new DataView(this.memory.buffer).setUint32(countPointer, 1, true);
    return this.commandPointer;
  }
  in_drawlist_get_vertex_data(_pointer: number, byteCountPointer: number): number {
    new DataView(this.memory.buffer).setUint32(byteCountPointer, 4 * 16, true);
    return this.vertexPointer;
  }
  in_drawlist_get_index_data(_pointer: number, byteCountPointer: number): number {
    new DataView(this.memory.buffer).setUint32(byteCountPointer, 6 * 4, true);
    return this.indexPointer;
  }
  in_drawlist_get_allocations(_pointer: number, countPointer: number): number {
    new DataView(this.memory.buffer).setUint32(countPointer, 1, true);
    return this.allocationPointer;
  }
  in_puppet_get_texture_cache(_pointer: number): number { return this.textureCachePointer; }
  in_texture_cache_get_size(_pointer: number): number { return 1; }
  in_texture_cache_get_texture(_pointer: number, _slot: number): number { return this.texturePointer; }
  in_texture_get_width(_pointer: number): number { return 1; }
  in_texture_get_height(_pointer: number): number { return 1; }
  in_texture_get_channels(_pointer: number): number { return 4; }
  in_texture_get_pixels(_pointer: number): number {
    this.texturePixelReads += 1;
    return this.pixelPointer;
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
  it('maps runtime part slot/tint mutations through proven CFFI extensions with readback', () => {
    const exports = new FakeWasmExports();
    const module = createInochiWasmRuntimeModule(exports);
    const puppet = new module.Puppet(new Uint8Array([1, 2, 3]).buffer);

    puppet.assignPartTexture?.('Hair', 3, 0);
    expect(exports.textureAssignments).toEqual([{ partPointer: 501, attachment: 0, texturePointer: 703 }]);

    puppet.assignPartTint?.('Hair', '#336699');
    expect(exports.tintAssignments).toHaveLength(1);
    expect(exports.tintAssignments[0]).toMatchObject({ partPointer: 501 });
    expect(exports.tintAssignments[0]?.r).toBeCloseTo(0x33 / 255);
    expect(exports.tintAssignments[0]?.g).toBeCloseTo(0x66 / 255);
    expect(exports.tintAssignments[0]?.b).toBeCloseTo(0x99 / 255);

    expect(() => puppet.assignPartTint?.('Hair', '#fff')).toThrow(/#RRGGBB/i);
    puppet.free();
  });

  it('fails closed when Part tint readback disagrees with the requested semantic color', () => {
    const exports = new FakeWasmExports();
    exports.in_part_get_tint = (_partPointer, rPointer, gPointer, bPointer) => {
      const view = new DataView(exports.memory.buffer);
      view.setFloat32(rPointer, 0, true);
      view.setFloat32(gPointer, 0, true);
      view.setFloat32(bPointer, 0, true);
    };
    const module = createInochiWasmRuntimeModule(exports);
    const puppet = new module.Puppet(new Uint8Array([1]).buffer);

    expect(() => puppet.assignPartTint?.('Hair', '#336699')).toThrow(/tint assignment readback failed/i);
    puppet.free();
  });

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

  it('copies render textures once, keeps JS-owned bytes stable, and never exposes source pointers', () => {
    const exports = new FakeRenderWasmExports();
    const module = createInochiWasmRuntimeModule(exports);
    const puppet = new module.Puppet(new Uint8Array([1, 2, 3]).buffer);

    const first = puppet.captureRenderFrame?.(16);
    if (!first) throw new Error('expected render frame');
    expect(first.textures[0]?.rgba).toEqual(new Uint8ClampedArray([10, 20, 30, 255]));
    expect(first.batches[0]).toMatchObject({
      textureId: 'inochi-texture-0',
      triangles: [0, 1, 2, 0, 2, 3],
    });
    expect(Object.keys(first.batches[0] ?? {})).not.toContain('sources');

    new Uint8Array(exports.memory.buffer, exports.pixelPointer, 4).set([200, 201, 202, 255]);
    const second = puppet.captureRenderFrame?.(16);
    if (!second) throw new Error('expected second render frame');

    expect(exports.texturePixelReads).toBe(1);
    expect(second.textures[0]?.rgba).toEqual(new Uint8ClampedArray([10, 20, 30, 255]));
    expect(second.textures[0]).toBe(first.textures[0]);

    puppet.free();
  });

});
