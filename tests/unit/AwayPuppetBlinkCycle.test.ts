import { describe, expect, it } from 'vitest';
import {
  AwayPuppetCharacterRenderer,
  type AwayPuppetCharacterSession,
  type AwayPuppetSemanticController,
} from '../../src/world/AwayPuppetCharacterRenderer';

describe('Away Puppet blink cycle (#25)', () => {
  it('stays open until the configured interval and then closes briefly', async () => {
    const values: number[] = [];
    const puppet: AwayPuppetSemanticController = {
      setMorph: (name, value) => { if (name === 'face.blink') values.push(value); },
      assignSlot: () => undefined,
      setTint: () => undefined,
      setExpression: () => undefined,
      setPose: () => undefined,
      setPartVisibility: () => undefined,
    };
    const renderer = new AwayPuppetCharacterRenderer(
      (): AwayPuppetCharacterSession => ({
        puppet,
        motion: {
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
      { setTransform: () => undefined, update: () => undefined, destroy: () => undefined },
    );

    await renderer.load('profile.generic-production-fixture');
    renderer.update(80);
    renderer.update(3760);
    renderer.update(80);

    expect(values).toEqual([0, 0, 1]);
  });
});
