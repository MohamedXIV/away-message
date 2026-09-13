import { describe, expect, it } from 'vitest';
import {
  allocatePuppetInputOrThrow,
  assertAcceptedWasmHash,
  bootstrapAndAllocatePuppetInput,
  readWasmCString,
  readWasmPointerArray,
  resolveProbeFixture,
  resolveProbeMode,
  writeWasmFloatArray,
} from '../../scripts/probe-inochi-wasm-load';

describe('Inochi WASM real-byte probe safety (#34)', () => {
  it('fails closed before writing puppet bytes when the upstream allocator returns null', () => {
    const calls: number[] = [];
    const api = {
      nu_malloc(size: number): number {
        calls.push(size);
        return 0;
      },
    };

    expect(() => allocatePuppetInputOrThrow(api, 512)).toThrow(
      /allocator refused 512 bytes/i,
    );
    expect(calls).toEqual([512]);
  });

  it('returns the allocated pointer unchanged when allocation succeeds', () => {
    const api = {
      nu_malloc(size: number): number {
        expect(size).toBe(128);
        return 4096;
      },
    };

    expect(allocatePuppetInputOrThrow(api, 128)).toBe(4096);
  });

  it('bootstraps Inochi scratch memory before allocating real puppet input', () => {
    const calls: string[] = [];
    const api = {
      in_init(): void {
        calls.push('init');
      },
      nu_realloc(pointer: number, bytes: number): number {
        calls.push(`scratch:${pointer}:${bytes}`);
        return 2048;
      },
      nu_malloc(size: number): number {
        calls.push(`input:${size}`);
        return 4096;
      },
    };

    expect(bootstrapAndAllocatePuppetInput(api, 512)).toEqual({
      sourcePointer: 4096,
      scratchpad: { pointer: 2048, size: 128 },
    });
    expect(calls).toEqual(['init', 'scratch:0:128', 'input:512']);
  });

  it('keeps the published artifact hash pinned unless candidate mode is explicit', () => {
    expect(() => assertAcceptedWasmHash('candidate-hash', false)).toThrow(/unexpected wasm sha256/i);
    expect(() => assertAcceptedWasmHash('candidate-hash', true)).not.toThrow();
  });

  it('accepts an explicit upstream fixture path without weakening the embedded fallback', () => {
    expect(resolveProbeFixture(['candidate.wasm'])).toEqual({ path: undefined, label: 'Inochi2D/inochi2d examples/empty08.inx' });
    expect(resolveProbeFixture(['candidate.wasm', '--fixture', '.tmp/inochi2d/examples/ada-static.inx'])).toEqual({
      path: '.tmp/inochi2d/examples/ada-static.inx',
      label: '.tmp/inochi2d/examples/ada-static.inx',
    });
  });

  it('keeps the proven Ada inventory gate green while deeper parameter modes remain explicit', () => {
    expect(resolveProbeMode(['candidate.wasm'])).toBe('load');
    expect(resolveProbeMode(['candidate.wasm', '--fixture', 'ada.inx'])).toBe('inventory');
    expect(resolveProbeMode(['candidate.wasm', '--fixture', 'ada.inx', '--parameter-read-proof'])).toBe('parameter-read');
    expect(resolveProbeMode(['candidate.wasm', '--fixture', 'ada.inx', '--mutation-proof'])).toBe('mutation');
    expect(resolveProbeMode(['candidate.wasm', '--fixture', 'ada.inx', '--runtime-proof'])).toBe('runtime');
  });

  it('decodes detached C strings and wasm32 pointer arrays without exposing raw memory to callers', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    new Uint8Array(memory.buffer, 32, 4).set([65, 100, 97, 0]);
    new Uint32Array(memory.buffer, 64, 3).set([128, 256, 512]);

    expect(readWasmCString(memory, 32)).toBe('Ada');
    expect(readWasmPointerArray(memory, 64, 3)).toEqual([128, 256, 512]);
  });

  it('writes deterministic float payloads without assuming WASM pointer alignment', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    writeWasmFloatArray(memory, 97, [0.25, -0.5]);
    const view = new DataView(memory.buffer);
    expect(view.getFloat32(97, true)).toBe(0.25);
    expect(view.getFloat32(101, true)).toBe(-0.5);
  });
});
