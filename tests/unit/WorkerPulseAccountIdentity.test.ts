import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createWorkerPulseNarrative, deliverPendingPulseReplies } from '../../src/simulation/host/WorkerPulseNarrative';

function fixture() {
  const social = buildFreshSandboxSocialState('separate-pulse-identities-223');
  const actorId = Object.keys(social.knownHandles ?? {})[0]!;
  const engine = new SimulationKernel({ social });
  const chrome = engine.getChromeRead.bind(engine);
  vi.spyOn(engine, 'getChromeRead').mockImplementation(() => ({
    ...chrome(), pulseInstalled: true,
  }));
  return { engine, actorId, narrative: createWorkerPulseNarrative(engine) };
}

describe('#223 independent player Pulse identities', () => {
  it('opens a second handle with no inherited buddies or messages', () => {
    const { engine, actorId, narrative } = fixture();
    narrative.run({ kind: 'openAccount', accountId: 'nightowl06' });
    narrative.run({ kind: 'addBuddy', accountId: 'nightowl06', actorId });
    expect(engine.getMessengerRead(32, 'nightowl06').contacts.map((row: { actorId: string }) => row.actorId)).toEqual([actorId]);

    narrative.run({ kind: 'openAccount', accountId: 'pixelghost' });
    expect(engine.getMessengerRead(32, 'pixelghost').contacts).toEqual([]);
    expect(engine.getConversationRead(actorId, 0, 30, 'pixelghost').messages).toEqual([]);
    expect(() => narrative.run({ kind: 'choices', accountId: 'pixelghost', actorId }))
      .toThrow(/buddy list/i);
  });

  it('saves conversations under the sending handle and survives a cold restore', () => {
    const { engine, actorId, narrative } = fixture();
    const original = engine.getPlayerActorRead.bind(engine);
    vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
      const read = original(id);
      return read && id === actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } }
        : read;
    });
    const originalPresence = engine.social.getPresence.bind(engine.social);
    vi.spyOn(engine.social, 'getPresence').mockImplementation(id => id === actorId
      ? { status: 'online', awayMessage: '' } : originalPresence(id));
    narrative.run({ kind: 'openAccount', accountId: 'nightowl06' });
    narrative.run({ kind: 'openAccount', accountId: 'pixelghost' });
    narrative.run({ kind: 'addBuddy', accountId: 'nightowl06', actorId });
    narrative.run({ kind: 'addBuddy', accountId: 'pixelghost', actorId });

    const offer = narrative.run({ kind: 'choices', accountId: 'nightowl06', actorId });
    const result = narrative.run({ kind: 'choose', accountId: 'nightowl06', actorId,
      choiceIndex: 0, expectedText: offer.choices[0]!.text });
    expect(result.sent).toBe(offer.choices[0]!.text);
    expect(result.reply).toBeNull();
    expect(result.phase).toBe('waiting_first');
    expect(engine.getConversationRead(actorId, 0, 30, 'nightowl06').messages).toHaveLength(1);
    engine.advanceGameMinutes(9);
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    engine.advanceGameMinutes(1);
    expect(deliverPendingPulseReplies(engine)).toBe(1);
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    expect(engine.getConversationRead(actorId, 0, 30, 'nightowl06').messages).toHaveLength(2);
    expect(engine.getConversationRead(actorId, 0, 30, 'pixelghost').messages).toEqual([]);

    const restored = new SimulationKernel(engine.exportSnapshot());
    expect(restored.getMessengerRead(32, 'pixelghost').contacts.map((row: { actorId: string }) => row.actorId)).toEqual([actorId]);
    expect(restored.getConversationRead(actorId, 0, 30, 'nightowl06').messages).toHaveLength(2);
    expect(restored.getConversationRead(actorId, 0, 30, 'pixelghost').messages).toEqual([]);
  });

  it('holds queued replies while the same NPC is away, even if otherwise able to chat', () => {
    const { engine, actorId, narrative } = fixture();
    const original = engine.getPlayerActorRead.bind(engine);
    vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
      const read = original(id);
      return read && id === actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } }
        : read;
    });
    let away = true;
    const originalPresence = engine.social.getPresence.bind(engine.social);
    vi.spyOn(engine.social, 'getPresence').mockImplementation(id => id === actorId
      ? { status: away ? 'away' : 'online', awayMessage: away ? 'be back later' : '' }
      : originalPresence(id));

    narrative.run({ kind: 'openAccount', accountId: 'nightowl06' });
    narrative.run({ kind: 'addBuddy', accountId: 'nightowl06', actorId });
    const offered = narrative.run({ kind: 'choices', accountId: 'nightowl06', actorId });
    narrative.run({ kind: 'choose', accountId: 'nightowl06', actorId,
      choiceIndex: 0, expectedText: offered.choices[0]!.text });
    engine.advanceGameMinutes(11);
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    expect(engine.getConversationRead(actorId, 0, 30, 'nightowl06').messages).toHaveLength(1);
    away = false;
    expect(deliverPendingPulseReplies(engine)).toBe(1);
    expect(engine.getConversationRead(actorId, 0, 30, 'nightowl06').messages).toHaveLength(2);
  });

  it('rejects unlearned buddy identities and unknown handles without changing Social', () => {
    const { engine, narrative } = fixture();
    narrative.run({ kind: 'openAccount', accountId: 'nightowl06' });
    const before = engine.getMessengerRead(32, 'nightowl06');
    expect(() => narrative.run({ kind: 'addBuddy', accountId: 'nightowl06',
      actorId: 'not-learned-actor' })).toThrow(/known|learned|buddy/i);
    expect(() => narrative.run({ kind: 'openAccount', accountId: '../../invalid' }))
      .toThrow(/account/i);
    expect(engine.getMessengerRead(32, 'nightowl06')).toEqual(before);
  });
});

