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
      'Do you ever log off, or is that just a myth? ;)',
      "Hope you're having a nice evening.",
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
    expect(result.reply).toContain('thanks for checking in');
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
