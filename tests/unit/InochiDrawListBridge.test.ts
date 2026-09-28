import { describe, expect, it } from 'vitest';
import {
  copyInochiDrawList,
  convertInochiDrawListToCharacterFrame,
  decodeInochiTextureRgba,
  INOCHI_DRAW_COMMAND_STRIDE,
  type InochiDrawListRawApi,
} from '../../src/tooling/away-puppet/InochiDrawListBridge';

function makeRawFixture() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  let nextScratch = 0x100;
  const freed: number[] = [];

  const commandPtr = 0x400;
  const vertexPtr = 0x800;
  const indexPtr = 0x900;
  const allocationPtr = 0xa00;

  new Uint8Array(memory.buffer, commandPtr, INOCHI_DRAW_COMMAND_STRIDE * 2).fill(0x11);
  new Uint8Array(memory.buffer, vertexPtr, 12).set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  new Uint8Array(memory.buffer, indexPtr, 6).set([21, 22, 23, 24, 25, 26]);

  // in_drawalloc_t: vtxOffset, idxOffset, idxCount, vtxCount, allocId
  [4, 8, 6, 3, 77].forEach((value, i) => view.setUint32(allocationPtr + i * 4, value, true));

  const raw: InochiDrawListRawApi = {
    memory,
    alloc(bytes) {
      const ptr = nextScratch;
      nextScratch += bytes;
      return ptr;
    },
    free(ptr) { freed.push(ptr); },
    getUseBaseVertex() { return true; },
    getCommands(_drawList, countPtr) {
      view.setUint32(countPtr, 2, true);
      return commandPtr;
    },
    getVertexData(_drawList, bytesPtr) {
      view.setUint32(bytesPtr, 12, true);
      return vertexPtr;
    },
    getIndexData(_drawList, bytesPtr) {
      view.setUint32(bytesPtr, 6, true);
      return indexPtr;
    },
    getAllocations(_drawList, countPtr) {
      view.setUint32(countPtr, 1, true);
      return allocationPtr;
    },
  };

  return { raw, freed, commandPtr, vertexPtr };
}

describe('Inochi draw-list bridge', () => {
  it('copies renderer data out of WASM memory without leaking raw pointers', () => {
    const { raw, freed, commandPtr, vertexPtr } = makeRawFixture();

    const result = copyInochiDrawList(raw, 0x2a);

    expect(result.useBaseVertex).toBe(true);
    expect(result.commandCount).toBe(2);
    expect(result.commandBytes).toHaveLength(INOCHI_DRAW_COMMAND_STRIDE * 2);
    expect(result.vertexBytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
    expect(result.indexBytes).toEqual(new Uint8Array([21, 22, 23, 24, 25, 26]));
    expect(result.allocations).toEqual([{ vtxOffset: 4, idxOffset: 8, idxCount: 6, vtxCount: 3, allocId: 77 }]);
    expect(freed).toHaveLength(4);

    new Uint8Array(raw.memory.buffer, commandPtr, 1)[0] = 0xff;
    new Uint8Array(raw.memory.buffer, vertexPtr, 1)[0] = 0xff;
    expect(result.commandBytes[0]).toBe(0x11);
    expect(result.vertexBytes[0]).toBe(1);
    expect(JSON.stringify(result)).not.toContain(String(commandPtr));
    expect(JSON.stringify(result)).not.toContain(String(vertexPtr));
  });

  it('returns stable empty copies for zero-length renderer buffers', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const view = new DataView(memory.buffer);
    let nextScratch = 0x100;
    const freed: number[] = [];
    const raw: InochiDrawListRawApi = {
      memory,
      alloc(bytes) { const ptr = nextScratch; nextScratch += bytes; return ptr; },
      free(ptr) { freed.push(ptr); },
      getUseBaseVertex() { return false; },
      getCommands(_drawList, out) { view.setUint32(out, 0, true); return 0; },
      getVertexData(_drawList, out) { view.setUint32(out, 0, true); return 0; },
      getIndexData(_drawList, out) { view.setUint32(out, 0, true); return 0; },
      getAllocations(_drawList, out) { view.setUint32(out, 0, true); return 0; },
    };

    expect(copyInochiDrawList(raw, 7)).toEqual({
      useBaseVertex: false,
      commandCount: 0,
      commandBytes: new Uint8Array(),
      vertexBytes: new Uint8Array(),
      indexBytes: new Uint8Array(),
      allocations: [],
    });
    expect(freed).toHaveLength(4);
  });
});


