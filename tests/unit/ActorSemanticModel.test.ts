import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { deriveActorSemantics } from '../../src/engine/semantic/ActorSemantics';

describe('#187 pure actor semantics and single-authority source binding', () => {
  it('derives lifecycle and relationship independently of legacy friendship labels', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies()[0]!;
    const before = game.exportSnapshot();

    const view = game.getActorSemanticView(actor.id, true)!;
    expect(view.actorId).toBe(actor.id);
    expect(view.relationship.stage).toBe(game.social.getRelationshipStage(actor.id));
    expect(view.fidelity).toBe('focused');
    expect(view.reach).toBe(actor.reach === 'remote' ? 'remote' : 'local');

    game.social.setBuddyStatus(actor.id, 'blocked');
    const blocked = game.getActorSemanticView(actor.id)!;
    expect(blocked.connection).toBe('blocked');
    expect(blocked.canChatNow).toEqual({
      allowed: false, reasons: expect.arrayContaining(['blocked_contact']),
    });
    expect(blocked.relationship.stage).toBe(game.social.getRelationshipStage(actor.id));
    game.social.setBuddyStatus(actor.id, actor.status ?? 'acquaintance');
    expect(game.getActorSemanticView(actor.id)!.lifecycle).toBe('active');
    expect(before.social.relationships[actor.id]).toEqual(game.exportSnapshot().social.relationships[actor.id]);
  });

  it('never treats a remote canonical social actor as available for town meetups', () => {
    const game = new SimulationEngine();
    const template = game.social.getBuddies()[0]!;
    game.social.registerBuddy({
      ...template, id: 'remote_semantic_fixture', handle: 'remote_semantic_fixture',
      reach: 'remote', status: 'friend',
    });
    const view = game.getActorSemanticView('remote_semantic_fixture', true)!;
    expect(view.fidelity).toBe('remote_known');
    expect(view.reach).toBe('remote');
    expect(view.canMeetInPerson).toEqual({ allowed: false, reasons: ['remote_reach'] });
    expect(view.relationship.stage).toBe(game.social.getRelationshipStage('remote_semantic_fixture'));
    expect(game.getActorSemanticView('unknown_user')).toBeNull();
    // Querying a remote actor must not instantiate a trip or a second spatial authority.
    expect(game.getNpcTrip('remote_semantic_fixture')).toBeNull();
  });

  it('offers explainable busy/chat blockers from canonical read inputs without writing them', () => {
    const actor = { id: 'actor:student', status: 'friend' as const, reach: 'local' as const };
    const derived = deriveActorSemantics({
      actor,
      relationshipStage: 'friend',
      knownToPlayer: true,
      presence: { status: 'busy' },
      pressure: { interruptionTolerance: 'do_not_disturb' },
      lifeFidelity: 'local_offscreen',
    });
    expect(derived.fidelity).toBe('background_local');
    expect(derived.canChatNow).toEqual({ allowed: false, reasons: ['busy'] });
    expect(derived.canMeetInPerson.allowed).toBe(true);
    expect(actor).toEqual({ id: 'actor:student', status: 'friend', reach: 'local' });
  });

  it('exposes active life influences with source event and duration provenance only', () => {
    const game = new SimulationEngine();
    const actor = game.social.getBuddies().find(b => b.reach !== 'remote')!;
    const minute = game.clock.getTotalMinutes();
    expect(game.world.triggerEventById('city_canal_festival', minute)).not.toBeNull();
    const before = game.exportSnapshot();
    const effects = game.getActorLifeInfluences(actor.id);
    expect(effects.length).toBeGreaterThan(0);
    expect(effects.every(e => e.sourceEventId === 'city_canal_festival')).toBe(true);
    expect(effects.every(e => e.validFromMinute === minute)).toBe(true);
    expect(game.getActorLifeInfluences('nonexistent')).toEqual([]);
    expect(game.exportSnapshot()).toEqual(before);
  });
});

describe('#187 structured social memory provenance', () => {
  it('records a resolved commitment as a deterministic semantic memory and round-trips it', () => {
    const first = new SimulationEngine();
    const second = new SimulationEngine();
    const actorId = first.social.getBuddies()[0]!.id;
    const promises = [first, second].map(game => {
      const record = game.social.addPromise(actorId, 'Promise to show up for revision', 1, 4);
      expect(record).not.toBeNull();
      game.social.resolvePromise(actorId, record!.id, true, 3);
      return record!;
    });
    expect(promises[0]!.id).toBe(promises[1]!.id);

    const memories = first.social.getCoreMemories(actorId);
    const promiseMemory = memories.find(m => m.kind === 'promise_kept')!;
    expect(promiseMemory.meaning).toEqual({
      participants: ['player', actorId],
      subject: { kind: 'promise', id: promises[0]!.id },
      source: { kind: 'domain_event', refId: promises[0]!.id },
      salience: 'high', valence: 'positive',
    });
    expect(second.social.getCoreMemories(actorId).find(m => m.kind === 'promise_kept')?.id).toBe(promiseMemory.id);
    const saved = first.exportSnapshot();
    const loaded = new SimulationEngine(saved);
    expect(loaded.social.getCoreMemories(actorId)).toEqual(memories);

    const detached = loaded.social.getCoreMemories(actorId);
    detached.find(m => m.id === promiseMemory.id)!.meaning!.participants[0] = 'forged';
    expect(loaded.social.getCoreMemories(actorId)).toEqual(memories);
    const corrupted = { ...saved.social, coreMemories: {
      ...saved.social.coreMemories,
      [actorId]: memories.map(m => m.id === promiseMemory.id
        ? { ...m, meaning: { ...m.meaning!, participants: ['bad id with spaces'] } }
        : m),
    } };
    loaded.social.restoreState(corrupted);
    expect(loaded.social.getCoreMemories(actorId).find(m => m.id === promiseMemory.id)?.meaning).toBeUndefined();
  });
});
