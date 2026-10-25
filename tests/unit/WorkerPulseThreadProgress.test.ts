import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createWorkerPulseNarrative, deliverPendingPulseReplies } from '../../src/simulation/host/WorkerPulseNarrative';

function world(seed = 'multi-turn-ink-123') {
  const social = buildFreshSandboxSocialState(seed);
  const actorId = Object.keys(social.knownHandles ?? {})[0]!;
  const engine = new SimulationKernel({ social });
  const getChrome = engine.getChromeRead.bind(engine);
  vi.spyOn(engine, 'getChromeRead').mockImplementation(() => ({ ...getChrome(), pulseInstalled: true }));
  const getActor = engine.getPlayerActorRead.bind(engine);
  let online = false;
  vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
    const read = getActor(id);
    return read && id === actorId
      ? { ...read, actor: { ...read.actor, canChatNow: {
        allowed: online, reasons: online ? [] : ['offline'],
      } } } : read;
  });
  return {
    engine, actorId,
    narrative: createWorkerPulseNarrative(engine),
    setOnline(value: boolean) { online = value; },
  };
}

describe('#223 two-turn canonical Pulse conversations', () => {
  it('continues with different authored choices, concludes naturally, and cold restores that stage', () => {
    const ctx = world();
    ctx.setOnline(true);
    const initial = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId });
    expect(initial.phase).toBe('first');
    const first = ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 0, expectedText: initial.choices[0]!.text });
    expect(first.reply).toContain('long shift');
    expect(first.phase).toBe('second');
    expect(first.choices.map(c => c.text)).toContain('That sounds like a lot. Want to say more?');
    expect(first.choices).not.toEqual(initial.choices);
    const resumed = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId });
    expect(resumed.choices).toEqual(first.choices);
    const second = ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 1, expectedText: first.choices[1]!.text });
    expect(second.reply).toContain('something good about your day');
    expect(second.phase).toBe('complete');
    expect(second.choices).toEqual([]);
    expect(ctx.engine.getConversationRead(ctx.actorId, 0, 10).messages).toHaveLength(4);
    const cold = new SimulationKernel(ctx.engine.exportSnapshot());
    const getChrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({ ...getChrome(), pulseInstalled: true }));
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId: ctx.actorId }).phase).toBe('complete');
    expect(() => ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 0, expectedText: initial.choices[0]!.text })).toThrow('waiting or has ended');
  });

  it('waits for time plus real availability, never replies on read, and delivers exactly once', () => {
    const ctx = world('multi-turn-ink-456');
    const offered = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId });
    const send = ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 1, expectedText: offered.choices[1]!.text });
    expect(send.reply).toBeNull();
    expect(send.phase).toBe('waiting_first');
    expect(send.choices).toHaveLength(0);
    expect(ctx.engine.getConversationRead(ctx.actorId, 0, 10).messages).toHaveLength(1);
    expect(ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId }).phase).toBe('waiting_first');
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    ctx.setOnline(true);
    ctx.engine.advanceGameMinutes(9);
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    ctx.engine.advanceGameMinutes(1);
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(1);
    expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    const second = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId });
    expect(second.phase).toBe('second');
    expect(second.choices.map(c => c.text)).toContain('Did you enjoy it?');
    const logs = ctx.engine.getConversationRead(ctx.actorId, 0, 10).messages;
    expect(logs).toHaveLength(2);
    expect(logs[1]?.tags).toContain('pulse:v2:response:1');
    expect(logs[1]?.senderId).toBe(ctx.actorId);
  });

  it('cold-restores a pending second turn with the chosen reply index, not the opening topic', () => {
    const ctx = world('multi-turn-ink-789');
    ctx.setOnline(true);
    const first = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId }).choices[0]!;
    const response = ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 0, expectedText: first.text });
    ctx.setOnline(false);
    const sent = ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 1, expectedText: response.choices[1]!.text });
    expect(sent.phase).toBe('waiting_second');
    expect(sent.reply).toBeNull();
    const cold = new SimulationKernel(ctx.engine.exportSnapshot());
    const getChrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({ ...getChrome(), pulseInstalled: true }));
    const getActor = cold.getPlayerActorRead.bind(cold);
    vi.spyOn(cold, 'getPlayerActorRead').mockImplementation(id => {
      const read = getActor(id);
      return read && id === ctx.actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } } : read;
    });
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId: ctx.actorId }).phase)
      .toBe('waiting_second');
    cold.advanceGameMinutes(10);
    expect(deliverPendingPulseReplies(cold)).toBe(1);
    expect(deliverPendingPulseReplies(cold)).toBe(0);
    const transcript = cold.getConversationRead(ctx.actorId, 0, 10).messages;
    expect(transcript).toHaveLength(4);
    expect(transcript.at(-1)?.text).toContain('something good about your day');
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId: ctx.actorId }).phase)
      .toBe('complete');
  });

  it('does not let a pending thread accept additional player messages', () => {
    const ctx = world('multi-turn-ink-321');
    const first = ctx.narrative.run({ kind: 'choices', actorId: ctx.actorId }).choices;
    ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 0, expectedText: first[0]!.text });
    expect(() => ctx.narrative.run({ kind: 'choose', actorId: ctx.actorId,
      choiceIndex: 1, expectedText: first[1]!.text })).toThrow('waiting or has ended');
    expect(ctx.engine.getConversationRead(ctx.actorId, 0, 10).messages).toHaveLength(1);
  });
});
