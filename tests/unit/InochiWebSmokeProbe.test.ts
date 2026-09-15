import { describe, expect, it } from 'vitest';
import { probeInochiWebPuppet, type InochiWebModule } from '../../src/tooling/away-puppet/InochiWebSmokeProbe';

class FakeParameter {
  constructor(
    readonly name: string,
    readonly lowerBounds: number[],
    readonly upperBounds: number[],
    public value: number[],
  ) {}
}

class FakeNode {
  constructor(readonly name: string, readonly children: Array<FakeNode | null> = []) {}
}

class FakePuppet {
  readonly name = 'fixture';
  readonly author = 'test';
  readonly parameters = [
    new FakeParameter('ParamA', [-1], [1], [0]),
    new FakeParameter('ParamB', [0], [2], [1]),
  ];
  readonly root = new FakeNode('Root', [new FakeNode('Face'), new FakeNode('Hair')]);
  freed = false;
  updateCalls = 0;
  drawCalls = 0;

  constructor(readonly bytes: ArrayBufferLike) {}
  update(): void { this.updateCalls += 1; }
  draw(): void { this.drawCalls += 1; }
  free(): void { this.freed = true; }
}

describe('Inochi Web/WASM smoke probe boundary', () => {
  it('loads bytes, enumerates parameters/nodes, mutates two parameters, draws, and frees deterministically', () => {
    const opened: FakePuppet[] = [];
    const module: InochiWebModule = {
      Puppet: class extends FakePuppet {
        constructor(bytes: ArrayBufferLike) {
          super(bytes);
          opened.push(this);
        }
      },
    };

    const result = probeInochiWebPuppet(module, new Uint8Array([1, 2, 3, 4]).buffer);

    expect(result).toEqual({
      name: 'fixture',
      author: 'test',
      parameterNames: ['ParamA', 'ParamB'],
      nodeNames: ['Root', 'Face', 'Hair'],
      mutations: [
        { parameter: 'ParamA', before: [0], after: [1] },
        { parameter: 'ParamB', before: [1], after: [2] },
      ],
    });
    expect(opened).toHaveLength(1);
    expect(opened[0]?.updateCalls).toBe(1);
    expect(opened[0]?.drawCalls).toBe(1);
    expect(opened[0]?.freed).toBe(true);
  });

  it('frees the puppet when enumeration or mutation throws', () => {
    let opened: FakePuppet | undefined;
    const module: InochiWebModule = {
      Puppet: class extends FakePuppet {
        constructor(bytes: ArrayBufferLike) {
          super(bytes);
          opened = this;
          Object.defineProperty(this, 'parameters', {
            get() { throw new Error('upstream inspection failed'); },
          });
        }
      },
    };

    expect(() => probeInochiWebPuppet(module, new ArrayBuffer(1))).toThrow(/upstream inspection failed/);
    expect(opened?.freed).toBe(true);
  });
});
