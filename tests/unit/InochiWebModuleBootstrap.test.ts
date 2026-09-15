import { describe, expect, it } from 'vitest';
import { bootstrapInochiWebModule } from '../../src/tooling/away-puppet/InochiWebModuleBootstrap';

describe('Inochi Web module bootstrap', () => {
  it('initializes raw WASM before allocating the scratchpad', () => {
    const calls: string[] = [];
    const runtime = bootstrapInochiWebModule({
      in_init: () => calls.push('in_init'),
      nu_realloc: (pointer, bytes) => {
        calls.push(`nu_realloc:${pointer}:${bytes}`);
        return 4096;
      },
    });

    expect(calls).toEqual(['in_init', 'nu_realloc:0:128']);
    expect(runtime.scratchpad).toEqual({ pointer: 4096, size: 128 });
  });

  it('fails closed when the WASM allocator cannot establish scratch memory', () => {
    expect(() => bootstrapInochiWebModule({
      in_init: () => undefined,
      nu_realloc: () => 0,
    })).toThrow(/scratchpad allocation failed/i);
  });
});
