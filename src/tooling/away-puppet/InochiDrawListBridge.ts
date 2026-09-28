import type {
  CharacterMeshBlendMode,
  CharacterMeshFrame,
  CharacterMeshTexture,
} from '../../world/characterRenderer';

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


export const INOCHI_VERTEX_STRIDE = 16;
export const INOCHI_INDEX_STRIDE = 4;
const INOCHI_MAX_ATTACHMENTS = 8;

export interface InochiDrawCommand {
  readonly sources: readonly number[];
  readonly state: number;
  readonly blendMode: number;
  readonly maskMode: number;
  readonly allocId: number;
  readonly vtxOffset: number;
  readonly idxOffset: number;
  readonly elemCount: number;
  readonly type: number;
  readonly variables: Uint8Array;
}

export function decodeInochiDrawCommands(copied: Readonly<InochiCopiedDrawList>): InochiDrawCommand[] {
  if (copied.commandBytes.byteLength !== copied.commandCount * INOCHI_DRAW_COMMAND_STRIDE) {
    throw new Error('Inochi draw-command byte length does not match command count');
  }
  const view = new DataView(copied.commandBytes.buffer, copied.commandBytes.byteOffset, copied.commandBytes.byteLength);
  return Array.from({ length: copied.commandCount }, (_, commandIndex) => {
    const offset = commandIndex * INOCHI_DRAW_COMMAND_STRIDE;
    const sources = Array.from(
      { length: INOCHI_MAX_ATTACHMENTS },
      (_, sourceIndex) => view.getUint32(offset + sourceIndex * 4, true),
    );
    return {
      sources,
      state: view.getUint32(offset + 32, true),
      blendMode: view.getUint32(offset + 36, true),
      maskMode: view.getUint32(offset + 40, true),
      allocId: view.getUint32(offset + 44, true),
      vtxOffset: view.getUint32(offset + 48, true),
      idxOffset: view.getUint32(offset + 52, true),
      elemCount: view.getUint32(offset + 56, true),
      type: view.getUint32(offset + 60, true),
      variables: copied.commandBytes.slice(offset + 64, offset + 128),
    };
  });
}

export function decodeInochiTextureRgba(
  id: string,
  width: number,
  height: number,
  channels: number,
  pixels: Uint8Array,
): CharacterMeshTexture {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error(`Invalid Inochi texture dimensions for ${id}`);
  }
  if (![1, 2, 3, 4].includes(channels)) throw new Error(`Unsupported Inochi texture channel count: ${channels}`);
  const expected = width * height * channels;
  if (pixels.byteLength !== expected) throw new Error(`Inochi texture ${id} pixel byte length mismatch`);

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let source = 0, target = 0; source < pixels.length; source += channels, target += 4) {
    const a = channels === 2 ? pixels[source + 1]! : channels === 4 ? pixels[source + 3]! : 255;
    if (channels === 1 || channels === 2) {
      const luminance = pixels[source]!;
      rgba[target] = luminance;
      rgba[target + 1] = luminance;
      rgba[target + 2] = luminance;
    } else {
      rgba[target] = pixels[source]!;
      rgba[target + 1] = pixels[source + 1]!;
      rgba[target + 2] = pixels[source + 2]!;
    }
    rgba[target + 3] = a;
  }
  return { id, width, height, rgba };
}

function toHexChannel(value: number): string {
  const byte = Math.max(0, Math.min(255, Math.round(value * 255)));
  return byte.toString(16).padStart(2, '0');
}

function decodePartVariables(bytes: Uint8Array): { tint: string; alpha: number } {
  if (bytes.byteLength < 36) return { tint: '#ffffff', alpha: 1 };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = view.getFloat32(0, true);
  const g = view.getFloat32(4, true);
  const b = view.getFloat32(8, true);
  const opacity = view.getFloat32(28, true);
  const finiteTint = [r, g, b].every(Number.isFinite);
  return {
    tint: finiteTint ? `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}` : '#ffffff',
    alpha: Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1,
  };
}

