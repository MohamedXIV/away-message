import { describe, expect, it } from 'vitest';
import {
  createTechnicalAwayPuppetCharacterGroup,
  createTechnicalAwayPuppetSession,
  createTechnicalAwayPuppetVisualState,
  TECHNICAL_AWAY_PUPPET_PROFILE,
} from '../../src/world/phaser/TechnicalAwayPuppetRig';

function batch(frame: NonNullable<ReturnType<NonNullable<ReturnType<typeof createTechnicalAwayPuppetSession>['renderFrame']>>>, id: string) {
  const found = frame.batches.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing batch ${id}`);
  return found;
}

function width(vertices: readonly number[]): number {
  const xs: number[] = [];
  for (let i = 0; i < vertices.length; i += 4) xs.push(vertices[i]!);
  return Math.max(...xs) - Math.min(...xs);
}

describe('Technical Away Puppet rig (#25)', () => {
  it('builds a representative three-actor group by reusing one generic rig profile', () => {
    const group = createTechnicalAwayPuppetCharacterGroup();
    expect(group).toHaveLength(3);
    expect(new Set(group.map((mount) => mount.actorId)).size).toBe(3);
    expect(new Set(group.map((mount) => mount.visualState.profileId))).toEqual(
      new Set([TECHNICAL_AWAY_PUPPET_PROFILE]),
    );
    expect(new Set(group.map((mount) => mount.visualState.parts['hair.front'])).size).toBe(2);
    expect(new Set(group.map((mount) => mount.visualState.tints.skin)).size).toBe(3);
    for (const mount of group) mount.renderer.destroy();
  });

  it('is generic and exposes a modular profile without canonical-character identity', () => {
    const state = createTechnicalAwayPuppetVisualState('dynamic-actor-918');
    expect(state.actorId).toBe('dynamic-actor-918');
    expect(state.profileId).toBe(TECHNICAL_AWAY_PUPPET_PROFILE);
    expect(state.parts).toMatchObject({
      'hair.front': 'hair.medium-wave',
      'wardrobe.top': 'top.knit',
      'wardrobe.outer': 'outer.light-jacket',
    });
  });

  it('changes body geometry, hairstyle, wardrobe and tint through the semantic controller', () => {
    const session = createTechnicalAwayPuppetSession();
    const render = session.renderFrame!;

    const initial = render(0);
    const initialTorsoWidth = width(batch(initial, 'wardrobe.top').vertices);
    const initialHairWidth = width(batch(initial, 'hair.front.top').vertices);
    expect(initial.batches.some((entry) => entry.id === 'wardrobe.outer.left')).toBe(true);

    session.puppet.setMorph('body.mass', 0.8);
    session.puppet.assignSlot('hair.front', 'hair.medium-wave');
    session.puppet.assignSlot('wardrobe.top', 'top.knit');
    session.puppet.assignSlot('wardrobe.outer', 'outer.none');
    session.puppet.setTint('skin', '#9f6f55');
    session.puppet.setTint('hair', '#704c2f');
    session.puppet.setTint('clothing', '#485f78');

    const changed = render(0);
    expect(width(batch(changed, 'wardrobe.top').vertices)).toBeGreaterThan(initialTorsoWidth);
    expect(width(batch(changed, 'hair.front.top').vertices)).toBeGreaterThan(initialHairWidth);
    expect(changed.batches.some((entry) => entry.id === 'wardrobe.top.detail')).toBe(true);
    expect(changed.batches.some((entry) => entry.id.startsWith('wardrobe.outer.'))).toBe(false);
    expect(batch(changed, 'head').tint).toBe('#9f6f55');
    expect(batch(changed, 'hair.front.top').tint).toBe('#704c2f');
    expect(batch(changed, 'wardrobe.top').tint).toBe('#485f78');
  });

  it('proves expression, blink and secondary-motion morphs change rendered geometry', () => {
    const session = createTechnicalAwayPuppetSession();
    const render = session.renderFrame!;

    const neutral = render(0);
    const neutralMouthWidth = width(batch(neutral, 'mouth').vertices);
    const neutralEyeHeight = Math.abs(batch(neutral, 'eye.left.iris').vertices[1]! - batch(neutral, 'eye.left.iris').vertices[9]!);
    const neutralHairX = batch(neutral, 'hair.front.top').vertices[0]!;

    session.puppet.setExpression('expression.soft-smile');
    session.puppet.setMorph('face.blink', 1);
    session.puppet.setMorph('secondary.hair', 0.75);
    session.puppet.setMorph('secondary.cloth', -0.5);

    const animated = render(0);
    expect(width(batch(animated, 'mouth').vertices)).toBeGreaterThan(neutralMouthWidth);
    const blinkEyeHeight = Math.abs(batch(animated, 'eye.left.iris').vertices[1]! - batch(animated, 'eye.left.iris').vertices[9]!);
    expect(blinkEyeHeight).toBeLessThan(neutralEyeHeight);
    expect(batch(animated, 'hair.front.top').vertices[0]).not.toBe(neutralHairX);
    expect(batch(animated, 'wardrobe.top').vertices[0]).not.toBe(batch(neutral, 'wardrobe.top').vertices[0]);
  });

  it('rejects unknown assets and out-of-range morphology instead of inventing content', () => {
    const session = createTechnicalAwayPuppetSession();
    expect(() => session.puppet.assignSlot('hair.front', 'hair.nonexistent')).toThrow(/unknown technical away puppet asset/i);
    expect(() => session.puppet.setMorph('body.mass', 2)).toThrow(/outside/i);
    expect(() => session.puppet.setTint('skin', 'brown')).toThrow(/#rrggbb/i);
  });
});
