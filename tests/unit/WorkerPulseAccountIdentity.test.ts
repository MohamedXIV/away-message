import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createWorkerPulseNarrative } from '../../src/simulation/host/WorkerPulseNarrative';

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
    (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: 'nightowl06' });
    (narrative.run as (command: any) => any)({ kind: 'addBuddy', accountId: 'nightowl06', actorId });
    expect((engine.getMessengerRead as any)(32, 'nightowl06').contacts.map((row: { actorId: string }) => row.actorId)).toEqual([actorId]);

    (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: 'pixelghost' });
    expect((engine.getMessengerRead as any)(32, 'pixelghost').contacts).toEqual([]);
    expect((engine.getConversationRead as any)(actorId, 0, 30, 'pixelghost').messages).toEqual([]);
    expect(() => (narrative.run as (command: any) => any)({ kind: 'choices', accountId: 'pixelghost', actorId }))
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
    (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: 'nightowl06' });
    (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: 'pixelghost' });
    (narrative.run as (command: any) => any)({ kind: 'addBuddy', accountId: 'nightowl06', actorId });
    (narrative.run as (command: any) => any)({ kind: 'addBuddy', accountId: 'pixelghost', actorId });

    const offer = (narrative.run as (command: any) => any)({ kind: 'choices', accountId: 'nightowl06', actorId });
    const result = (narrative.run as (command: any) => any)({ kind: 'choose', accountId: 'nightowl06', actorId,
      choiceIndex: 0, expectedText: offer.choices[0]!.text });
    expect(result.sent).toBe(offer.choices[0]!.text);
    expect((engine.getConversationRead as any)(actorId, 0, 30, 'nightowl06').messages).toHaveLength(2);
    expect((engine.getConversationRead as any)(actorId, 0, 30, 'pixelghost').messages).toEqual([]);

    const restored = new SimulationKernel(engine.exportSnapshot());
    expect((restored.getMessengerRead as any)(32, 'pixelghost').contacts.map((row: { actorId: string }) => row.actorId)).toEqual([actorId]);
    expect((restored.getConversationRead as any)(actorId, 0, 30, 'nightowl06').messages).toHaveLength(2);
    expect((restored.getConversationRead as any)(actorId, 0, 30, 'pixelghost').messages).toEqual([]);
  });

  it('rejects unlearned buddy identities and unknown handles without changing Social', () => {
    const { engine, narrative } = fixture();
    (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: 'nightowl06' });
    const before = (engine.getMessengerRead as any)(32, 'nightowl06');
    expect(() => (narrative.run as (command: any) => any)({ kind: 'addBuddy', accountId: 'nightowl06',
      actorId: 'not-learned-actor' })).toThrow(/known|learned|buddy/i);
    expect(() => (narrative.run as (command: any) => any)({ kind: 'openAccount', accountId: '../../invalid' }))
      .toThrow(/account/i);
    expect((engine.getMessengerRead as any)(32, 'nightowl06')).toEqual(before);
  });
});
