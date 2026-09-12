import { describe, expect, it } from 'vitest';
import { createAwayPuppetToolService } from '../../src/tooling/away-puppet/McpSemanticTools';
import {
  createInochiWebLifecycle,
  type InochiWebLifecycleSource,
  type InochiWebRuntimeModule,
} from '../../src/tooling/away-puppet/InochiWebLifecycle';
import type { AwayRigMetadata } from '../../src/tooling/away-puppet/SemanticPuppet';

const metadata: AwayRigMetadata = {
  namespace: 'away-message/puppet',
  contractVersion: 1,
  morphs: {
    'body.mass': { parameterId: 'ParamBodyMass', min: -1, max: 1, default: 0 },
  },
  slots: {
    'hair.front': { nodeId: 'NodeHairFront' },
  },
  tints: {},
  expressions: {},
  poses: {},
};

class FakeParameter {
  constructor(
    readonly name: string,
    private current: number,
  ) {}

  get value(): number[] { return [this.current]; }
  set value(next: number[]) { this.current = next[0] ?? 0; }
}

class FakeNode {
  enabled = true;
  constructor(
    readonly name: string,
    readonly children: ReadonlyArray<FakeNode | null> = [],
  ) {}
}

class FakePuppet {
  static freeCount = 0;
  readonly parameters = [new FakeParameter('ParamBodyMass', 0)];
  readonly root = new FakeNode('Root', [new FakeNode('NodeHairFront')]);
  readonly name = 'Fixture';
  readonly author = 'Away';

  constructor(readonly bytes: ArrayBufferLike) {}
  update(): void {}
  draw(): void {}
  free(): void { FakePuppet.freeCount += 1; }
}

const module: InochiWebRuntimeModule = {
  Puppet: FakePuppet,
};

function source(id: string): InochiWebLifecycleSource {
  return {
    source: id,
    bytes: new Uint8Array([1, 2, 3]).buffer,
    metadata,
  };
}

describe('Inochi Web production lifecycle bridge (#34)', () => {
  it('opens real-wrapper-shaped puppet bytes into the semantic MCP lifecycle and disposes replaced puppets', () => {
    FakePuppet.freeCount = 0;
    const lifecycle = createInochiWebLifecycle(module, (id) => source(id));
    const first = lifecycle.open('first.inp');
    const service = createAwayPuppetToolService(first.puppet, {
      disposeInitial: first.dispose,
      open: lifecycle.open,
    });

    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0 });
    expect(service.call('parameter.set', { name: 'body.mass', value: 0.5 })).toEqual({ ok: true });
    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0.5 });

    expect(service.call('puppet.open', { source: 'second.inp' })).toMatchObject({ ok: true, source: 'second.inp' });
    expect(FakePuppet.freeCount).toBe(1);
  });

  it('maps node visibility but refuses to fake unsupported tint or slot replacement', () => {
    const lifecycle = createInochiWebLifecycle(module, (id) => source(id));
    const session = lifecycle.open('fixture.inp');
    const service = createAwayPuppetToolService(session.puppet, {
      disposeInitial: session.dispose,
      open: lifecycle.open,
    });

    expect(service.call('part.set_visibility', { slot: 'hair.front', visible: false })).toEqual({ ok: true });
    expect(() => service.call('part.set_tint', { channel: 'hair', color: '#fff' })).toThrow();
    expect(() => service.call('away.assign_slot', { slot: 'hair.front', assetId: 'hair.bob' })).toThrow(/unavailable/i);
  });

  it('frees a newly loaded raw puppet when metadata validation fails', () => {
    FakePuppet.freeCount = 0;
    const invalid: AwayRigMetadata = {
      ...metadata,
      morphs: {
        'body.mass': { parameterId: 'MissingParameter', min: -1, max: 1, default: 0 },
      },
    };
    const lifecycle = createInochiWebLifecycle(module, () => ({
      source: 'broken.inp',
      bytes: new Uint8Array([9]).buffer,
      metadata: invalid,
    }));

    expect(() => lifecycle.open('broken.inp')).toThrow(/MissingParameter/);
    expect(FakePuppet.freeCount).toBe(1);
  });
});
