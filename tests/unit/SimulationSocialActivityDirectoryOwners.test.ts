import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import {
  SocialEngine, MAX_AGENDA_PER_BUDDY_DAY, MAX_NPC_SOCIAL_LOG,
  MAX_EPITAPHS, MAX_KNOWN_HANDLES, normalizeBuddyId,
} from '../../src/engine/SocialEngine';
import { SocialActivityLedger } from '../../src/engine/social/SocialActivityLedger';
import { SocialContactDirectory } from '../../src/engine/social/SocialContactDirectory';

const agendaItem = (day: number, index: number) => ({
  id: `agenda_${day}_${index}`, kind: 'work' as const, label: `shift ${index}`,
  day, startMinute: index * 50, endMinute: index * 50 + 35,
});

describe('#173 activity + earned-contact canonical owners', () => {
  it('caps agendas per day, sorts detached views and emits through Social once', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const id = social.getBuddies()[0]!.id;
    const emit = vi.spyOn(bus, 'emit');
    const items = [agendaItem(3, 3), agendaItem(3, 1), agendaItem(3, 0),
      agendaItem(3, 2), agendaItem(3, 4), agendaItem(4, 0)];
    const result = social.setAgenda(id, items);
    expect(result).toHaveLength(MAX_AGENDA_PER_BUDDY_DAY + 1);
    expect(result.filter(item => item.day === 3)).toHaveLength(MAX_AGENDA_PER_BUDDY_DAY);
    expect(emit).toHaveBeenCalledWith('social:agenda_updated',
      { buddyId: id, count: MAX_AGENDA_PER_BUDDY_DAY + 1 });
    expect(social.getAgenda(id, 3).map(item => item.startMinute))
      .toEqual([...social.getAgenda(id, 3).map(item => item.startMinute)].sort((a, b) => a - b));
    result[0]!.label = 'forged';
    expect(social.getAgenda(id)[0]?.label).not.toBe('forged');
    expect(social.getState().agenda?.[id]).toHaveLength(MAX_AGENDA_PER_BUDDY_DAY + 1);
    expect(new SocialEngine(new EventBus(), social.getState()).getState()).toEqual(social.getState());
  });

  it('deduplicates bounded witness events, validates restores, prunes actor removal', () => {
    const owner = new SocialActivityLedger(normalizeBuddyId, id => ['a', 'b'].includes(id), 2, 3);
    const hit = owner.logNpcInteraction({ day: 1, firstId: 'a', secondId: 'b',
      line: 'Saw them talking', location: 'diner' });
    hit.line = 'forged';
    owner.logNpcInteraction({ day: 1, firstId: 'a', secondId: 'b', line: 'updated', location: 'park' });
    expect(owner.getNpcSocialLog()).toHaveLength(1);
    expect(owner.getNpcSocialLog()[0]?.line).toBe('updated');
    for (const day of [2, 3, 4]) owner.logNpcInteraction({
      day, firstId: 'a', secondId: 'b', line: 'hello', location: 'town',
    });
    expect(owner.getNpcSocialLog()).toHaveLength(3);
    owner.restore({ agenda: { a: [agendaItem(5, 0), { ...agendaItem(5, 1), kind: 'invalid' as any }] },
      npcSocialLog: [{ id: 'bad', day: 5, firstId: 'a', secondId: 'a', location: '', line: '' },
        { id: 'good', day: 5, firstId: 'a', secondId: 'b', location: 'town', line: 'seen' }] });
    expect(owner.getAgenda('a')).toHaveLength(1);
    expect(owner.getNpcSocialLog()).toHaveLength(1);
    owner.forget('a');
    expect(owner.getAgenda('a')).toEqual([]);
    expect(owner.getNpcSocialLog()).toEqual([]);
  });

  it('keeps contact discovery independent of relations and actor presence, duplicate learn event-free', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const actor = social.getBuddies()[0]!;
    const emit = vi.spyOn(bus, 'emit');
    expect(social.isKnown(actor.id)).toBe(false);
    social.adjustRelationship(actor.id, { familiarity: 100, trust: 100 });
    expect(social.isKnown(actor.id)).toBe(false);
    expect(social.learnHandle(actor.id, '  alias  ')).toBe(true);
    expect(social.learnHandle(actor.id, 'alias')).toBe(true);
    expect(emit.mock.calls.filter(([kind]) => kind === 'social:handle_learned')).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith('social:handle_learned', { buddyId: actor.id, handle: 'alias' });
    for (let i = 0; i < MAX_KNOWN_HANDLES - 1; i++) {
      expect(social.learnHandle(actor.id, `alias_${i}`)).toBe(true);
    }
    expect(social.learnHandle(actor.id, 'extra')).toBe(false);
    const exported = social.getKnownHandles(actor.id);
    exported.length = 0;
    expect(social.getKnownHandles(actor.id)).toHaveLength(MAX_KNOWN_HANDLES);
    expect(social.learnHandle('nonexistent-actor', 'fake')).toBe(false);
    social.updatePresence(500);
    expect(social.isKnown(actor.id)).toBe(true);
    const snapshot = social.getState();
    expect(new SocialEngine(new EventBus(), snapshot).getState()).toEqual(snapshot);
    social.removeBuddy(actor.id);
    expect(social.isKnown(actor.id)).toBe(false);
    expect(social.getState().knownHandles?.[actor.id]).toBeUndefined();
  });

  it('enforces bounded epitaphs and defensive copies; restores validated directory fields', () => {
    const owner = new SocialContactDirectory(normalizeBuddyId, id => id === 'a', 2, 3);
    expect(owner.learn('unknown', 'secret').accepted).toBe(false);
    expect(owner.learn('a', 'first').newlyLearned).toBe(true);
    expect(owner.learn('a', 'first').newlyLearned).toBe(false);
    owner.restore({ knownHandles: { a: ['  same  ', 'same', '', 'second', 'third'] },
      epitaphs: ['  one  ', 'two', 'three', 'four'] });
    expect(owner.getKnownHandles('a')).toEqual(['same', 'second']);
    expect(owner.getEpitaphs()).toEqual(['two', 'three', 'four']);
    owner.addEpitaph(' five  words ');
    expect(owner.getEpitaphs()).toEqual(['three', 'four', 'five words']);
    const detached = owner.exportState();
    detached.knownHandles!.a!.push('tampered');
    detached.epitaphs!.pop();
    expect(owner.getKnownHandles('a')).toHaveLength(2);
    expect(owner.getEpitaphs()).toHaveLength(3);
    expect(MAX_EPITAPHS).toBeGreaterThan(3);
  });

  it('round-trips dynamic actor agenda, witness and learned handle without copying conversation bodies', () => {
    const social = new SocialEngine(new EventBus());
    const template = social.getBuddies()[0]!;
    const dynamic = social.registerBuddy({
      ...template, id: 'dynamic_activity_actor', displayName: 'Dynamic Activity',
      handle: 'dynamic_activity', status: 'stranger', isProcedural: true, createdDay: 4,
    });
    social.setAgenda(dynamic.id, [agendaItem(5, 0)]);
    social.logNpcInteraction({ day: 5, firstId: template.id, secondId: dynamic.id,
      location: 'cafe', line: 'Saw them' });
    expect(social.learnHandle(dynamic.id, dynamic.handle)).toBe(true);
    const saved = social.getState();
    const loaded = new SocialEngine(new EventBus(), saved);
    expect(loaded.getState()).toEqual(saved);
    expect(loaded.getKnownHandles(dynamic.id)).toEqual([dynamic.handle]);
    expect(loaded.getAgenda(dynamic.id)).toHaveLength(1);
    expect(loaded.getNpcSocialLog()).toHaveLength(1);
    loaded.removeBuddy(dynamic.id);
    expect(loaded.getAgenda(dynamic.id)).toEqual([]);
    expect(loaded.getNpcSocialLog()).toEqual([]);
    expect(loaded.isKnown(dynamic.id)).toBe(false);
    expect(social.getState()).toEqual(saved);
    expect(MAX_NPC_SOCIAL_LOG).toBeGreaterThan(1);
  });
});
