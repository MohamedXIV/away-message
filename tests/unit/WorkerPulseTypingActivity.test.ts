import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { buildFreshSandboxSocialState } from '../../src/simulation/host/FreshSandboxCast';
import { createWorkerPulseNarrative, deliverPendingPulseReplies } from '../../src/simulation/host/WorkerPulseNarrative';
import { pulseConversationStateText } from '../../src/apps/pulse/components/PulseChatPane';

function fixture() {
  const social = buildFreshSandboxSocialState('pulse-composing-window-223');
  const actorId = Object.keys(social.knownHandles ?? {})[0]!;
  const engine = new SimulationKernel({ social });
  const chrome = engine.getChromeRead.bind(engine);
  vi.spyOn(engine, 'getChromeRead').mockImplementation(() => ({
    ...chrome(), pulseInstalled: true,
  }));
  let status: 'online' | 'away' | 'busy' | 'offline' = 'online';
  let available = true;
  const read = engine.getPlayerActorRead.bind(engine);
  vi.spyOn(engine, 'getPlayerActorRead').mockImplementation(id => {
    const original = read(id);
    return original && id === actorId
      ? { ...original, actor: { ...original.actor, canChatNow: {
        allowed: available, reasons: available ? [] : ['not available'],
      } } } : original;
  });
  const presence = engine.social.getPresence.bind(engine.social);
  vi.spyOn(engine.social, 'getPresence').mockImplementation(id => id === actorId
    ? { status, awayMessage: status === 'away' ? 'back later' : '' } : presence(id));
  const narrative = createWorkerPulseNarrative(engine);
  const accountId = 'nightowl06';
  narrative.run({ kind: 'openAccount', accountId });
  narrative.run({ kind: 'addBuddy', accountId, actorId });
  const offered = narrative.run({ kind: 'choices', accountId, actorId });
  narrative.run({ kind: 'choose', accountId, actorId, choiceIndex: 0,
    expectedText: offered.choices[0]!.text });
  return {
    engine, actorId, accountId, narrative,
    setStatus(next: typeof status) { status = next; },
    setAvailable(next: boolean) { available = next; },
  };
}

function activity(result: unknown): string | undefined {
  return (result as { replyActivity?: string }).replyActivity;
}

describe('#223 canonical Pulse composing window', () => {
  it('shows an actual world-time composing window before delivery, then stops after the reply', () => {
    const { engine, actorId, accountId, narrative } = fixture();
    expect(activity(narrative.run({ kind: 'choices', accountId, actorId }))).toBe('waiting');
    engine.advanceGameMinutes(9);
    expect(activity(narrative.run({ kind: 'choices', accountId, actorId }))).toBe('waiting');
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    engine.advanceGameMinutes(1);
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    expect(activity(narrative.run({ kind: 'choices', accountId, actorId }))).toBe('typing');
    engine.advanceGameMinutes(2);
    expect(deliverPendingPulseReplies(engine)).toBe(0);
    engine.advanceGameMinutes(1);
    expect(deliverPendingPulseReplies(engine)).toBe(1);
    const view = narrative.run({ kind: 'choices', accountId, actorId });
    expect(view.phase).toBe('second');
    expect(activity(view)).toBe('idle');
    expect(deliverPendingPulseReplies(engine)).toBe(0);
  });

  it('never shows typing for away/busy/offline or for an NPC unable to chat', () => {
    const ctx = fixture();
    ctx.engine.advanceGameMinutes(11);
    for (const status of ['away', 'busy', 'offline'] as const) {
      ctx.setStatus(status);
      expect(activity(ctx.narrative.run({ kind: 'choices', accountId: ctx.accountId, actorId: ctx.actorId })))
        .toBe('waiting');
      expect(deliverPendingPulseReplies(ctx.engine)).toBe(0);
    }
    ctx.setStatus('online');
    ctx.setAvailable(false);
    expect(activity(ctx.narrative.run({ kind: 'choices', accountId: ctx.accountId, actorId: ctx.actorId })))
      .toBe('waiting');
    ctx.setAvailable(true);
    expect(activity(ctx.narrative.run({ kind: 'choices', accountId: ctx.accountId, actorId: ctx.actorId })))
      .toBe('typing');
  });

  it('reconstructs composing from canonical sent time after a cold restore', () => {
    const ctx = fixture();
    ctx.engine.advanceGameMinutes(10);
    const cold = new SimulationKernel(ctx.engine.exportSnapshot());
    const chrome = cold.getChromeRead.bind(cold);
    vi.spyOn(cold, 'getChromeRead').mockImplementation(() => ({ ...chrome(), pulseInstalled: true }));
    const actorRead = cold.getPlayerActorRead.bind(cold);
    vi.spyOn(cold, 'getPlayerActorRead').mockImplementation(id => {
      const value = actorRead(id);
      return value && id === ctx.actorId
        ? { ...value, actor: { ...value.actor, canChatNow: { allowed: true, reasons: [] } } }
        : value;
    });
    vi.spyOn(cold.social, 'getPresence').mockImplementation(id => id === ctx.actorId
      ? { status: 'online', awayMessage: '' } : { status: 'offline', awayMessage: '' });
    const narrative = createWorkerPulseNarrative(cold);
    expect(activity(narrative.run({ kind: 'choices', accountId: ctx.accountId, actorId: ctx.actorId })))
      .toBe('typing');
    cold.advanceGameMinutes(3);
    expect(deliverPendingPulseReplies(cold)).toBe(1);
    expect(activity(narrative.run({ kind: 'choices', accountId: ctx.accountId, actorId: ctx.actorId })))
      .toBe('idle');
  });

  it('renders truthful status text only when the online NPC is composing', () => {
    const text = pulseConversationStateText as (...args: unknown[]) => string;
    expect(text('waiting_first', { displayName: 'Alex', status: 'online' }, false, 'typing'))
      .toBe('Alex is typing…');
    expect(text('waiting_first', { displayName: 'Alex', status: 'away' }, false, 'typing'))
      .not.toContain('typing');
  });
});
