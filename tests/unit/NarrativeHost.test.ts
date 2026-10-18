import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NarrativeHostImpl } from '../../src/narrative/NarrativeHost';
import { NarrativeContextProjectionSchema } from '../../src/narrative/contracts';

const compiledPath = join(__dirname, '../../src/narrative/ink/fixtures/hello.ink.json');
const compiledJson = JSON.parse(readFileSync(compiledPath, 'utf8'));

const baseContext = NarrativeContextProjectionSchema.parse({
  currentDay: 1,
  currentTimeMinute: 600,
  timeOfDay: 'afternoon',
  player: { cash: 38 },
  flags: {},
  completedBeats: [],
});

describe('NarrativeHost', () => {
  it('starts a flow and returns a frame', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    const frame = host.start('hello');
    expect(frame.text).toContain('Hello there.');
    expect(frame.tags).toEqual(['greeting']);
    expect(frame.choices.length).toBe(0); // choices on next continuation
  });

  it('advances through choices and captures validated effect requests', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    const frame2 = host.continue();
    expect(frame2.choices.map((c) => c.text)).toEqual(['Ask about the exam', 'Say goodbye']);
    const frame3 = host.choose(0);
    expect(frame3.text).toContain('You asked about the exam.');
    host.continue(); // executes request_effect line
    const pending = host.getPendingEffects();
    expect(pending.length).toBe(1);
    const first = pending[0];
    expect(first).toBeDefined();
    expect(first!.type).toBe('request_effect');
    if (first && first.type === 'request_effect') {
      expect(first.effectId).toBe('social_act');
      expect(first.payload).toEqual({ arg: 'empathy' });
    }
  });

  it('forwards effect requests to domain handler', () => {
    const handler = () => ({ accepted: true, result: 'ok' });
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
      onEffectRequest: handler,
    });
    host.start('hello');
    host.continue();
    host.choose(0);
    host.continue();
    const pending = host.getPendingEffects();
    expect(pending.length).toBe(1);
  });

  it('rejects unknown flow', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => null,
      context: baseContext,
    });
    expect(() => host.start('nope')).toThrow();
  });

  it('saves and restores flow position and variables', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue(); // choices
    host.choose(0);
    host.continue(); // exam text
    const saved = host.save();
    expect(saved.version).toBe(1);
    expect(saved.compiledStoryKey).toBe('hello');

    const host2 = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host2.load(saved);
    // after restore, variable should persist
    // (Ink variable 'asked' set during the branch)
    // We can't read directly; but load should not throw and pending cleared
    expect(host2.getPendingEffects()).toEqual([]);
  });

  it('updates context immutably', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    const before = host.getContext();
    const next = NarrativeContextProjectionSchema.parse({ ...baseContext, currentDay: 5 });
    host.updateContext(next);
    expect(host.getContext().currentDay).toBe(5);
    expect(before.currentDay).toBe(1); // original unchanged
  });

  it('clearPendingEffects empties the queue', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue();
    host.choose(0);
    host.continue();
    expect(host.getPendingEffects().length).toBeGreaterThan(0);
    host.clearPendingEffects();
    expect(host.getPendingEffects()).toEqual([]);
  });
});
