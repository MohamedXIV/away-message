import { describe, expect, it } from 'vitest';
import { SocialEngine, MAX_CORE_MEMORIES, MAX_OPEN_PROMISES, MAX_PHOTO_MEMORIES } from '../../src/engine/SocialEngine';
import { EventBus } from '../../src/engine/EventBus';
import { SocialMemoryLedger } from '../../src/engine/social/SocialMemoryLedger';

describe('#173 canonical Social memory / commitment owner', () => {
  it('retains memory eviction, semantic provenance and detached export/read boundaries', () => {
    const social = new SocialEngine(new EventBus());
    const actorId = social.getBuddies()[0]!.id;
    const initial = social.addCoreMemory(actorId, {
      text: 'First shared trip to the riverside', kind: 'first_meeting', day: 1,
      meaning: {
        participants: ['player', actorId],
        subject: { kind: 'actor', id: actorId },
        source: { kind: 'direct_experience', refId: 'test:first_trip' },
        salience: 'high', valence: 'positive',
      },
    });
    expect(initial).toBeDefined();
    expect(initial?.meaning?.subject.id).toBe(actorId);
    expect(social.addCoreMemory(actorId, {
      text: 'First shared trip to the riverside', kind: 'first_meeting', day: 1,
    })).toBeNull();
    for (let i = 0; i < MAX_CORE_MEMORIES + 5; i++) {
      social.addCoreMemory(actorId, { text: `Saw event number ${i} at work`, kind: 'fact', day: i + 2 });
    }
    const memories = social.getCoreMemories(actorId);
    expect(memories).toHaveLength(MAX_CORE_MEMORIES);
    expect(memories.some(m => m.id === initial?.id)).toBe(true);
    expect(memories.at(-1)?.text).toBe(`Saw event number ${MAX_CORE_MEMORIES + 4} at work`);
    const altered = social.getCoreMemories(actorId);
    altered[0]!.text = 'forged';
    altered[0]!.meaning?.participants.push('forged');
    expect(social.getCoreMemories(actorId)[0]!.text).not.toBe('forged');
    expect(social.getCoreMemories(actorId)[0]!.meaning?.participants).not.toContain('forged');

    const state = social.getState();
    const restored = new SocialEngine(new EventBus(), state);
    expect(restored.getState()).toEqual(state);
    expect(restored.buildLongTermContext(actorId)).toBe(social.buildLongTermContext(actorId));
    state.coreMemories![actorId]![0]!.text = 'changed after export';
    expect(social.getCoreMemories(actorId)[0]!.text).not.toBe('changed after export');
    expect(restored.getCoreMemories(actorId)[0]!.text).not.toBe('changed after export');
  });

  it('keeps the single ledger responsible for open-promise caps, closure and due detection', () => {
    const actorId = 'ledger_actor';
    const ledger = new SocialMemoryLedger(id => id, id => id === actorId);
    expect(ledger.addPromise('unknown', 'Promise to meet Friday', 1, 2)).toBeNull();
    expect(ledger.addPromise(actorId, ' too short ', 1)).toBeNull();
    for (let i = 0; i < MAX_OPEN_PROMISES + 2; i++) {
      ledger.addPromise(actorId, `Come back with groceries ${i}`, 2, i + 3);
    }
    expect(ledger.getOpenPromises(actorId)).toHaveLength(MAX_OPEN_PROMISES);
    expect(ledger.getPromises(actorId)[0]!.text).toBe('Come back with groceries 2');
    const promise = ledger.getOpenPromises(actorId)[0]!;
    expect(ledger.closePromise(actorId, promise.id, true)?.status).toBe('kept');
    expect(ledger.closePromise(actorId, promise.id, false)).toBeNull();
    const due = ledger.overdue(100);
    expect(due).toHaveLength(MAX_OPEN_PROMISES - 1);
    expect(ledger.exportState().promises?.[actorId]?.[0]?.status).toBe('kept');
    const restored = new SocialMemoryLedger(id => id, id => id === actorId);
    restored.restoreState(ledger.exportState());
    expect(restored.getPromises(actorId)).toEqual(ledger.getPromises(actorId));
    restored.forget(actorId);
    expect(restored.getPromises(actorId)).toEqual([]);
  });

  it('keeps governed promise effects, provenance and photo-memory cap on SocialEngine', () => {
    const bus = new EventBus();
    const social = new SocialEngine(bus);
    const actorId = social.getBuddies()[0]!.id;
    const events: Array<{ buddyId: string; promiseId: string; kept: boolean }> = [];
    const off = bus.on('social:promise_resolved', event => events.push(event));
    const relBefore = social.getRelationships(actorId)!;
    const kept = social.addPromise(actorId, 'Help repair the old computer', 1, 3)!;
    expect(social.addPromise(actorId, kept.text.toUpperCase(), 1, 3)).toBeNull();
    const result = social.resolvePromise(actorId, kept.id, true, 2);
    expect(result?.promise.status).toBe('kept');
    expect(result?.relationships).not.toEqual(relBefore);
    expect(social.resolvePromise(actorId, kept.id, false, 3)).toBeNull();
    const remembered = social.getCoreMemories(actorId).find(m => m.kind === 'promise_kept');
    expect(remembered?.meaning?.subject).toEqual({ kind: 'promise', id: kept.id });
    expect(remembered?.meaning?.source.refId).toBe(kept.id);

    const overdue = social.addPromise(actorId, 'Meet at the cafe after work', 1, 2)!;
    expect(social.checkPromiseDues(2)).toEqual([]);
    expect(social.checkPromiseDues(3).map(x => x.promise.id)).toEqual([overdue.id]);
    expect(social.checkPromiseDues(4)).toEqual([]);
    expect(events).toEqual([
      { buddyId: actorId, promiseId: kept.id, kept: true },
      { buddyId: actorId, promiseId: overdue.id, kept: false },
    ]);
    const photoMessages = MAX_PHOTO_MEMORIES + 2;
    for (let i = 0; i < photoMessages; i++) {
      social.sendMessage(actorId, actorId, 'player', 'photo', 2100 + i,
        false, undefined, `https://example.test/photo-${i}.png`, `Portrait ${i}`);
    }
    expect(social.getCoreMemories(actorId).filter(m => m.kind === 'shared_photo').length)
      .toBeLessThanOrEqual(MAX_PHOTO_MEMORIES);
    expect(social.getState().coreMemories?.[actorId]?.every(m => m.meaning === undefined
      || Array.isArray(m.meaning.participants))).toBe(true);
    const snapshot = social.getState();
    const restored = new SocialEngine(new EventBus(), snapshot);
    expect(restored.getState()).toEqual(snapshot);
    expect(restored.getOpenPromises(actorId)).toEqual([]);
    off();
  });

  it('rejects invalid memory meaning on restore without leaking noncanonical claims', () => {
    const ledger = new SocialMemoryLedger(id => id, () => true);
    ledger.restoreState({
      coreMemories: {
        actor: [
          { id: 'valid', text: 'Known from player encounter', kind: 'fact', day: 2,
            meaning: {
              participants: ['player'], subject: { kind: 'fact', id: 'encounter_fact' },
              source: { kind: 'direct_experience', refId: 'visit' }, salience: 'high', valence: 'neutral',
            } },
          { id: 'duplicate', text: 'KNOWN FROM PLAYER ENCOUNTER', kind: 'fact', day: 2 },
          { id: 'bad', text: 'Cannot assert this rumour as a fact', kind: 'fact', day: 4,
            meaning: { participants: [], subject: { kind: 'fact', id: 'secret' },
              source: { kind: 'message', refId: 'unknown' }, salience: 'high', valence: 'neutral' } },
        ],
      },
      promises: { actor: [{ id: 'p', text: 'Help deliver the package', status: 'open', createdDay: 1, dueDay: 3 }] },
    });
    expect(ledger.getMemories('actor')).toHaveLength(2);
    expect(ledger.getMemories('actor')[0]!.meaning?.subject.id).toBe('encounter_fact');
    expect(ledger.getMemories('actor')[1]!.meaning).toBeUndefined();
    const original = ledger.exportState();
    const read = ledger.getMemories('actor');
    read[0]!.meaning!.participants.push('untrusted');
    expect(ledger.exportState()).toEqual(original);
  });
});
