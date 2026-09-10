import { describe, expect, it } from 'vitest';
import {
  SemanticPuppet,
  validateAwayRigMetadata,
  type RawPuppetAdapter,
} from '../../src/tooling/away-puppet/SemanticPuppet';
import { createAwayPuppetToolService } from '../../src/tooling/away-puppet/McpSemanticTools';

class FakeRawPuppet implements RawPuppetAdapter {
  readonly parameters = new Map<string, number>([
    ['ParamBodyMass', 0],
    ['ParamSmile', 0],
    ['ParamHeadTilt', 0],
  ]);
  readonly visibleNodes = new Map<string, boolean>([['NodeHairFront', true]]);
  readonly tints = new Map<string, string>();

  hasParameter(id: string): boolean { return this.parameters.has(id); }
  hasNode(id: string): boolean { return this.visibleNodes.has(id); }
  setParameter(id: string, value: number): void { this.parameters.set(id, value); }
  setNodeVisibility(id: string, visible: boolean): void { this.visibleNodes.set(id, visible); }
  setNodeTint(id: string, color: string): void { this.tints.set(id, color); }
}

function makeFixture() {
  const raw = new FakeRawPuppet();
  const metadata = validateAwayRigMetadata({
    namespace: 'away-message/puppet',
    contractVersion: 1,
    morphs: { 'body.mass': { parameterId: 'ParamBodyMass', min: -1, max: 1, default: 0 } },
    slots: { 'hair.front': { nodeId: 'NodeHairFront' } },
    tints: { hair: { nodeIds: ['NodeHairFront'] } },
    expressions: { awkward_smile: { parameters: { ParamSmile: 0.65 } } },
    poses: { relaxed: { parameters: { ParamHeadTilt: -0.2 } } },
  }, raw);
  return { raw, puppet: new SemanticPuppet(raw, metadata) };
}

describe('Away Puppet MCP semantic contract', () => {
  it('exposes only semantic model-facing tools and never allocator/pointer operations', () => {
    const { puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);
    expect(service.listTools()).toEqual([
      'away.inspect_contract',
      'away.set_morph',
      'away.set_expression',
      'away.set_pose',
      'part.set_visibility',
      'part.set_tint',
    ]);
    expect(service.listTools().some((name) => /malloc|free|pointer|raw\.inochi/i.test(name))).toBe(false);
  });

  it('routes MCP semantic operations through the same validation as direct calls', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);
    expect(service.call('away.set_morph', { name: 'body.mass', value: 0.6 })).toEqual({ ok: true });
    expect(service.call('away.set_expression', { name: 'awkward_smile' })).toEqual({ ok: true });
    expect(service.call('away.set_pose', { name: 'relaxed' })).toEqual({ ok: true });
    expect(raw.parameters.get('ParamBodyMass')).toBe(0.6);
    expect(raw.parameters.get('ParamSmile')).toBe(0.65);
    expect(raw.parameters.get('ParamHeadTilt')).toBe(-0.2);

    expect(() => service.call('away.set_morph', { name: 'body.mass', value: 2 })).toThrow(/outside/);
    expect(() => service.call('away.set_expression', { name: 'ParamSmile' })).toThrow(/Unknown expression/);
    expect(() => service.call('away.set_pose', { name: 'ParamHeadTilt' })).toThrow(/Unknown pose/);
  });

  it('validates semantic tool arguments before mutation', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);
    expect(() => service.call('part.set_visibility', { slot: 'hair.front', visible: 'yes' })).toThrow(/visible must be a boolean/);
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