describe('Inochi draw-list -> CharacterMeshFrame', () => {
  it('decodes a normal textured part command into renderer-neutral triangles', () => {
    const commandBytes = new Uint8Array(INOCHI_DRAW_COMMAND_STRIDE);
    const command = new DataView(commandBytes.buffer);
    command.setUint32(0, 0x700, true); // primary texture pointer
    command.setUint32(32, 0, true); // IN_DRAW_STATE_NORMAL
    command.setUint32(36, 0, true); // normal blend
    command.setUint32(44, 42, true);
    command.setUint32(48, 0, true);
    command.setUint32(52, 0, true);
    command.setUint32(56, 6, true);
    command.setUint32(60, 0x0101, true); // Part type
    command.setFloat32(64, 1, true);
    command.setFloat32(68, 0.5, true);
    command.setFloat32(72, 0.25, true);
    command.setFloat32(92, 0.75, true); // PartVars opacity

    const vertexBytes = new Uint8Array(4 * 16);
    const vertices = new DataView(vertexBytes.buffer);
    [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [1, 1, 1, 1],
      [-1, 1, 0, 1],
    ].forEach((vertex, index) => {
      const offset = index * 16;
      vertex.forEach((value, component) => vertices.setFloat32(offset + component * 4, value, true));
    });

    const indexBytes = new Uint8Array(6 * 4);
    const indices = new DataView(indexBytes.buffer);
    [0, 1, 2, 0, 2, 3].forEach((value, index) => indices.setUint32(index * 4, value, true));

    const texture = decodeInochiTextureRgba(
      'fixture-texture',
      1,
      1,
      4,
      new Uint8Array([255, 255, 255, 255]),
    );
    const frame = convertInochiDrawListToCharacterFrame({
      useBaseVertex: true,
      commandCount: 1,
      commandBytes,
      vertexBytes,
      indexBytes,
      allocations: [{ vtxOffset: 0, idxOffset: 0, idxCount: 6, vtxCount: 4, allocId: 42 }],
    }, new Map([[0x700, texture]]));

    expect(frame.textures).toEqual([texture]);
    expect(frame.batches).toHaveLength(1);
    expect(frame.batches[0]).toMatchObject({
      id: 'inochi-0-42',
      textureId: 'fixture-texture',
      triangles: [0, 1, 2, 0, 2, 3],
      tint: '#ff8040',
      alpha: 0.75,
      blendMode: 'normal',
    });
    expect(frame.batches[0]?.vertices).toEqual([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      1, 1, 1, 1,
      -1, 1, 0, 1,
    ]);
  });

  it('fails closed for mask/composite states instead of flattening them incorrectly', () => {
    const commandBytes = new Uint8Array(INOCHI_DRAW_COMMAND_STRIDE);
    const command = new DataView(commandBytes.buffer);
    command.setUint32(0, 0x700, true);
    command.setUint32(32, 1, true); // DEFINE_MASK
    command.setUint32(44, 1, true);
    command.setUint32(60, 0x0101, true);

    expect(() => convertInochiDrawListToCharacterFrame({
      useBaseVertex: true,
      commandCount: 1,
      commandBytes,
      vertexBytes: new Uint8Array(),
      indexBytes: new Uint8Array(),
      allocations: [{ vtxOffset: 0, idxOffset: 0, idxCount: 0, vtxCount: 0, allocId: 1 }],
    }, new Map([[0x700, decodeInochiTextureRgba('t', 1, 1, 4, new Uint8Array([255, 255, 255, 255]))]])))
      .toThrow(/mask\/composite support is required/i);
  });
});



  it('respects non-zero allocation vertex/index offsets without leaking prefix data', () => {
    const commandBytes = new Uint8Array(INOCHI_DRAW_COMMAND_STRIDE);
    const command = new DataView(commandBytes.buffer);
    command.setUint32(0, 0x700, true);
    command.setUint32(44, 9, true);
    command.setUint32(48, 2, true);
    command.setUint32(52, 3, true);
    command.setUint32(56, 6, true);
    command.setUint32(60, 0x0101, true);
    command.setFloat32(64, 1, true);
    command.setFloat32(68, 1, true);
    command.setFloat32(72, 1, true);
    command.setFloat32(92, 1, true);

    const vertexBytes = new Uint8Array(6 * 16);
    const vertexView = new DataView(vertexBytes.buffer);
    const vertices = [
      [-99, -99, 0, 0],
      [-88, -88, 0, 0],
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [1, 1, 1, 1],
      [-1, 1, 0, 1],
    ];
    vertices.forEach((vertex, index) => vertex.forEach(
      (value, component) => vertexView.setFloat32(index * 16 + component * 4, value, true),
    ));

    const indexBytes = new Uint8Array(9 * 4);
    const indexView = new DataView(indexBytes.buffer);
    [77, 78, 79, 0, 1, 2, 0, 2, 3].forEach(
      (value, index) => indexView.setUint32(index * 4, value, true),
    );

    const texture = decodeInochiTextureRgba('fixture-texture', 1, 1, 4, new Uint8Array([255, 255, 255, 255]));
    const frame = convertInochiDrawListToCharacterFrame({
      useBaseVertex: true,
      commandCount: 1,
      commandBytes,
      vertexBytes,
      indexBytes,
      allocations: [{ vtxOffset: 2, idxOffset: 3, idxCount: 6, vtxCount: 4, allocId: 9 }],
    }, new Map([[0x700, texture]]));

    expect(frame.batches[0]?.vertices).toEqual([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      1, 1, 1, 1,
      -1, 1, 0, 1,
    ]);
    expect(frame.batches[0]?.triangles).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('fails closed for non-base-vertex draw lists instead of guessing index rebasing', () => {
    const commandBytes = new Uint8Array(INOCHI_DRAW_COMMAND_STRIDE);
    const command = new DataView(commandBytes.buffer);
    command.setUint32(0, 0x700, true);
    command.setUint32(44, 1, true);
    command.setUint32(60, 0x0101, true);

    expect(() => convertInochiDrawListToCharacterFrame({
      useBaseVertex: false,
      commandCount: 1,
      commandBytes,
      vertexBytes: new Uint8Array(),
      indexBytes: new Uint8Array(),
      allocations: [{ vtxOffset: 0, idxOffset: 0, idxCount: 0, vtxCount: 0, allocId: 1 }],
    }, new Map([[0x700, decodeInochiTextureRgba('t', 1, 1, 4, new Uint8Array([255, 255, 255, 255]))]])))
      .toThrow(/without base-vertex indices/i);
  });
