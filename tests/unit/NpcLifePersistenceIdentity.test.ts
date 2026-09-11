import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('NPC life persistence identity integrity (#43)', () => {
  it('rejects cross-actor child identity inside an actor-owned npcLives row', () => {
    const first = new SimulationEngine();
    const actor = first.social.getBuddies()[0]?.id;
    if (!actor) throw new Error('Expected at least one Away character.');

    const snapshot = JSON.parse(JSON.stringify(first.exportSnapshot())) as {
      npcLives: Record<string, {
        goals: Array<{ actorId: string }>;
        pressure: { actorId: string };
      }>;
    };
    const entry = snapshot.npcLives[actor];
    if (!entry) throw new Error('Expected canonical NPC life entry.');

    for (const goal of entry.goals) goal.actorId = '__foreign_actor__';
    entry.pressure.actorId = '__foreign_actor__';

    const loaded = new SimulationEngine(snapshot as never);
    const hydrated = loaded.exportSnapshot().npcLives?.[actor];
    expect(hydrated).toBeDefined();
    expect(hydrated?.goals.every((goal) => goal.actorId === actor)).toBe(true);
    expect(hydrated?.pressure.actorId).toBe(actor);
  });
});
