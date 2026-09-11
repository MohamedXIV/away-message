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
  getParameter(id: string): number {
    const value = this.parameters.get(id);
    if (value === undefined) throw new Error(`Unknown raw parameter: ${id}`);
    return value;
  }
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
      'puppet.open',
      'puppet.inspect',
      'puppet.validate',
      'parameter.list',
      'parameter.get',
      'parameter.set',
      'node.list',
      'part.list',
      'away.inspect_contract',
      'away.validate_rig',
      'away.set_morph',
      'away.test_morph_extremes',
      'away.set_expression',
      'away.set_pose',
      'part.set_visibility',
      'part.set_tint',
    ]);
    expect(service.listTools().some((name) => /malloc|free|pointer|raw\.inochi/i.test(name))).toBe(false);
  });

  it('opens replacement puppet sessions atomically and disposes the old session only after success', () => {
    const first = makeFixture();
    const second = makeFixture();
    second.raw.parameters.set('ParamBodyMass', 0.75);
    let firstDisposeCount = 0;
    let secondDisposeCount = 0;
    const service = createAwayPuppetToolService(first.puppet, {
      disposeInitial: () => { firstDisposeCount += 1; },
      open: (source) => {
        if (source === 'broken.inp') throw new Error('load failed');
        return { puppet: second.puppet, dispose: () => { secondDisposeCount += 1; } };
      },
    });

    expect(() => service.call('puppet.open', { source: 'broken.inp' })).toThrow(/load failed/);
    expect(firstDisposeCount).toBe(0);
    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0 });

    expect(service.call('puppet.open', { source: 'replacement.inp' })).toEqual({
      ok: true,
      source: 'replacement.inp',
      inspection: second.puppet.inspect(),
    });
    expect(firstDisposeCount).toBe(1);
    expect(secondDisposeCount).toBe(0);
    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0.75 });
  });

  it('exposes semantic inspection inventory without leaking raw Inochi parameter or node ids', () => {
    const { puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(service.call('puppet.inspect')).toEqual({
      morphs: ['body.mass'],
      slots: ['hair.front'],
      tints: ['hair'],
      expressions: ['awkward_smile'],
      poses: ['relaxed'],
      contractVersion: 1,
    });
    expect(service.call('puppet.validate')).toEqual({ ok: true, contractVersion: 1 });
    expect(service.call('away.validate_rig')).toEqual({ ok: true, contractVersion: 1 });
    expect(service.call('parameter.list')).toEqual(['body.mass']);
    expect(service.call('node.list')).toEqual(['hair.front']);
    expect(service.call('part.list')).toEqual(['hair.front']);

    const serialized = JSON.stringify({
      inspect: service.call('puppet.inspect'),
      parameters: service.call('parameter.list'),
      nodes: service.call('node.list'),
      parts: service.call('part.list'),
    });
    expect(serialized).not.toContain('ParamBodyMass');
    expect(serialized).not.toContain('ParamSmile');
    expect(serialized).not.toContain('ParamHeadTilt');
    expect(serialized).not.toContain('NodeHairFront');
  });

  it('gets and sets parameters only by semantic morph name', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);

    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0 });
    expect(service.call('parameter.set', { name: 'body.mass', value: 0.4 })).toEqual({ ok: true });
    expect(service.call('parameter.get', { name: 'body.mass' })).toEqual({ name: 'body.mass', value: 0.4 });
    expect(raw.parameters.get('ParamBodyMass')).toBe(0.4);

    expect(() => service.call('parameter.get', { name: 'ParamBodyMass' })).toThrow(/Unknown morph/);
    expect(() => service.call('parameter.set', { name: 'ParamBodyMass', value: 0.5 })).toThrow(/Unknown morph/);
  });

  it('tests semantic morph extremes deterministically and restores the original value', () => {
    const { raw, puppet } = makeFixture();
    const service = createAwayPuppetToolService(puppet);
    raw.parameters.set('ParamBodyMass', 0.25);

    expect(service.call('away.test_morph_extremes', { name: 'body.mass' })).toEqual({
      name: 'body.mass',
      min: -1,
      max: 1,
      restored: 0.25,
    });
    expect(raw.parameters.get('ParamBodyMass')).toBe(0.25);
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
