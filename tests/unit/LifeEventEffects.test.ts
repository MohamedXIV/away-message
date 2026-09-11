import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildLifeMatrixSnapshot } from '../../src/engine/life/LifeSnapshot';
import { createSimulationLifeSources } from '../../src/engine/life/LifeSources';
import { buildCharacterObligations } from '../../src/engine/life/Obligations';

/**
 * RED-first TDD for #46 Life Matrix boundary: event constraints and
 * opportunities are readable with source provenance, never copied as
 * canonical truth, and never persisted. No intent selection (#44).
 */
describe('Life Matrix event effects (#46)', () => {
  it('projects active event effects with provenance and without event-truth copies', () => {
    const sim = new SimulationEngine();
    const [actor] = sim.social.getBuddies();
    if (!actor) throw new Error('Expected at least one Away character.');
    const firedAt = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', firedAt);

    const sources = createSimulationLifeSources(sim);
    const snapshot = buildLifeMatrixSnapshot(sources, actor.id, firedAt + 60);
    expect(snapshot).not.toBeNull();

    const effects = snapshot?.eventEffects ?? [];
    expect(effects.map((e) => e.modifierId).sort()).toEqual([
      'festival_courier_backlog',
      'festival_night_opportunity',
    ]);
    for (const effect of effects) {
      expect(effect.sourceEventId).toBe('city_canal_festival');
      expect(effect).not.toHaveProperty('knowledgePrompt');
      expect(effect).not.toHaveProperty('personalTake');
      expect(effect).not.toHaveProperty('attitude');
    }
  });

  it('emits source-backed festival opportunities as intent candidates (no selection)', () => {
    const sim = new SimulationEngine();
    const [actor] = sim.social.getBuddies();
    if (!actor) throw new Error('Expected at least one Away character.');
    const firedAt = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', firedAt);

    const sources = createSimulationLifeSources(sim);
    const snapshot = buildLifeMatrixSnapshot(sources, actor.id, firedAt + 60);
    if (!snapshot) throw new Error('Expected a life snapshot.');

    const obligations = buildCharacterObligations(snapshot);
    const opportunity = obligations.find((o) => o.id === `world_event:${actor.id}:city_canal_festival`);
    expect(opportunity).toBeDefined();
    expect(opportunity).toMatchObject({
      actorId: actor.id,
      sourceKind: 'world_event',
      sourceId: 'city_canal_festival',
      flexibility: 'flexible',
      status: 'pending',
    });
    // No outcome/status/wage leakage into the candidate.
    expect(opportunity).not.toHaveProperty('wage');
    expect(opportunity).not.toHaveProperty('rsvp');
    // Time bounds derive from trigger fields only.
    expect(opportunity?.earliestAt).toBe(firedAt);
    expect(opportunity?.latestAt).toBe(firedAt + 2880);
    // Listing only: no selected intent anywhere on the snapshot.
    expect(snapshot).not.toHaveProperty('selectedIntent');
  });

  it('projection is read-only and leaves no persisted ledger', () => {
    const sim = new SimulationEngine();
    const [actor] = sim.social.getBuddies();
    if (!actor) throw new Error('Expected at least one Away character.');
    const firedAt = 4 * 1440;
    sim.world.triggerEventById('city_canal_festival', firedAt);

    const before = sim.exportSnapshot();
    const sources = createSimulationLifeSources(sim);
    const snapshot = buildLifeMatrixSnapshot(sources, actor.id, firedAt + 60);
    if (!snapshot) throw new Error('Expected a life snapshot.');
    buildCharacterObligations(snapshot);
    buildCharacterObligations(snapshot);
    expect(sim.exportSnapshot()).toEqual(before);

    const json = JSON.stringify(before);
    expect(json).not.toContain('"obligations"');
    expect(json).not.toContain('"eventEffects"');
  });

  it('inactive events project no effects and no opportunities', () => {
    const sim = new SimulationEngine();
    const [actor] = sim.social.getBuddies();
    if (!actor) throw new Error('Expected at least one Away character.');

    const sources = createSimulationLifeSources(sim);
    const snapshot = buildLifeMatrixSnapshot(sources, actor.id, 100);
    expect(snapshot?.eventEffects).toEqual([]);
    expect(buildCharacterObligations(snapshot!).some((o) => o.sourceKind === 'world_event')).toBe(false);
  });
});
