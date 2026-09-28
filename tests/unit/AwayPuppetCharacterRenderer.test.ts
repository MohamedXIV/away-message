import { describe, expect, it } from 'vitest';
import {
  resolveAppearanceKnowledge,
  type CharacterRenderTransform,
  type CharacterVisualState,
} from '../../src/world/characterRenderer';
import {
  AwayPuppetCharacterRenderer,
  type AwayPuppetCharacterSession,
  type AwayPuppetSemanticController,
  type CharacterRenderSurface,
} from '../../src/world/AwayPuppetCharacterRenderer';

function createSemanticSpy(events: string[]): AwayPuppetSemanticController {
  return {
    setMorph: (name, value) => events.push(`morph:${name}=${value}`),
    assignSlot: (slot, assetId) => events.push(`part:${slot}=${assetId}`),
    setTint: (channel, color) => events.push(`tint:${channel}=${color}`),
    setExpression: (id) => events.push(`expression:${id}`),
    setPose: (id) => events.push(`pose:${id}`),
    setPartVisibility: (slot, visible) => events.push(`visibility:${slot}=${visible}`),
  };
}

function createSurfaceSpy(
  transforms: CharacterRenderTransform[],
  updates: number[],
  destroyed: { value: number },
): CharacterRenderSurface {
  return {
    setTransform: (transform) => transforms.push({ ...transform }),
    update: (deltaMs) => updates.push(deltaMs),
    destroy: () => { destroyed.value += 1; },
  };
}