function decodeBlendMode(value: number): CharacterMeshBlendMode {
  switch (value) {
    case 0x00: return 'normal';
    case 0x01: return 'multiply';
    case 0x02: return 'screen';
    case 0x08: return 'add';
    default: throw new Error(`Unsupported Inochi blend mode for Phaser character surface: 0x${value.toString(16)}`);
  }
}

function decodeVertices(bytes: Uint8Array): number[] {
  if (bytes.byteLength % INOCHI_VERTEX_STRIDE !== 0) throw new Error('Invalid Inochi vertex byte length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: number[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += INOCHI_VERTEX_STRIDE) {
    result.push(
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
      view.getFloat32(offset + 12, true),
    );
  }
  return result;
}

function decodeIndices(bytes: Uint8Array): number[] {
  if (bytes.byteLength % INOCHI_INDEX_STRIDE !== 0) throw new Error('Invalid Inochi index byte length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: number[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += INOCHI_INDEX_STRIDE) {
    result.push(view.getUint32(offset, true));
  }
  return result;
}

/**
 * Converts the pinned Inochi renderer ABI into the game-owned mesh frame.
 *
 * This intentionally fails closed for mask/composite draw states and blend
 * modes the Phaser surface does not reproduce yet; silently flattening those
 * states would make a puppet look "mostly right" while corrupting its art.
 */
export function convertInochiDrawListToCharacterFrame(
  copied: Readonly<InochiCopiedDrawList>,
  texturesByPointer: ReadonlyMap<number, CharacterMeshTexture>,
): CharacterMeshFrame {
  const commands = decodeInochiDrawCommands(copied);
  const vertices = decodeVertices(copied.vertexBytes);
  const indices = decodeIndices(copied.indexBytes);
  const allocations = new Map(copied.allocations.map((allocation) => [allocation.allocId, allocation]));

  const batches = commands.map((command, commandIndex) => {
    if (command.state !== 0) {
      throw new Error(`Unsupported Inochi draw state ${command.state} at command ${commandIndex}; mask/composite support is required`);
    }
    const allocation = allocations.get(command.allocId);
    if (!allocation) throw new Error(`Missing Inochi draw allocation ${command.allocId}`);
    if (command.vtxOffset !== allocation.vtxOffset) {
      throw new Error(`Inochi draw command ${commandIndex} vertex offset does not match allocation`);
    }
    if (command.idxOffset + command.elemCount > indices.length) {
      throw new Error(`Inochi draw command ${commandIndex} index range is out of bounds`);
    }

    const texturePointer = command.sources[0] ?? 0;
    if (texturePointer <= 0) throw new Error(`Inochi draw command ${commandIndex} has no primary texture`);
    const texture = texturesByPointer.get(texturePointer);
    if (!texture) throw new Error(`Inochi draw command ${commandIndex} references unknown texture pointer`);

    const vertexStart = allocation.vtxOffset * 4;
    const vertexEnd = vertexStart + allocation.vtxCount * 4;
    if (vertexEnd > vertices.length) throw new Error(`Inochi allocation ${allocation.allocId} vertex range is out of bounds`);

    const commandIndices = indices.slice(command.idxOffset, command.idxOffset + command.elemCount);
    const triangles = commandIndices.map((index) => copied.useBaseVertex ? index : index - allocation.vtxOffset);
    if (triangles.some((index) => index < 0 || index >= allocation.vtxCount)) {
      throw new Error(`Inochi draw command ${commandIndex} contains an out-of-range mesh index`);
    }
    const variables = decodePartVariables(command.variables);

    return {
      id: `inochi-${commandIndex}-${command.allocId}`,
      textureId: texture.id,
      vertices: vertices.slice(vertexStart, vertexEnd),
      triangles,
      tint: variables.tint,
      alpha: variables.alpha,
      blendMode: decodeBlendMode(command.blendMode),
    };
  });

  const usedTextures = new Map<string, CharacterMeshTexture>();
  for (const command of commands) {
    const texture = texturesByPointer.get(command.sources[0] ?? 0);
    if (texture) usedTextures.set(texture.id, texture);
  }
  return { textures: [...usedTextures.values()], batches };
}
