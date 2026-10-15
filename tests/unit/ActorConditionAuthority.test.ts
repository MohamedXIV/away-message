import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';

describe('#187 one Social actor lifecycle and contact authority', () => {
  it('persists condition independently of derived relationship stage and never stores a second status', () => {
    const game = new SimulationEngine();
    const social = game.social;
    const id = social.getBuddies()[0]!.id;
    const relationshipBefore = social.getRelationships(id);
    const stageBefore = social.getRelationshipStage(id);

    expect(social.getActorCondition(id)).toEqual({ lifecycle: 'active', contact: 'open' });
    social.setActorCondition(id, { lifecycle: 'active', contact: 'distant' });
    expect(social.getBuddy(id)?.status).toBe('distant');
    expect(social.getActorCondition(id)).toEqual({ lifecycle: 'active', contact: 'distant' });
    expect(social.getRelationshipStage(id)).toBe(stageBefore);
    expect(social.getRelationships(id)).toEqual(relationshipBefore);
    const saved = game.exportSnapshot();
    expect(saved.social.actorConditions?.[id]).toEqual({ lifecycle: 'active', contact: 'distant' });
    expect(saved.social.seedActorStatuses).toBeUndefined();
    expect(saved.social.buddies?.[id]).toBeUndefined();

    const reloaded = new SimulationEngine(saved);
    expect(reloaded.social.getActorCondition(id)).toEqual(social.getActorCondition(id));
    expect(reloaded.social.getRelationshipStage(id)).toBe(stageBefore);
    expect(reloaded.social.getBuddy(id)?.status).toBe('distant');

    social.setActorCondition(id, { lifecycle: 'active', contact: 'open' });
    expect(social.getActorCondition(id)?.contact).toBe('open');
    expect(social.getRelationshipStage(id)).toBe(stageBefore);
    // Old relationship-label setter can no longer create a parallel stage.
    social.setBuddyStatus(id, 'close');
    expect(social.getRelationshipStage(id)).toBe(stageBefore);
    expect(social.getActorCondition(id)).toEqual({ lifecycle: 'active', contact: 'open' });
    expect(social.getBuddy(id)?.status).toBe(stageBefore === 'strained' ? 'acquaintance' : stageBefore);
  });

  it('keeps departed versus blocked versus distant independent from friendship', () => {
    const social = new SocialEngine(new EventBus());
    const id = social.getBuddies()[0]!.id;
    const stage = social.getRelationshipStage(id);
    social.setActorCondition(id, { lifecycle: 'active', contact: 'blocked' });
    expect(social.getActorCondition(id)?.contact).toBe('blocked');
    expect(social.getBuddy(id)?.status).toBe('blocked');
    social.updatePresence(700);
    expect(social.getPresence(id)?.status).toBe('offline');
    social.setActorCondition(id, { lifecycle: 'departed', contact: 'open' });
    expect(social.getActorCondition(id)?.lifecycle).toBe('departed');
    expect(social.getBuddy(id)?.status).toBe('gone');
    expect(social.getRelationshipStage(id)).toBe(stage);
    social.setActorCondition(id, { lifecycle: 'active', contact: 'open' });
    expect(social.getActorCondition(id)?.lifecycle).toBe('active');
    expect(social.getRelationshipStage(id)).toBe(stage);
  });

  it('does not leak condition writes through legacy buddy projections or detached queries', () => {
    const social = new SocialEngine(new EventBus());
    const actor = social.getBuddies()[0]!;
    const id = actor.id;
    actor.status = 'gone'; // caller mutates a read projection, not the owner
    expect(social.getActorCondition(id)?.lifecycle).toBe('active');
    const detached = social.getActorCondition(id)!;
    detached.contact = 'blocked';
    expect(social.getActorCondition(id)?.contact).toBe('open');
    expect(social.getActorCondition('unknown_actor')).toBeUndefined();
    expect(() => social.setActorCondition(id, { lifecycle: 'unreal' as never, contact: 'open' }))
      .toThrow('Invalid actor condition');
  });

  it('replacing the current document cleans previous dynamic and seed divergence', () => {
    const social = new SocialEngine(new EventBus());
    const seed = social.getBuddies()[0]!;
    const canonical = social.getState();
    const removed = { ...canonical, removedSeedActorIds: [seed.id] };
    social.restoreState(removed);
    expect(social.getBuddy(seed.id)).toBeUndefined();
    expect(social.getActorCondition(seed.id)).toBeUndefined();
    social.restoreState(canonical);
    expect(social.getBuddy(seed.id)).toBeDefined();
    expect(social.getActorCondition(seed.id)).toEqual({ lifecycle: 'active', contact: 'open' });
  });
});