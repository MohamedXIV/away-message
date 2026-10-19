import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import {
  SocialEngine, normalizeBuddyId, normalizeRelationshipDims,
} from '../../src/engine/SocialEngine';
import { PlayerRelationships } from '../../src/engine/social/PlayerRelationships';
import { SocialPresence } from '../../src/engine/social/SocialPresence';
import { conditionFromLegacyStatus } from '../../src/engine/semantic/ActorCondition';

describe('#173 canonical PlayerRelationships + SocialPresence owners', () => {
  it('keeps friendship stage derived independently from lifecycle/contact and preserves action deltas', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const actor = social.getBuddies()[0]!;
    const before = social.getRelationships(actor.id)!;
    const emits = vi.spyOn(bus, 'emit');
    const next = social.applySocialAction(actor.id, 'empathy');
    expect(next.familiarity).toBe(Math.min(100, before.familiarity + 3));
    expect(next.trust).toBe(Math.min(100, before.trust + 4));
    expect(emits).toHaveBeenCalledWith('social:relationship_updated', expect.objectContaining({
      buddyId: actor.id, delta: expect.objectContaining({ trust: 4 }),
    }));
    const priorStage = social.getRelationshipStage(actor.id);
    expect(social.setActorCondition(actor.id, { lifecycle: 'active', contact: 'blocked' }))
      .toEqual({ lifecycle: 'active', contact: 'blocked' });
    expect(social.getActorCondition(actor.id)?.contact).toBe('blocked');
    expect(social.getBuddy(actor.id)?.status).toBe('blocked');
    expect(social.getRelationshipStage(actor.id)).toBe(priorStage);
    expect(social.getRelationships(actor.id)).toEqual(next);

    social.setActorCondition(actor.id, { lifecycle: 'active', contact: 'open' });
    social.adjustRelationship(actor.id, { familiarity: 100, trust: 100, annoyance: 0 });
    expect(social.getRelationshipStage(actor.id)).toBe('close');
    expect(social.getBuddy(actor.id)?.status).toBe('close');
    social.adjustRelationship(actor.id, { annoyance: 100 });
    expect(social.getRelationshipStage(actor.id)).toBe('strained');
    expect(social.getBuddy(actor.id)?.status).toBe('acquaintance');
    expect(social.getActorCondition(actor.id)?.contact).toBe('open');
  });

  it('restores canonical contact and relationship state without storing derived stages', () => {
    const social = new SocialEngine(new EventBus());
    const [a, b] = social.getBuddies();
    social.adjustRelationship(a!.id, { trust: 91, familiarity: 80, annoyance: 0 });
    social.setActorCondition(a!.id, { lifecycle: 'active', contact: 'distant' });
    social.setActorCondition(b!.id, { lifecycle: 'departed', contact: 'open' });
    const state = social.getState();
    expect(state.relationships[a!.id]?.trust).toBe(91);
    expect(state.actorConditions?.[a!.id]?.contact).toBe('distant');
    expect('stage' in (state.relationships[a!.id] ?? {})).toBe(false);
    const restored = new SocialEngine(new EventBus(), state);
    expect(restored.getState()).toEqual(state);
    expect(restored.getBuddy(a!.id)?.status).toBe('distant');
    expect(restored.getBuddy(b!.id)?.status).toBe('gone');
    const read = restored.getActorCondition(a!.id)!;
    read.contact = 'blocked';
    const rel = restored.getRelationships(a!.id)!;
    rel.trust = 0;
    expect(restored.getActorCondition(a!.id)?.contact).toBe('distant');
    expect(restored.getRelationships(a!.id)?.trust).toBe(91);
    expect(restored.removeBuddy(a!.id)).toBe(true);
    expect(restored.getState().relationships[a!.id]).toBeUndefined();
    expect(restored.getState().actorConditions?.[a!.id]).toBeUndefined();
  });

  it('uses world-minute schedules, actor contact law, and preserves player authored status', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const [a, b] = social.getBuddies();
    const emitted = vi.spyOn(bus, 'emit');
    social.updatePresence(480);
    const morning = social.getPresence(a!.id);
    expect(morning).toBeDefined();
    social.setActorCondition(a!.id, { lifecycle: 'active', contact: 'blocked' });
    social.setActorCondition(b!.id, { lifecycle: 'departed', contact: 'open' });
    social.updatePresence(1380);
    expect(social.getPresence(a!.id)?.status).toBe('offline');
    expect(social.getPresence(b!.id)?.status).toBe('offline');
    social.setPlayerPresence({ status: 'away', awayMessage: 'Deep work',
      customAwayMessage: 'Deep work' });
    expect(social.getPresence('player')).toEqual({ status: 'away',
      awayMessage: 'Deep work', customAwayMessage: 'Deep work' });
    expect(emitted).toHaveBeenCalledWith('social:status_changed',
      { buddyId: 'player', presence: expect.objectContaining({ awayMessage: 'Deep work' }) });
    const detached = social.getPresence('player')!;
    detached.awayMessage = 'forged';
    expect(social.getPresence('player')?.awayMessage).toBe('Deep work');
    const saved = social.getState();
    const restored = new SocialEngine(new EventBus(), saved);
    expect(restored.getState()).toEqual(saved);
    expect(restored.getPresence('player')).toEqual(saved.presence.player);
    expect(morning?.status).toBeDefined();
  });

  it('filters unknown actor presence without a parallel contact index', () => {
    const social = new SocialEngine(new EventBus());
    const [a, b] = social.getBuddies();
    social.updatePresence(480);
    const before = social.getPresenceSummary(true);
    expect(before[a!.id]).toBeUndefined();
    expect(before[b!.id]).toBeUndefined();
    expect(social.learnHandle(a!.id, a!.handle)).toBe(true);
    const known = social.getPresenceSummary(true);
    expect(known[a!.id]).toEqual(social.getPresence(a!.id));
    expect(known[b!.id]).toBeUndefined();
    social.setPlayerPresence({ status: 'online', awayMessage: '' });
    expect(social.getPresenceSummary(true).player).toEqual(social.getPresence('player'));
  });

  it('preserves bounded deterministic relationship changes and independent presence copies', () => {
    const a = 'renamed_actor', b = 'another_actor';
    const owner = new PlayerRelationships({
      normalize: normalizeBuddyId,
      normalizeDims: normalizeRelationshipDims,
      actorExists: id => id === a || id === b,
    });
    owner.put(a, normalizeRelationshipDims({ trust: 50, familiarity: 20 }));
    owner.putCondition(a, conditionFromLegacyStatus('distant'));
    expect(owner.stage(a)).toBe('acquaintance');
    const first = owner.applyAction(a, 'unknown_action');
    expect(first.delta).toEqual({ familiarity: 1 });
    expect(first.dimensions.familiarity).toBe(21);
    expect(owner.adjust(a, { trust: 450, annoyance: -50 }).trust).toBe(100);
    expect(owner.get(a)?.annoyance).toBe(0);
    expect(owner.exportState().actorConditions?.[a]?.contact).toBe('distant');
    expect(owner.getCondition(a)?.contact).toBe('distant');
    const emit = vi.fn();
    const p = new SocialPresence({
      normalize: normalizeBuddyId,
      actors: () => [],
      condition: id => owner.getCondition(id),
      isKnown: id => id === a,
      emit,
    });
    p.put(a, { status: 'offline', awayMessage: '' });
    p.put(b, { status: 'away', awayMessage: 'unknown' });
    expect(p.summary(true)).toEqual({ [a]: { status: 'offline', awayMessage: '' } });
    expect(p.summary(false)[b]?.awayMessage).toBe('unknown');
    p.setPlayer({ status: 'online', awayMessage: '' });
    expect(emit).toHaveBeenCalledTimes(1);
    expect(p.summary(true).player?.status).toBe('online');
  });
});
