export const INOCHI_DRAW_COMMAND_STRIDE = 128;
const INOCHI_DRAW_ALLOCATION_STRIDE = 20;

export interface InochiDrawListRawApi {
  readonly memory: WebAssembly.Memory;
  alloc(bytes: number): number;
  free(ptr: number): void;
  getUseBaseVertex(drawListPtr: number): boolean;
  getCommands(drawListPtr: number, countPtr: number): number;
  getVertexData(drawListPtr: number, byteCountPtr: number): number;
  getIndexData(drawListPtr: number, byteCountPtr: number): number;
  getAllocations(drawListPtr: number, countPtr: number): number;
}

export interface InochiDrawAllocation {
  readonly vtxOffset: number;
  readonly idxOffset: number;
  readonly idxCount: number;
  readonly vtxCount: number;
  readonly allocId: number;
}

export interface InochiCopiedDrawList {
  readonly useBaseVertex: boolean;
  readonly commandCount: number;
  readonly commandBytes: Uint8Array;
  readonly vertexBytes: Uint8Array;
  readonly indexBytes: Uint8Array;
  readonly allocations: InochiDrawAllocation[];
}

function checkedByteLength(count: number, stride: number, label: string): number {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Invalid Inochi ${label} count: ${count}`);
  const bytes = count * stride;
  if (!Number.isSafeInteger(bytes)) throw new Error(`Inochi ${label} byte length overflow`);
  return bytes;
}

function copyBytes(memory: WebAssembly.Memory, ptr: number, byteLength: number, label: string): Uint8Array {
  if (byteLength === 0) return new Uint8Array();
  if (!Number.isSafeInteger(ptr) || ptr <= 0) throw new Error(`Inochi ${label} returned a null/invalid pointer for ${byteLength} bytes`);
  if (ptr + byteLength > memory.buffer.byteLength) throw new Error(`Inochi ${label} range exceeds WASM memory`);
  return new Uint8Array(new Uint8Array(memory.buffer, ptr, byteLength));
}

function readOutUint32(memory: WebAssembly.Memory, ptr: number): number {
  return new DataView(memory.buffer).getUint32(ptr, true);
}

function copyCountedBytes(
  raw: InochiDrawListRawApi,
  drawListPtr: number,
  getter: (drawListPtr: number, outPtr: number) => number,
  stride: number,
  label: string,
): { count: number; bytes: Uint8Array } {
  const outPtr = raw.alloc(4);
  try {
    new DataView(raw.memory.buffer).setUint32(outPtr, 0, true);
    const dataPtr = getter(drawListPtr, outPtr);
    const count = readOutUint32(raw.memory, outPtr);
    return { count, bytes: copyBytes(raw.memory, dataPtr, checkedByteLength(count, stride, label), label) };
  } finally {
    raw.free(outPtr);
  }
}

function copySizedBytes(
  raw: InochiDrawListRawApi,
  drawListPtr: number,
  getter: (drawListPtr: number, outPtr: number) => number,
  label: string,
): Uint8Array {
  const outPtr = raw.alloc(4);
  try {
    new DataView(raw.memory.buffer).setUint32(outPtr, 0, true);
    const dataPtr = getter(drawListPtr, outPtr);
    const byteLength = readOutUint32(raw.memory, outPtr);
    return copyBytes(raw.memory, dataPtr, checkedByteLength(byteLength, 1, label), label);
  } finally {
    raw.free(outPtr);
  }
}

function parseAllocations(bytes: Uint8Array): InochiDrawAllocation[] {
  if (bytes.byteLength % INOCHI_DRAW_ALLOCATION_STRIDE !== 0) throw new Error('Invalid Inochi draw-allocation byte length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: InochiDrawAllocation[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += INOCHI_DRAW_ALLOCATION_STRIDE) {
    result.push({
      vtxOffset: view.getUint32(offset, true),
      idxOffset: view.getUint32(offset + 4, true),
      idxCount: view.getUint32(offset + 8, true),
      vtxCount: view.getUint32(offset + 12, true),
      allocId: view.getUint32(offset + 16, true),
    });
  }
  return result;
}

/**
 * Copies the renderer-facing draw-list payload out of the Inochi WASM heap.
 * Raw pointers and allocator handles stop at this boundary; callers receive
 * detached JS-owned bytes plus decoded allocation metadata only.
 *
 * The 128-byte command and 20-byte allocation layouts are pinned to the
 * upstream `include/inochi2d.h` ABI inspected for Issue #34.
 */
export function copyInochiDrawList(raw: InochiDrawListRawApi, drawListPtr: number): InochiCopiedDrawList {
  if (!Number.isSafeInteger(drawListPtr) || drawListPtr <= 0) throw new Error('Inochi draw-list pointer must be a positive integer');

  const commands = copyCountedBytes(raw, drawListPtr, raw.getCommands.bind(raw), INOCHI_DRAW_COMMAND_STRIDE, 'draw-command');
  const vertexBytes = copySizedBytes(raw, drawListPtr, raw.getVertexData.bind(raw), 'vertex-data');
  const indexBytes = copySizedBytes(raw, drawListPtr, raw.getIndexData.bind(raw), 'index-data');
  const allocationData = copyCountedBytes(raw, drawListPtr, raw.getAllocations.bind(raw), INOCHI_DRAW_ALLOCATION_STRIDE, 'draw-allocation');

  return {
    useBaseVertex: raw.getUseBaseVertex(drawListPtr),
    commandCount: commands.count,
    commandBytes: commands.bytes,
    vertexBytes,
    indexBytes,
    allocations: parseAllocations(allocationData.bytes),
  };
}
