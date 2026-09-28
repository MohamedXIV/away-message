import { describe, expect, it } from 'vitest';
import {
  copyInochiDrawList,
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
