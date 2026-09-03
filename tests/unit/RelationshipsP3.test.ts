import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  buildScheduleForArchetype,
  shouldInitiateContact,
  pickInitiativeText,
  pickConfrontLine,
} from '../../src/engine/characterTemplates';
import {
  extractPromisesFromPlayerMessage,
  looksLikeCompletion,
} from '../../src/apps/pulse/utils/conversationMemory';
import type { BuddyCharacter } from '../../src/engine/types';

function makeSocial(): SocialEngine {
  return new SocialEngine(new EventBus());
}

function makeProceduralDef(): BuddyCharacter {
  return {
    id: 'test_pal',
    displayName: 'Test Pal',
    handle: 'test_pal',
    schedule: buildScheduleForArchetype('regular'),
    initialRelationships: { familiarity: 20, trust: 30, comfort: 30, respect: 30, annoyance: 0 },
    typingSpeedWpm: 70,
    archetype: 'regular',
    metVia: 'work',
    isProcedural: true,
    createdDay: 1,
  };
}

describe('P3 promise extraction (rules only)', () => {
  it('extracts explicit commitments with due-date offsets', () => {
    const res = extractPromisesFromPlayerMessage("i promise i'll call you tomorrow");
    expect(res.length).toBe(1);
    expect(res[0]!.dueDayOffset).toBe(1);
    expect(res[0]!.text.length).toBeGreaterThan(8);
  });

  it('ignores casual chat without commitment phrasing', () => {
    expect(extractPromisesFromPlayerMessage('lol that movie was great')).toEqual([]);
    expect(extractPromisesFromPlayerMessage('maybe someday')).toEqual([]);
    expect(extractPromisesFromPlayerMessage('')).toEqual([]);
  });

  it('detects follow-through phrasing', () => {
    expect(looksLikeCompletion('did it! called them just now')).toBe(true);
    expect(looksLikeCompletion('all done')).toBe(true);
    expect(looksLikeCompletion('what a nice day')).toBe(false);
  });
});