describe('AwayPuppetCharacterRenderer (#25)', () => {
  it('maps game-owned semantic visual state onto Away Puppet without renderer ids', async () => {
    const events: string[] = [];
    const transforms: CharacterRenderTransform[] = [];
    const updates: number[] = [];
    const destroyed = { value: 0 };
    const disposed: string[] = [];

    const renderer = new AwayPuppetCharacterRenderer(
      async (profileId): Promise<AwayPuppetCharacterSession> => ({
        puppet: createSemanticSpy(events),
        dispose: () => disposed.push(profileId),
      }),
      createSurfaceSpy(transforms, updates, destroyed),
    );

    await renderer.load('profile.generic-adult');

    const state: CharacterVisualState = {
      actorId: 'actor-42',
      profileId: 'profile.generic-adult',
      morphs: {
        'body.height': 0.35,
        'face.jaw_width': -0.2,
      },
      parts: {
        'hair.front': 'hair.short-layered',
        'wardrobe.top': 'top.crew-neck',
      },
      tints: {
        skin: '#b98265',
        hair: '#2e211b',
        clothing: '#526273',
      },
      expression: 'expression.soft-smile',
      pose: 'pose.relaxed',
      transform: {
        x: 624,
        y: 510,
        scale: 0.92,
        depth: 31,
        visible: true,
      },
    };

    renderer.apply(state);
    renderer.setVisibility('wardrobe.top', false);
    renderer.update(16.67);

    expect(events).toEqual([
      'morph:body.height=0.35',
      'morph:face.jaw_width=-0.2',
      'part:hair.front=hair.short-layered',
      'part:wardrobe.top=top.crew-neck',
      'tint:skin=#b98265',
      'tint:hair=#2e211b',
      'tint:clothing=#526273',
      'expression:expression.soft-smile',
      'pose:pose.relaxed',
      'visibility:wardrobe.top=false',
    ]);
    expect(transforms).toEqual([state.transform]);
    expect(updates).toEqual([16.67]);

    renderer.destroy();
    renderer.destroy();
    expect(disposed).toEqual(['profile.generic-adult']);
    expect(destroyed.value).toBe(1);
  });

  it('keeps one renderer identity while replacing only the loaded render profile', async () => {
    const events: string[] = [];
    const disposed: string[] = [];
    const surfaceDestroyed = { value: 0 };

    const renderer = new AwayPuppetCharacterRenderer(
      (profileId): AwayPuppetCharacterSession => ({
        puppet: createSemanticSpy(events),
        dispose: () => disposed.push(profileId),
      }),
      createSurfaceSpy([], [], surfaceDestroyed),
    );

    await renderer.load('profile.base-a');
    renderer.setExpression('expression.neutral');
    await renderer.load('profile.base-b');
    renderer.setExpression('expression.focused');

    expect(disposed).toEqual(['profile.base-a']);
    expect(events).toEqual([
      'expression:expression.neutral',
      'expression:expression.focused',
    ]);

    renderer.destroy();
    expect(disposed).toEqual(['profile.base-a', 'profile.base-b']);
  });

  it('keeps physical appearance separate from online knowledge', () => {
    const physical = {
      actorId: 'actor-42',
      observableTraits: ['tall', 'dark hair'],
      wardrobe: ['green jacket'],
    } as const;

    expect(resolveAppearanceKnowledge(physical, 'online')).toEqual({
      physical,
      online: null,
    });

    const shared = {
      actorId: 'actor-42',
      observableTraits: ['dark hair'],
      wardrobe: ['work shirt'],
    } as const;

    expect(resolveAppearanceKnowledge(physical, 'online', shared)).toEqual({
      physical,
      online: shared,
    });
    expect(resolveAppearanceKnowledge(physical, 'physical')).toEqual({
      physical,
      online: physical,
    });
  });

  it('drives bounded blink, breathing, and secondary motion through semantic morphs', async () => {
    const events: string[] = [];
    const renderer = new AwayPuppetCharacterRenderer(
      (): AwayPuppetCharacterSession => ({
        puppet: createSemanticSpy(events),
        motion: {
          idleMorphs: [
            { name: 'idle.breath', center: 0, amplitude: 0.08, periodMs: 2000 },
            { name: 'secondary.hair', center: 0, amplitude: 0.12, periodMs: 1400, phase: 0.5 },
            { name: 'secondary.cloth', center: 0, amplitude: 0.06, periodMs: 1800, phase: 1 },
          ],
          blink: {
            morphName: 'face.blink',
            intervalMs: 4000,
            durationMs: 160,
            openValue: 0,
            closedValue: 1,
          },
        },
        dispose: () => undefined,
      }),
      createSurfaceSpy([], [], { value: 0 }),
    );

    await renderer.load('profile.generic-production-fixture');
    renderer.update(80);
    renderer.update(920);

    const values = events.map((event) => {
      const [, raw] = event.split('=');
      return Number(raw);
    });
    expect(events.some((event) => event.startsWith('morph:face.blink='))).toBe(true);
    expect(events.some((event) => event.startsWith('morph:idle.breath='))).toBe(true);
    expect(events.some((event) => event.startsWith('morph:secondary.hair='))).toBe(true);
    expect(events.some((event) => event.startsWith('morph:secondary.cloth='))).toBe(true);
    expect(values.every(Number.isFinite)).toBe(true);
    expect(values.filter((_, index) => events[index]!.startsWith('morph:idle.breath='))
      .every((value) => Math.abs(value) <= 0.080001)).toBe(true);
    expect(values.filter((_, index) => events[index]!.startsWith('morph:secondary.hair='))
      .every((value) => Math.abs(value) <= 0.120001)).toBe(true);
    expect(values.filter((_, index) => events[index]!.startsWith('morph:secondary.cloth='))
      .every((value) => Math.abs(value) <= 0.060001)).toBe(true);
  });

  it('rejects mutation before a profile is loaded and invalid frame deltas', async () => {
    const renderer = new AwayPuppetCharacterRenderer(
      () => ({
        puppet: createSemanticSpy([]),
        dispose: () => undefined,
      }),
      createSurfaceSpy([], [], { value: 0 }),
    );

    expect(() => renderer.setMorph('body.height', 0)).toThrow(/no loaded puppet profile/i);
    await renderer.load('profile.fixture');
    expect(() => renderer.update(-1)).toThrow(/finite non-negative/i);
  });
});
