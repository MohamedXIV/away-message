export interface InochiWebBootstrapExports {
  in_init(): void;
  nu_realloc(pointer: number, bytes: number): number | bigint;
}

export interface InochiWebScratchpad {
  readonly pointer: number;
  readonly size: number;
}

export interface InochiWebBootstrapState {
  readonly scratchpad: InochiWebScratchpad;
}

const INITIAL_SCRATCHPAD_BYTES = 128;

function requireValidPointer(pointer: number | bigint, operation: string): number {
  const value = Number(pointer);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Inochi Web ${operation} failed: allocator returned an invalid pointer`);
  }
  return value;
}

/**
 * Establishes the raw Inochi WASM runtime before allocating wrapper scratch
 * memory. This intentionally avoids upstream core.ts' one-phase initializer,
 * which calls scrptr() while __inochi2d is still being assigned.
 *
 * The returned state contains no model-facing raw API. It is an internal
 * bootstrap boundary for a corrected loader adapter only.
 */
export function bootstrapInochiWebModule(exports: InochiWebBootstrapExports): InochiWebBootstrapState {
  exports.in_init();
  const pointer = requireValidPointer(
    exports.nu_realloc(0, INITIAL_SCRATCHPAD_BYTES),
    'scratchpad allocation',
  );

  return {
    scratchpad: {
      pointer,
      size: INITIAL_SCRATCHPAD_BYTES,
    },
  };
}