/** Canonical replies carry authored meaning cues; menu selection must follow what
 * the NPC actually said, not blindly replay the player's opening choice. */
describe('#223 reply-aware signed-in Pulse continuation', () => {
  function available() {
    const ctx = fixture();
    const readActor = ctx.engine.getPlayerActorRead.bind(ctx.engine);
    vi.spyOn(ctx.engine, 'getPlayerActorRead').mockImplementation(id => {
      const read = readActor(id);
      return read && id === ctx.actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } }
        : read;
    });
    const presence = ctx.engine.social.getPresence.bind(ctx.engine.social);
    vi.spyOn(ctx.engine.social, 'getPresence').mockImplementation(id => id === ctx.actorId
      ? { status: 'online', awayMessage: '' } : presence(id));
    ctx.narrative.run({ kind: 'openAccount', accountId: 'nightowl06' });
    ctx.narrative.run({ kind: 'addBuddy', accountId: 'nightowl06', actorId: ctx.actorId });
    return ctx;
  }

  it('answers a reciprocal question with relevant Ink choices and survives a cold pending follow-up', () => {
    const { engine, actorId, narrative } = available();
    const accountId = 'nightowl06';
    const first = narrative.run({ kind: 'choices', actorId, accountId });
    narrative.run({ kind: 'choose', actorId, accountId, choiceIndex: 0,
      expectedText: first.choices[0]!.text });
    engine.advanceGameMinutes(10);
    expect(deliverPendingPulseReplies(engine)).toBe(1);
    const response = engine.getConversationRead(actorId, 0, 10, accountId).messages.at(-1)!;
    expect(response.text).toMatch(/how about you/i);
    expect(response.tags).toContain('pulse:cue:reciprocal');
    const second = narrative.run({ kind: 'choices', actorId, accountId });
    expect(second.phase).toBe('second');
    expect(second.choices.map(choice => choice.text)).toContain('Honestly? Pretty wiped out today.');
    expect(second.choices.map(choice => choice.text)).not.toContain('That sounds like a lot. Want to say more?');

    narrative.run({ kind: 'choose', actorId, accountId, choiceIndex: 1,
      expectedText: second.choices[1]!.text });
    const pending = engine.getConversationRead(actorId, 0, 10, accountId).messages.at(-1)!;
    expect(pending.tags).toContain('pulse:v2:followup_out:0:1:pulse_followup_reciprocal');
    const cold = new SimulationKernel(engine.exportSnapshot());
    const chrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({ ...chrome(), pulseInstalled: true }));
    const actorRead = cold.getPlayerActorRead.bind(cold);
    vi.spyOn(cold, 'getPlayerActorRead').mockImplementation(id => {
      const read = actorRead(id);
      return read && id === actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } } : read;
    });
    vi.spyOn(cold.social, 'getPresence').mockImplementation(id => id === actorId
      ? { status: 'online', awayMessage: '' } : { status: 'offline', awayMessage: '' });
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId, accountId }).phase)
      .toBe('waiting_second');
    cold.advanceGameMinutes(10);
    expect(deliverPendingPulseReplies(cold)).toBe(1);
    expect(cold.getConversationRead(actorId, 0, 10, accountId).messages.at(-1)?.text)
      .toContain('Hope you get a break soon');
  });

  it('offers authored banter after an actual playful reply, not unrelated work questions', () => {
    const { engine, actorId, narrative } = available();
    const accountId = 'nightowl06';
    const first = narrative.run({ kind: 'choices', actorId, accountId });
    narrative.run({ kind: 'choose', actorId, accountId, choiceIndex: 1,
      expectedText: first.choices[1]!.text });
    engine.advanceGameMinutes(10);
    expect(deliverPendingPulseReplies(engine)).toBe(1);
    expect(engine.getConversationRead(actorId, 0, 10, accountId).messages.at(-1)?.tags)
      .toContain('pulse:cue:playful');
    const second = narrative.run({ kind: 'choices', actorId, accountId });
    expect(second.choices.map(choice => choice.text)).toContain("So what's keeping you online tonight?");
    expect(second.choices.map(choice => choice.text)).not.toContain('Did you enjoy it?');
  });

  it('derives the follow-up from the canonical reply cue even if the initial opener differs', () => {
    const { engine, actorId, narrative } = available();
    const accountId = 'nightowl06';
    const first = narrative.run({ kind: 'choices', actorId, accountId });
    narrative.run({ kind: 'choose', actorId, accountId, choiceIndex: 0,
      expectedText: first.choices[0]!.text });
    expect(engine.dispatchAction({
      type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: actorId, pulseAccountId: accountId,
      text: 'lol. i practically live in this window.', tags: [
        'ink_pulse', 'authored', 'pulse:v2:response:0', 'pulse:cue:playful',
      ],
    }).success).toBe(true);
    const second = narrative.run({ kind: 'choices', actorId, accountId });
    expect(second.choices.map(choice => choice.text)).toContain("So what's keeping you online tonight?");
    expect(second.choices.map(choice => choice.text)).not.toContain('Honestly? Pretty wiped out today.');
  });
});
