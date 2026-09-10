import { describe, expect, it } from 'vitest';
import {
  SemanticPuppet,
  validateAwayRigMetadata,
  type RawPuppetAdapter,
} from '../../src/tooling/away-puppet/SemanticPuppet';

class FakeRawPuppet implements RawPuppetAdapter {
  readonly parameters = new Map<string, number>([
    ['ParamBodyMass', 0],
    ['ParamFaceRound', 0],
    ['ParamSmile', 0],
    ['ParamHeadTilt', 0],
  ]);
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

const metadata = {
  namespace: 'away-message/puppet',
  contractVersion: 1,
  morphs: {
    'body.mass': { parameterId: 'ParamBodyMass', min: -1, max: 1, default: 0 },
    'face.roundness': { parameterId: 'ParamFaceRound', min: -0.5, max: 0.5, default: 0 },
  },
  slots: {
    'hair.front': { nodeId: 'NodeHairFront' },
  },
  tints: {
    hair: { nodeIds: ['NodeHairFront'] },
  },
  expressions: {
    awkward_smile: {
      parameters: {
        ParamSmile: 0.65,
        ParamHeadTilt: 0.1,
      },
    },
  },
  poses: {
    relaxed: {
      parameters: {
        ParamHeadTilt: -0.2,
      },
    },
  },
} as const;

describe('Away Puppet semantic boundary', () => {
  it('validates namespaced rig metadata against the raw puppet without leaking raw ids to callers', () => {
    const raw = new FakeRawPuppet();
    const validated = validateAwayRigMetadata(metadata, raw);
    const puppet = new SemanticPuppet(raw, validated);

    puppet.setMorph('body.mass', 0.75);
    puppet.setPartVisibility('hair.front', false);
    puppet.setTint('hair', '#332211');
    puppet.setExpression('awkward_smile');
    puppet.setPose('relaxed');

    expect(raw.parameters.get('ParamBodyMass')).toBe(0.75);
    expect(raw.parameters.get('ParamSmile')).toBe(0.65);
    expect(raw.parameters.get('ParamHeadTilt')).toBe(-0.2);
    expect(raw.visibleNodes.get('NodeHairFront')).toBe(false);
    expect(raw.tints.get('NodeHairFront')).toBe('#332211');
    expect(puppet.inspect()).toEqual({
      morphs: ['body.mass', 'face.roundness'],
      slots: ['hair.front'],
      tints: ['hair'],
      expressions: ['awkward_smile'],
      poses: ['relaxed'],
      contractVersion: 1,
    });
  });

  it('rejects invalid mappings before any semantic mutation is possible', () => {
    const raw = new FakeRawPuppet();
    const broken = {
      ...metadata,
      morphs: {
        ...metadata.morphs,
        'face.unknown': { parameterId: 'MissingParam', min: 0, max: 1, default: 0 },
      },
    } as const;

    expect(() => validateAwayRigMetadata(broken, raw)).toThrow(/MissingParam/);
    expect(raw.parameters.get('ParamBodyMass')).toBe(0);
  });

  it('rejects invalid expression and pose mappings before runtime use', () => {
    const raw = new FakeRawPuppet();
    const missingParameter = {
      ...metadata,
      expressions: {
        broken: { parameters: { MissingExpressionParam: 0.5 } },
      },
    } as const;

    expect(() => validateAwayRigMetadata(missingParameter, raw)).toThrow(/MissingExpressionParam/);

    const invalidValue = {
      ...metadata,
      poses: {
        broken: { parameters: { ParamHeadTilt: Number.NaN } },
      },
    } as const;

    expect(() => validateAwayRigMetadata(invalidValue, raw)).toThrow(/finite/);
    expect(raw.parameters.get('ParamHeadTilt')).toBe(0);
  });

  it('rejects unknown or out-of-range semantic operations without partial mutation', () => {
    const raw = new FakeRawPuppet();
    const puppet = new SemanticPuppet(raw, validateAwayRigMetadata(metadata, raw));

    expect(() => puppet.setMorph('raw.ParamBodyMass', 0.2)).toThrow(/Unknown morph/);
    expect(() => puppet.setMorph('body.mass', 2)).toThrow(/outside/);
    expect(() => puppet.setTint('skin', '#ffffff')).toThrow(/Unknown tint/);
    expect(() => puppet.setExpression('raw.ParamSmile')).toThrow(/Unknown expression/);
    expect(() => puppet.setPose('missing')).toThrow(/Unknown pose/);

    expect(raw.parameters.get('ParamBodyMass')).toBe(0);
    expect(raw.parameters.get('ParamSmile')).toBe(0);
    expect(raw.parameters.get('ParamHeadTilt')).toBe(0);
    expect(raw.tints.size).toBe(0);
  });
});
