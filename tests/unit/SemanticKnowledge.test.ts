import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { WorldEventsEngine } from '../../src/engine/WorldEventsEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import type { ClaimRecord, WorldFactRecord, KnowledgeReceipt } from '../../src/engine/semantic/KnowledgeLedger';

const fact: WorldFactRecord = {
  id: 'fact:exam:friday', subjectId: 'exam:english', predicate: 'is_cancelled',
  value: false, established: { kind: 'school_notice', sourceId: 'notice:exam', atMinute: 100 },
};
const rumor: ClaimRecord = {
  id: 'claim:exam:cancelled', factId: fact.id, assertedValue: true,
  published: { kind: 'nightboard_post', sourceId: 'post:728', atMinute: 110 },
};
const receipt = (kind: 'fact' | 'claim', refId: string, atMinute: number): KnowledgeReceipt => ({
  kind, refId,
  learned: { kind: kind === 'fact' ? 'teacher' : 'nightboard_post',
    sourceId: kind === 'fact' ? 'teacher:1' : 'post:728', atMinute },
});

describe('#187 World-owned semantic truth, claim and actor-specific knowledge', () => {
  it('allows a false rumor to circulate without changing the true world fact or leaking it', () => {
    const world = new WorldEventsEngine(new EventBus());
    expect(world.establishSemanticFact(fact)).toBe(true);
    expect(world.publishSemanticClaim(rumor)).toBe(true);
    expect(world.learnSemanticReference('student:a', receipt('claim', rumor.id, 120))).toBe(true);

    const student = world.getActorSemanticKnowledge('student:a');
    expect(student.facts).toEqual([]);
    expect(student.claims).toEqual([rumor]);
    expect(world.actorHeardSemanticClaim('student:a', rumor.id)).toBe(true);
    expect(world.actorKnowsSemanticFact('student:a', fact.id)).toBe(false);
    // Pulse's existing getKnowledgeContextForBuddy consumer sees claims, not
    // hidden canonical fact values, even when a false rumor points to that fact.
    expect(world.getKnowledgeContextForBuddy('student:a', 1)).toContain('Unverified rumor');
    expect(world.getKnowledgeContextForBuddy('student:a', 1)).toContain('asserted true');
    expect(world.getKnowledgeContextForBuddy('student:a', 1)).not.toContain('= false');
    expect(world.getKnowledgeContextForBuddy('student:b', 1)).not.toContain('Unverified rumor');
    expect(world.getActorSemanticKnowledge('student:b')).toEqual({
      actorId: 'student:b', facts: [], claims: [],
    });
    expect(world.getActorSemanticKnowledge('player').facts).toEqual([]);
    expect(world.getState().semanticKnowledge?.facts[fact.id]?.value).toBe(false);
  });

  it('promotes knowledge only through explicit provenance; duplicates and unknown facts do not create history', () => {
    const world = new WorldEventsEngine(new EventBus());
    expect(world.learnSemanticReference('student:a', receipt('fact', fact.id, 90))).toBe(false);
    expect(world.establishSemanticFact(fact)).toBe(true);
    expect(world.establishSemanticFact({ ...fact, value: true })).toBe(false);
    expect(world.learnSemanticReference('student:a', receipt('fact', fact.id, 120))).toBe(true);
    expect(world.learnSemanticReference('student:a', receipt('fact', fact.id, 130))).toBe(false);
    expect(world.actorKnowsSemanticFact('student:a', fact.id)).toBe(true);
    expect(world.actorKnowsSemanticFact('player', fact.id)).toBe(false);
    expect(world.publishSemanticClaim(rumor)).toBe(true);
    expect(world.actorHeardSemanticClaim('student:a', rumor.id)).toBe(false);
  });

  it('serializes only irreducible records, hydrates them deterministically, and drops corrupt receipts', () => {
    const engine = new SimulationEngine();
    engine.world.establishSemanticFact(fact);
    engine.world.publishSemanticClaim(rumor);
    engine.world.learnSemanticReference('player', receipt('fact', fact.id, 130));
    engine.world.learnSemanticReference('student:a', receipt('claim', rumor.id, 140));
    const saved = engine.exportSnapshot();
    const restored = new SimulationEngine(saved);
    expect(restored.world.getState().semanticKnowledge).toEqual(saved.world.semanticKnowledge);
    expect(restored.world.getActorSemanticKnowledge('player').facts).toEqual([fact]);
    expect(restored.world.getActorSemanticKnowledge('player').claims).toEqual([]);
    expect(restored.world.getActorSemanticKnowledge('student:a').claims).toEqual([rumor]);
    const before = restored.exportSnapshot();
    const detached = restored.world.getActorSemanticKnowledge('player');
    detached.facts[0]!.established.sourceId = 'tampered';
    expect(restored.exportSnapshot()).toEqual(before);

    const damaged = { ...saved.world.semanticKnowledge!, learned: {
      'student:a': [{ kind: 'fact' as const, refId: 'missing', learned: fact.established },
        { kind: 'claim' as const, refId: rumor.id, learned: rumor.published }],
    } };
    restored.world.loadState({ ...saved.world, semanticKnowledge: damaged });
    expect(restored.world.actorKnowsSemanticFact('student:a', 'missing')).toBe(false);
    expect(restored.world.actorHeardSemanticClaim('student:a', rumor.id)).toBe(true);
  });

  it('does not grant all actors omniscient event awareness when a public event happens', () => {
    const world = new WorldEventsEngine(new EventBus());
    const actors = Array.from({ length: 24 }, (_, i) => `actor:${i}`);
    world.setBuddyProvider(() => actors.map(id => ({ id, archetype: 'regular' })));
    const event = world.triggerEventById('city_canal_festival', 3 * 1440);
    expect(event).not.toBeNull();
    const known = actors.filter(actorId => world.isEventKnownToBuddy(actorId, 'city_canal_festival'));
    expect(known.length).toBeGreaterThan(0);
    expect(known.length).toBeLessThan(actors.length);
    const missing = actors.find(id => !known.includes(id))!;
    const before = world.getTriggeredEvents();
    expect(world.getKnowledgeContextForBuddy(missing, 5)).not.toContain(event!.title);
    expect(world.learnEventForBuddy(missing, event!.id, {
      kind: 'friend', sourceId: 'actor:0', atMinute: 3 * 1440 + 10,
    })).toBe(true);
    expect(world.isEventKnownToBuddy(missing, event!.id)).toBe(true);
    expect(world.getKnowledgeContextForBuddy(missing, 5)).toContain(event!.title);
    expect(world.getTriggeredEvents()).toEqual(before);
    const saved = world.getState();
    const restored = new WorldEventsEngine(new EventBus(), saved);
    restored.setBuddyProvider(() => actors.map(id => ({ id, archetype: 'regular' })));
    expect(restored.getBuddyKnowledgeMap()).toEqual(world.getBuddyKnowledgeMap());
    expect(restored.learnEventForBuddy(missing, event!.id, {
      kind: 'friend', sourceId: 'actor:0', atMinute: 3 * 1440 + 20,
    })).toBe(false);
  });

  it('keeps source catalog and actor-scoped queries unchanged by read-only calls', () => {
    const world = new WorldEventsEngine(new EventBus());
    world.establishSemanticFact(fact);
    world.publishSemanticClaim(rumor);
    const first = world.getState();
    for (let i = 0; i < 3; i++) {
      expect(world.getActorSemanticKnowledge('player')).toEqual({ actorId: 'player', facts: [], claims: [] });
      expect(world.actorKnowsSemanticFact('player', fact.id)).toBe(false);
      expect(world.actorHeardSemanticClaim('player', rumor.id)).toBe(false);
    }
    expect(world.getState()).toEqual(first);
  });
});
