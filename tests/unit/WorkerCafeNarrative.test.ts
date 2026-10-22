import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { createWorkerCafeNarrative } from '../../src/simulation/host/WorkerCafeNarrative';

function presentAtCafe() {
  const engine = new SimulationKernel();
  const travel = engine.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' });
  expect(travel.success).toBe(true);
  engine.relocateActorSpatially('maya', { x: 20, y: 60, z: 0 });
  expect(engine.getCafeGuestRead('place_a1').guest?.actorId).toBe('maya');
  return engine;
}

describe('Worker authored café narrative', () => {
  it('requires canonical player location and an actual known guest', () => {
    const engine = new SimulationKernel();
    const narrative = createWorkerCafeNarrative(engine);
    expect(() => narrative.run({ kind: 'startCafe' })).toThrow('must be at Starlight Café');
    expect(narrative.run({ kind: 'end' })).toEqual({ active: false, actor: null, frame: null });
    engine.dispatchAction({ type: 'TRAVEL_TO', to: 'cafe', mode: 'walk' });
    expect(() => narrative.run({ kind: 'startCafe' })).toThrow('No player-known contact');
  });

  it('uses compiled Ink choices and commits effects through canonical Social, not browser state', () => {
    const engine = presentAtCafe();
    const full = vi.spyOn(engine, 'getState');
    try {
      const narrative = createWorkerCafeNarrative(engine);
      const greeting = narrative.run({ kind: 'startCafe' });
      expect(greeting.actor).toEqual({ actorId: 'maya', displayName: expect.any(String) });
      expect(greeting.frame?.text).toContain('Hey! You made it!');
      expect(greeting.frame?.choices.map(choice => choice.text)).toEqual([
        "Ask how they've been", 'Make a dry joke about the coffee', 'Let the pause sit',
      ]);
      expect(JSON.stringify(greeting)).not.toContain('conversationHistory');
      expect(JSON.stringify(greeting)).not.toContain('social');
      expect(() => narrative.run({ kind: 'choose', choiceIndex: 12 }))
        .toThrow('Unknown or stale');
      const before = engine.social.getRelationships('maya');
      const response = narrative.run({ kind: 'choose', choiceIndex: 0 });
      expect(response.frame?.text).toContain('the week comes out sideways');
      expect(engine.social.getRelationships('maya')?.trust).toBeGreaterThan(before?.trust ?? 0);
      expect(full).not.toHaveBeenCalled();
      expect(narrative.run({ kind: 'end' }).active).toBe(false);
      expect(() => narrative.run({ kind: 'choose', choiceIndex: 0 })).toThrow('No active');
    } finally {
      full.mockRestore();
    }
  });

  it('fails closed if the player leaves before an authored effect', () => {
    const engine = presentAtCafe();
    const narrative = createWorkerCafeNarrative(engine);
    narrative.run({ kind: 'startCafe' });
    expect(engine.dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' }).success).toBe(true);
    expect(() => narrative.run({ kind: 'choose', choiceIndex: 0 }))
      .toThrow('must be at Starlight Café');
    expect(() => narrative.run({ kind: 'choose', choiceIndex: 0 })).toThrow('No active');
  });
  it('does not restore an orphaned cursor when the player or actor leaves the café', () => {
    const source = presentAtCafe();
    const first = createWorkerCafeNarrative(source);
    first.run({ kind: 'startCafe' });
    const checkpoint = first.checkpoint();
    expect(checkpoint?.coordinator.session?.actorId).toBe('maya');

    const departed = new SimulationKernel(source.exportSnapshot());
    expect(departed.dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' }).success).toBe(true);
    const restored = createWorkerCafeNarrative(departed);
    expect(restored.restore(checkpoint)).toBe(false);
    expect(restored.run({ kind: 'current' }))
      .toEqual({ active: false, actor: null, frame: null });
  });

  it('restores only verified authored choice points without replaying social effects', () => {
    const source = presentAtCafe();
    const first = createWorkerCafeNarrative(source);
    first.run({ kind: 'startCafe' });
    const checkpoint = first.checkpoint();
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.version).toBe(2);
    expect(checkpoint?.display.text).toContain('Hey! You made it!');
    const second = createWorkerCafeNarrative(source);
    const before = source.social.getRelationships('maya');
    expect(second.restore(checkpoint)).toBe(true);
    const current = second.run({ kind: 'current' });
    expect(current.frame?.choices[0]?.text).toBe("Ask how they've been");
    // Regression: the Ink cursor recovers choice IDs but not the preceding
    // display text. The saved bounded frame must restore both.
    expect(current.frame?.text).toContain('Hey! You made it!');
    expect(source.social.getRelationships('maya')).toEqual(before);
    expect(second.run({ kind: 'choose', choiceIndex: 0 }).frame?.text)
      .toContain('week comes out sideways');
    expect(source.social.getRelationships('maya')?.trust).toBeGreaterThan(before?.trust ?? 0);
  });

  it('rejects a tampered display choice rather than trusting sidecar IDs or replaying effects', () => {
    const source = presentAtCafe();
    const first = createWorkerCafeNarrative(source);
    first.run({ kind: 'startCafe' });
    const saved = first.checkpoint()!;
    const before = source.social.getRelationships('maya');
    const second = createWorkerCafeNarrative(source);
    const tampered = { ...saved, display: {
      ...saved.display,
      choices: saved.display.choices.map((choice, index) => index === 0
        ? { ...choice, text: 'Unauthorized choice' } : choice),
    } };
    expect(second.restore(tampered)).toBe(false);
    expect(second.run({ kind: 'current' }))
      .toEqual({ active: false, actor: null, frame: null });
    expect(source.social.getRelationships('maya')).toEqual(before);
    expect(second.restore({ ...saved, display: { ...saved.display, text: '' } })).toBe(false);
  });
});
