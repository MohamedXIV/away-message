export interface WasmFloatPointerInspection {
  readonly pointer: number;
  readonly byteLength: number;
  readonly rawHex: string;
  readonly values: readonly number[];
}

export function inspectWasmFloatPointer(
  memory: WebAssembly.Memory,
  pointer: number,
  count: number,
): WasmFloatPointerInspection {
  if (!Number.isSafeInteger(pointer) || pointer <= 0) {
    throw new Error(`invalid WASM float pointer ${pointer}`);
  }
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`invalid WASM float count ${count}`);
  }

  const byteLength = count * 4;
  if (pointer + byteLength > memory.buffer.byteLength) {
    throw new Error(
      `WASM float pointer ${pointer} with ${byteLength} bytes exceeds memory size ${memory.buffer.byteLength}`,
    );
  }

  const bytes = new Uint8Array(memory.buffer, pointer, byteLength);
  const view = new DataView(memory.buffer, pointer, byteLength);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(view.getFloat32(index * 4, true));
  }

  return {
    pointer,
    byteLength,
    rawHex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    values,
  };
}
