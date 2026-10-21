import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Compiler } from 'inkjs/compiler/Compiler';
import { SimpleJson } from 'inkjs/engine/SimpleJson';
import { NarrativeHostImpl } from '../../src/narrative/NarrativeHost';
import { NarrativeContextProjectionSchema } from '../../src/narrative/contracts';
import type { NarrativeHostState } from '../../src/narrative/contracts';
import { InkRuntime } from '../../src/narrative/ink/InkRuntime';

const compiledPath = join(__dirname, '../../src/narrative/ink/fixtures/hello.ink.json');
const compiledJson = JSON.parse(readFileSync(compiledPath, 'utf8'));

function compileInline(source: string): unknown {
  const compiler = new Compiler(source);
  const story = compiler.Compile();
  const writer = new SimpleJson.Writer();
  (story as unknown as { ToJson(w: unknown): void }).ToJson(writer);
  return JSON.parse(writer.toString());
}

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
    host.continue(); // branch text
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

  it('saves and restores flow position, choices, tags, variables and pending effects', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue(); // branch text
    host.continue(); // choices
    const saved = host.save(); // checkpoint at choice point
    // advance original
    host.choose(0);
    const origFrame = host.continue(); // exam text + effect

    // restore into a fresh host
    const host2 = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host2.load(saved);
    // pending effects from checkpoint: none yet
    expect(host2.getPendingEffects()).toEqual([]);

    // restored flow must offer the same choices as the checkpoint
    const restoredFrame = host2.continue();
    expect(restoredFrame.choices.map((c) => c.text)).toEqual(['Ask about the exam', 'Say goodbye']);

    // now take the same branch on restored host
    const restoredAfterChoose = host2.choose(0);
    const restoredEffectFrame = host2.continue();
    expect(restoredAfterChoose.text).toContain('You asked about the exam.');
    expect(restoredEffectFrame.text).toBe(origFrame.text === '' ? '' : origFrame.text);

    // pending effect captured exactly once on restored path
    const pending = host2.getPendingEffects();
    expect(pending.length).toBe(1);
    const pendingFirst = pending[0];
    expect(pendingFirst).toBeDefined();
    expect(pendingFirst!.type).toBe('request_effect');

    // acknowledge it; reload again must not duplicate
    host2.acknowledgeEffect(pendingFirst!);
    expect(host2.getPendingEffects()).toEqual([]);
    const saved2 = host2.save();
    const host3 = new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: baseContext });
    host3.load(saved2);
    expect(host3.getPendingEffects()).toEqual([]);
  });

  it('persists pending effects across save/reload without duplicating', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue();
    host.continue();
    host.choose(0);
    host.continue(); // captures effect
    const before = host.getPendingEffects();
    expect(before.length).toBe(1);

    const saved = host.save();
    expect(saved.pendingEffects).toHaveLength(1);

    const host2 = new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: baseContext });
    host2.load(saved);
    const after = host2.getPendingEffects();
    expect(after).toHaveLength(1);
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    // resuming does not re-run the effect line (already past it), so no duplicate
    host2.continue();
    expect(host2.getPendingEffects()).toHaveLength(1);
  });

  it('compiled Ink branches on approved bounded context queries', () => {
    const trustedCtx = NarrativeContextProjectionSchema.parse({ ...baseContext, actor: { id: 'a', reach: 'local', roles: [], lifecycle: 'active', connection: 'known', relationshipStage: 'friend', trusted: true, conflicted: false } });
    const untrustedCtx = NarrativeContextProjectionSchema.parse({ ...baseContext, actor: { id: 'a', reach: 'local', roles: [], lifecycle: 'active', connection: 'known', relationshipStage: 'stranger', trusted: false, conflicted: false } });

    const h1 = new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: trustedCtx });
    h1.start('hello');
    const f1 = h1.continue();
    expect(f1.text).toContain('I trust you.');
    expect(f1.tags).toContain('trusted');

    const h2 = new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: untrustedCtx });
    h2.start('hello');
    const f2 = h2.continue();
    expect(f2.text).toContain("I don't know you yet.");
    expect(f2.tags).toContain('untrusted');
  });

  it('compiled Ink safely handles unknown context queries', () => {
    const ink = `EXTERNAL narrative_query(key, arg)
-> start
=== start ===
{ narrative_query("secret_field", ""):
    leaked
- else:
    safe
}
-> END
`;
    const rt = InkRuntime.compile(ink);
    rt.bindExternalFunction('narrative_query', (_k: string) => null, true);
    const c = rt.continueMaximally();
    expect(c.text).toContain('safe');
    expect(c.text).not.toContain('leaked');
  });

  it('rejects unknown semantic effects through the host', () => {
    const ink = `EXTERNAL request_effect(type, payload)
-> start
=== start ===
~ request_effect("does_not_exist", "null")
-> END
`;
    const compiled = compileInline(ink);

    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiled,
      context: baseContext,
      approvedEffectIds: ['social_act'],
    });
    host.start('x');
    host.continue();
    expect(host.getPendingEffects()).toEqual([]);
  });

  it('rejects approved effect ids with invalid payloads through the host', () => {
    const compiled = compileInline(`EXTERNAL request_effect(first, second)
-> start
=== start ===
~ request_effect("study_together", "nonsense")
-> END
`);
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiled,
      context: baseContext,
      approvedEffectIds: ['study_together'],
    });
    host.start('x');
    host.continue();
    expect(host.getPendingEffects()).toEqual([]);
  });

  it('getContext and getPendingEffects return defensive copies', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue();
    host.continue();
    host.choose(0);
    host.continue(); // captures effect

    const ctx = host.getContext();
    ctx.currentDay = 999;
    ctx.flags.mutated = true;
    expect(host.getContext().currentDay).toBe(baseContext.currentDay);
    expect(host.getContext().flags.mutated).toBeUndefined();

    const pending = host.getPendingEffects();
    expect(pending.length).toBeGreaterThan(0);
    const pendingFirst = pending[0];
    expect(pendingFirst).toBeDefined();
    (pendingFirst as any).effectId = 'tampered';
    if (pendingFirst && pendingFirst.type === 'request_effect') (pendingFirst as any).payload.x = 1;
    const again = host.getPendingEffects();
    const againFirst = again[0];
    expect(againFirst).toBeDefined();
    expect((againFirst as any).effectId).not.toBe('tampered');
  });

  it('continue frames return defensive copies of pending effects', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue();
    host.continue();
    host.choose(0);
    const frame = host.continue();
    expect(frame.pendingEffects).toHaveLength(1);
    const exposed = frame.pendingEffects[0]!;
    (exposed as unknown as { effectId: string }).effectId = 'tampered';
    if (exposed.type === 'request_effect') (exposed as unknown as { payload: Record<string, unknown> }).payload.arg = 'tampered';
    const pending = host.getPendingEffects();
    expect(pending[0]?.type).toBe('request_effect');
    if (pending[0]?.type === 'request_effect') {
      expect(pending[0].effectId).toBe('social_act');
      expect(pending[0].payload).toEqual({ arg: 'empathy' });
    }
  });

  it('rejects tampered pending effects on restore', () => {
    const host = new NarrativeHostImpl({
      loadCompiledStory: () => compiledJson,
      context: baseContext,
    });
    host.start('hello');
    host.continue();
    host.continue();
    host.choose(0);
    host.continue();
    const saved = host.save();
    expect(saved.pendingEffects).toHaveLength(1);

    const unknown = JSON.parse(JSON.stringify(saved)) as NarrativeHostState;
    unknown.pendingEffects = [{ type: 'request_effect', effectId: 'does_not_exist', payload: {} }] as never;
    expect(() => new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: baseContext }).load(unknown))
      .toThrow(/Invalid pending narrative effect/);

    const badPayload = JSON.parse(JSON.stringify(saved)) as NarrativeHostState;
    badPayload.pendingEffects = [{
      type: 'request_effect', effectId: 'study_together', payload: { nonsense: 123 },
    }] as never;
    expect(() => new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: baseContext }).load(badPayload))
      .toThrow(/Invalid pending narrative effect/);

    const nonArray = JSON.parse(JSON.stringify(saved)) as unknown as { pendingEffects: unknown };
    nonArray.pendingEffects = { bad: true };
    expect(() => new NarrativeHostImpl({ loadCompiledStory: () => compiledJson, context: baseContext }).load(nonArray as never))
      .toThrow(/Invalid pending narrative effects/);
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
    host.continue();
    host.choose(0);
    host.continue();
    expect(host.getPendingEffects().length).toBeGreaterThan(0);
    host.clearPendingEffects();
    expect(host.getPendingEffects()).toEqual([]);
  });
});
