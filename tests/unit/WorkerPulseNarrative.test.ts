import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createWorkerPulseNarrative } from '../../src/simulation/host/WorkerPulseNarrative';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type { SimulationWorkerReply } from '../../src/simulation/host/SimulationHostProtocol';

function fixture() {
  const social = buildFreshSandboxSocialState('ink-choice-playtest-001');
  const actorId = Object.keys(social.knownHandles ?? {})[0]!;
  const engine = new SimulationKernel({ social });
  // Full installed-software acquisition is proven separately by ScenarioZ.
  const readChrome = engine.getChromeRead.bind(engine);
  vi.spyOn(engine, 'getChromeRead').mockImplementation(() => ({
    ...readChrome(), pulseInstalled: true,
  }));
  return { engine, actorId, narrative: createWorkerPulseNarrative(engine) };
}

describe('#223 offline Ink-first Worker Pulse', () => {
  it('offers real Ink choices only for known actors, validating exact offered wording', () => {
    const { engine, actorId, narrative } = fixture();
    const offer = narrative.run({ kind: 'choices', actorId });
    expect(offer.choices.map(x => x.text)).toEqual([
      'Hey! How have you been lately?',
      'How was your shift at the diner?',
      'Hope you get a chance to rest after work.',
    ]);
    const before = engine.getConversationRead(actorId, 0, 20).messages.length;
    expect(() => narrative.run({ kind: 'choose', actorId, choiceIndex: 99,
      expectedText: 'an invented player sentence' })).toThrow();
    expect(() => narrative.run({ kind: 'choose', actorId, choiceIndex: 0,
      expectedText: 'I know all your secrets.' })).toThrow('no longer available');
    expect(() => narrative.run({ kind: 'choices', actorId: 'unknown-id' }))
      .toThrow('not in your buddy list');
    expect(engine.getConversationRead(actorId, 0, 20).messages).toHaveLength(before);
  });

  it('sends authored player messages and NPC replies through canonical Social and cold restore', () => {
    const { engine, actorId, narrative } = fixture();
    const realActorRead = engine.getPlayerActorRead.bind(engine);
    vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
      const read = realActorRead(id);
      return read && id === actorId
        ? { ...read, actor: { ...read.actor, canChatNow: { allowed: true, reasons: [] } } }
        : read;
    });
    const chosen = narrative.run({ kind: 'choices', actorId }).choices[0]!;
    const result = narrative.run({ kind: 'choose', actorId, choiceIndex: 0,
      expectedText: chosen.text });
    expect(result.sent).toBe(chosen.text);
    expect(result.reply).toContain('long shift');
    const page = engine.getConversationRead(actorId, 0, 20);
    expect(page.messages.map(m => m.text)).toEqual([chosen.text, result.reply]);
    expect(page.messages.map(m => m.senderId)).toEqual(['player', actorId]);
    expect(page.messages[1]?.tags).toContain('ink_pulse');
    const restored = new SimulationKernel(engine.exportSnapshot());
    expect(restored.getConversationRead(actorId, 0, 20).messages.map(m => m.text))
      .toEqual([chosen.text, result.reply]);
  });

  it('retains player message but does not invent an immediate answer from offline contacts', () => {
    const { engine, actorId, narrative } = fixture();
    const realActorRead = engine.getPlayerActorRead.bind(engine);
    vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
      const read = realActorRead(id);
      return read && id === actorId
        ? { ...read, actor: { ...read.actor, canChatNow: {
          allowed: false, reasons: ['offline'],
        } } } : read;
    });
    const selected = narrative.run({ kind: 'choices', actorId }).choices[2]!;
    const result = narrative.run({ kind: 'choose', actorId, choiceIndex: 2,
      expectedText: selected.text });
    expect(result.reply).toBeNull();
    expect(engine.getConversationRead(actorId, 0, 20).messages.map(m => m.text))
      .toEqual([selected.text]);
  });

  it('separates local real-world occupations from remote-only Pulse friends', () => {
    const { engine, narrative } = fixture();
    const discovered = Object.keys(engine.exportSnapshot().social.knownHandles ?? {});
    const localId = discovered.find(id => engine.social.getBuddy(id)?.reach === 'local')!;
    const remoteId = discovered.find(id => engine.social.getBuddy(id)?.reach === 'remote')!;
    expect(localId).toBeTruthy();
    expect(remoteId).toBeTruthy();

    const local = narrative.run({ kind: 'choices', actorId: localId }).choices.map(c => c.text);
    const remote = narrative.run({ kind: 'choices', actorId: remoteId }).choices.map(c => c.text);
    expect(local).toContain('How was your shift at the diner?');
    expect(remote).toContain("What's been happening on your side of the screen?");
    expect(remote.some(text => /diner|meet me|in the village/i.test(text))).toBe(false);
    expect(remote).not.toEqual(local);
  });

  it('offers repair and trusted conversations based on current canonical bond semantics', () => {
    const { engine, actorId, narrative } = fixture();
    const readActor = engine.getPlayerActorRead.bind(engine);
    const mock = vi.spyOn(engine, 'getPlayerActorRead');
    mock.mockImplementation(id => {
      const actor = readActor(id);
      return actor && id === actorId
        ? { ...actor, actor: { ...actor.actor, relationship: {
          ...actor.actor.relationship, conflicted: true, trusted: false,
        } } } : actor;
    });
    const repair = narrative.run({ kind: 'choices', actorId }).choices;
    expect(repair.map(c => c.text)).toContain("I'm sorry for my part in it.");
    expect(repair.map(c => c.text)).not.toContain('How was your shift at the diner?');
    const selected = repair[1]!;
    const chosen = narrative.run({ kind: 'choose', actorId, choiceIndex: 1,
      expectedText: selected.text });
    expect(chosen.sent).toBe("I'm sorry for my part in it.");

    mock.mockImplementation(id => {
      const actor = readActor(id);
      return actor && id === actorId
        ? { ...actor, actor: { ...actor.actor, relationship: {
          ...actor.actor.relationship, conflicted: false, trusted: true,
        } } } : actor;
    });
    const trusted = narrative.run({ kind: 'choices', actorId }).choices;
    expect(trusted.map(c => c.text)).toContain('Something on your mind? You can tell me.');
    expect(trusted).not.toEqual(repair);
    expect(() => narrative.run({ kind: 'choose', actorId, choiceIndex: 1,
      expectedText: selected.text })).toThrow('no longer available');
  });

  it('unlocks reminiscence only for a typed memory involving player and selected actor', () => {
    const { engine, actorId, narrative } = fixture();
    const standard = narrative.run({ kind: 'choices', actorId }).choices;
    engine.social.addCoreMemory(actorId, {
      kind: 'shared_moment', day: 1, text: 'A good afternoon with an old acquaintance',
      meaning: {
        participants: ['player', 'other_actor'],
        subject: { kind: 'fact', id: 'old_photo' },
        source: { kind: 'direct_experience', refId: 'photo_001' },
        salience: 'medium', valence: 'positive',
      },
    });
    expect(narrative.run({ kind: 'choices', actorId }).choices).toEqual(standard);

    engine.social.addCoreMemory(actorId, {
      kind: 'shared_moment', day: 2, text: 'An afternoon the player spent with this actor',
      meaning: {
        participants: ['player', actorId],
        subject: { kind: 'fact', id: 'shared_afternoon' },
        source: { kind: 'direct_experience', refId: 'afternoon_001' },
        salience: 'high', valence: 'positive',
      },
    });
    const choices = narrative.run({ kind: 'choices', actorId }).choices.map(c => c.text);
    expect(choices).toContain('Remember when we spent that time together?');
    expect(choices).not.toContain('How was your shift at the diner?');
    const cold = new SimulationKernel(engine.exportSnapshot());
    const readChrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({
      ...readChrome(), pulseInstalled: true,
    }));
    expect(createWorkerPulseNarrative(cold).run({ kind: 'choices', actorId })
      .choices.map(c => c.text)).toEqual(choices);
  });

  it('rejects unrestricted legacy Pulse sends instead of pretending to parse prose', async () => {
    const messages: SimulationWorkerReply[] = [];
    const worker = createSimulationWorkerRuntime(message => messages.push(message));
    try {
      await worker.receive({ id: 1, op: 'init',
        freshRosterSeed: 'ink-choice-playtest-002' });
      await worker.receive({ id: 2, op: 'dispatch',
        action: { type: 'PULSE_SEND_MESSAGE', buddyId: 'invented', text: 'arbitrary prose' } });
      const reply = messages.find(m => m.type === 'result' && m.id === 2);
      expect(reply).toMatchObject({
        type: 'result', id: 2, ok: true,
        value: { success: false, error: expect.stringContaining('Choose') },
      });
    } finally {
      worker.close();
    }
  });
});
