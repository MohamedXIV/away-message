import { describe, expect, it } from 'vitest';
import {
  allocatePuppetInputOrThrow,
  bootstrapAndAllocatePuppetInput,
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
});