describe('P3 long-term memory (SocialEngine)', () => {
  let social: SocialEngine;
  beforeEach(() => { social = makeSocial(); });

  it('caps core memories at 8 and dedupes by text', () => {
    for (let i = 0; i < 10; i++) {
      social.addCoreMemory('maya', { text: `immortal fact number ${i}`, kind: 'fact', day: 1 });
    }
    const mems = social.getCoreMemories('maya');
    expect(mems.length).toBe(8);
    const dupe = social.addCoreMemory('maya', { text: 'immortal fact number 9', kind: 'fact', day: 2 });
    expect(dupe).toBeNull();
  });

  it('keeps first_meeting memories longest under eviction pressure', () => {
    social.addCoreMemory('maya', { text: 'First met on Day 1 via intro.', kind: 'first_meeting', day: 1 });
    for (let i = 0; i < 10; i++) {
      social.addCoreMemory('maya', { text: `fact filler ${i}`, kind: 'fact', day: 1 });
    }
    const mems = social.getCoreMemories('maya');
    expect(mems.length).toBe(8);
    expect(mems.some((m) => m.kind === 'first_meeting')).toBe(true);
  });

  it('promise lifecycle: add → kept boosts trust, broken hurts', () => {
    const before = social.getRelationships('ryan')!;
    const p = social.addPromise('ryan', "i will bring tacos tomorrow", 1, 2);
    expect(p).not.toBeNull();
    expect(social.getOpenPromises('ryan').length).toBe(1);
    const kept = social.resolvePromise('ryan', p!.id, true, 2);
    expect(kept).not.toBeNull();
    expect(kept!.relationships.trust).toBeGreaterThan(before.trust);
    expect(social.getCoreMemories('ryan').some((m) => m.kind === 'promise_kept')).toBe(true);

    const p2 = social.addPromise('ryan', 'i will call tonight', 2, 2)!;
    const broken = social.resolvePromise('ryan', p2.id, false, 3);
    expect(broken!.relationships.annoyance).toBeGreaterThan(kept!.relationships.annoyance);
    expect(social.getOpenPromises('ryan').length).toBe(0);
  });

  it('checkPromiseDues auto-breaks overdue promises', () => {
    social.addPromise('nora', 'i will send the logs tonight', 1, 1);
    const broken = social.checkPromiseDues(3);
    expect(broken.length).toBe(1);
    expect(broken[0]!.promise.status).toBe('broken');
    // Second call is idempotent — already closed
    expect(social.checkPromiseDues(4).length).toBe(0);
  });

  it('derives stages from dimensions with strained override', () => {
    expect(social.getRelationshipStage('maya')).toBe('acquaintance'); // fam 10
    expect(social.getRelationshipStage('ryan')).toBe('friend'); // fam 40
    expect(social.getRelationshipStage('nobody')).toBe('stranger');
    for (let i = 0; i < 8; i++) social.applySocialAction('maya', 'dismissive'); // annoy 64
    expect(social.getRelationshipStage('maya')).toBe('strained');
  });

  it('daily mood is deterministic and cold when strained', () => {
    const a = social.getDailyMood('maya', 5);
    const b = social.getDailyMood('maya', 5);
    expect(a).toBe(b);
    for (let i = 0; i < 8; i++) social.applySocialAction('maya', 'dismissive');
    expect(social.getDailyMood('maya', 5)).toBe('cold');
  });

  it('protects core buddies from distant/gone/blocked', () => {
    expect(() => social.setBuddyStatus('maya', 'distant')).toThrow();
    expect(() => social.setBuddyStatus('ryan', 'gone')).toThrow();
  });

  it('persists memories and promises across save/restore', () => {
    social.addCoreMemory('nora', { text: 'Nora collects old manuals.', kind: 'fact', day: 2 });
    social.addPromise('nora', 'i will visit the archive', 2, 4);
    const state = social.getState();
    const restored = new SocialEngine(new EventBus(), state);
    expect(restored.getCoreMemories('nora').length).toBe(1);
    expect(restored.getOpenPromises('nora').length).toBe(1);
  });

  it('buildLongTermContext is bounded and informative', () => {
    social.addCoreMemory('nora', { text: 'Nora collects old manuals.', kind: 'fact', day: 2 });
    social.addPromise('nora', 'i will visit the archive', 2, 4);
    const ctx = social.buildLongTermContext('nora');
    expect(ctx).toContain('Nora collects old manuals');
    expect(ctx).toContain('i will visit the archive');
    expect(ctx.length).toBeLessThan(2500);
  });

  it('distant buddies are forced offline regardless of schedule', () => {
    social.registerBuddy(makeProceduralDef());
    social.setBuddyStatus('test_pal', 'distant');
    social.updatePresence(20 * 60); // 20:00 — regular archetype would be online
    expect(social.getPresence('test_pal')?.status).toBe('offline');
  });
});

describe('P3 initiative rules (characterTemplates)', () => {
  it('only friend+ online buddies with clean slate initiate', () => {
    const base = { presenceStatus: 'online' as const, mood: 'warm' as const, initiatedToday: false, roll: 10 };
    expect(shouldInitiateContact({ ...base, stage: 'close' })).toBe(true);
    expect(shouldInitiateContact({ ...base, stage: 'friend' })).toBe(true);
    expect(shouldInitiateContact({ ...base, stage: 'acquaintance' })).toBe(false);
    expect(shouldInitiateContact({ ...base, stage: 'close', presenceStatus: 'offline' })).toBe(false);
    expect(shouldInitiateContact({ ...base, stage: 'close', mood: 'off' })).toBe(false);
    expect(shouldInitiateContact({ ...base, stage: 'close', mood: 'cold' })).toBe(false);
    expect(shouldInitiateContact({ ...base, stage: 'close', initiatedToday: true })).toBe(false);
    expect(shouldInitiateContact({ ...base, stage: 'friend', roll: 30 })).toBe(false); // friend threshold 30
    expect(shouldInitiateContact({ ...base, stage: 'close', roll: 44 })).toBe(true); // close threshold 45
  });

  it('initiative text fills placeholders deterministically', () => {
    const a = pickInitiativeText('coworker', 'event_share', 'seed1', { eventTitle: 'Orion 7 launch' });
    const b = pickInitiativeText('coworker', 'event_share', 'seed1', { eventTitle: 'Orion 7 launch' });
    expect(a).toBe(b);
    expect(a).toContain('Orion 7 launch');
    expect(a).not.toContain('{event}');
    const reminder = pickInitiativeText('regular', 'promise_reminder', 'seed2', { promiseText: 'bring tacos' });
    expect(reminder).toContain('bring tacos');
    expect(pickConfrontLine('artist', 'x')).toBe(pickConfrontLine('artist', 'x'));
  });
});

