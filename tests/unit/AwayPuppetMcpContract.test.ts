import { describe, expect, it } from 'vitest';
import {
  SemanticPuppet,
  validateAwayRigMetadata,
  type RawPuppetAdapter,
} from '../../src/tooling/away-puppet/SemanticPuppet';
import { createAwayPuppetToolService } from '../../src/tooling/away-puppet/McpSemanticTools';

class FakeRawPuppet implements RawPuppetAdapter {
  readonly parameters = new Map<string, number>([['ParamBodyMass', 0]]);
  readonly visibleNodes = new Map<string, boolean>([['NodeHairFront', true]]);
  readonly tints = new Map<string, string>();

  hasParameter(id: string): boolean {
    return this.parameters.has(id);
  }

  hasNode(id: string): boolean {
    return this.visibleNodes.has(id);
  }

  setParameter(id: string, value: number): void {
    this.parameters.set(id, value);
  }

  setNodeVisibility(id: string, visible: boolean): void {
    this.visibleNodes.set(id, visible);
  }

  setNodeTint(id: string, color: string): void {
    this.tints.set(id, color);
  }
}

function makeFixture() {
  const raw = new FakeRawPuppet();
  const metadata = validateAwayRigMetadata(
    {
      namespace: 'away-message/puppet',
      contractVersion: 1,
      morphs: {
        'body.mass': { parameterId: 'ParamBodyMass', min: -1, max: 1, default: 0 },
      },
      slots: {
        'hair.front': { nodeId: 'NodeHairFront' },
      },
      tints: {
        hair: { nodeIds: ['NodeHairFront'] },
      },
      expressions: {},
      poses: {},
    },
    raw,
  );

  return { raw, puppet: new SemanticPuppet(raw, metadata) };
}

describe('Away Puppet MCP semantic contract', () => {
  it('exposes only semantic model-facing tools and never allocator/pointer operations', () => {
    const { puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(service.listTools()).toEqual([
      'away.inspect_contract',
      'away.set_morph',
      'part.set_visibility',
      'part.set_tint',
    ]);
    expect(service.listTools().some((name) => /malloc|free|pointer|raw\.inochi/i.test(name))).toBe(false);
  });

  it('routes MCP morph operations through the same validation as direct semantic calls', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(service.call('away.set_morph', { name: 'body.mass', value: 0.6 })).toEqual({ ok: true });
    expect(raw.parameters.get('ParamBodyMass')).toBe(0.6);

    expect(() => service.call('away.set_morph', { name: 'body.mass', value: 2 })).toThrow(/outside/);
    expect(raw.parameters.get('ParamBodyMass')).toBe(0.6);
    expect(() => service.call('away.set_morph', { name: 'ParamBodyMass', value: 0 })).toThrow(/Unknown morph/);
  });

  it('validates semantic tool arguments before mutation', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(() => service.call('part.set_visibility', { slot: 'hair.front', visible: 'yes' })).toThrow(
      /visible must be a boolean/,
    );
    expect(raw.visibleNodes.get('NodeHairFront')).toBe(true);

    expect(service.call('part.set_tint', { channel: 'hair', color: '#224466' })).toEqual({ ok: true });
    expect(raw.tints.get('NodeHairFront')).toBe('#224466');
  });

  it('rejects unknown tool names instead of offering a raw fallback', () => {
    const { puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(() => service.call('raw.inochi.free', { pointer: 1234 })).toThrow(/Unknown Away Puppet tool/);
  });
});