describe('P3 sharp events (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  function dismiss(id: string, times: number): void {
    for (let i = 0; i < times; i++) {
      sim.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId: id, socialAction: 'dismissive' });
    }
  }

  it('writes a first_meeting memory when a buddy is added', () => {
    const res = sim.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: makeProceduralDef(), silent: true });
    expect(res.success).toBe(true);
    const mems = sim.social.getCoreMemories('test_pal');
    expect(mems.some((m) => m.kind === 'first_meeting')).toBe(true);
  });

  it('confronts once when a procedural buddy crosses the strained line', () => {
    sim.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: makeProceduralDef(), silent: true });
    dismiss('test_pal', 8); // annoy 64
    const msgs = sim.social.getMessages('test_pal');
    const confront = msgs.filter((m) => m.tags?.includes('confrontation'));
    expect(confront.length).toBe(1);
    expect(sim.world.getFlag('strained_test_pal')).toBe(true);
    // More dismissiveness does not re-confront
    dismiss('test_pal', 1);
    expect(sim.social.getMessages('test_pal').filter((m) => m.tags?.includes('confrontation')).length).toBe(1);
  });

  it('walks the full ladder: distant → dark → return after a week', () => {
    sim.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: makeProceduralDef(), silent: true });
    dismiss('test_pal', 11); // annoy 88 → distant
    expect(sim.social.getBuddy('test_pal')?.status).toBe('distant');
    const farewell = sim.social.getMessages('test_pal').filter((m) => m.tags?.includes('farewell'));
    expect(farewell.length).toBe(1);
    // Presence forced dark even at online hours
    sim.advanceGameMinutes(60, 'tick');
    expect(sim.social.getPresence('test_pal')?.status).toBe('offline');
    // A week later the buddy returns
    sim.advanceGameMinutes(8 * 1440, 'a week passes');
    expect(sim.social.getBuddy('test_pal')?.status).toBe('acquaintance');
    const returned = sim.social.getMessages('test_pal').filter((m) => m.tags?.includes('return'));
    expect(returned.length).toBe(1);
    expect(sim.social.getRelationships('test_pal')!.annoyance).toBeLessThan(60);
  });

  it('core buddies cap at strained — they never walk away', () => {
    dismiss('maya', 20); // annoy 100
    expect(sim.social.getBuddy('maya')?.status).toBe('acquaintance');
    const msgs = sim.social.getMessages('maya');
    expect(msgs.some((m) => m.tags?.includes('confrontation'))).toBe(true);
    expect(msgs.some((m) => m.tags?.includes('farewell'))).toBe(false);
  });

  it('repairs silently when kindness cools a strained bond', () => {
    dismiss('maya', 8);
    expect(sim.world.getFlag('strained_maya')).toBe(true);
    for (let i = 0; i < 8; i++) {
      sim.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId: 'maya', socialAction: 'empathy' });
    }
    expect(sim.world.getFlag('strained_maya')).toBe(false);
  });

  it('breaks overdue promises on day change and nags friend+ buddies', () => {
    sim.social.addPromise('ryan', 'i will bring tacos tonight', 1, 1);
    sim.advanceGameMinutes(2 * 1440, 'two days pass');
    expect(sim.social.getOpenPromises('ryan').length).toBe(0);
    const nag = sim.social.getMessages('ryan').filter((m) => m.tags?.includes('promise'));
    expect(nag.length).toBe(1);
    expect(nag[0]!.text).toContain('tacos');
  });
});
