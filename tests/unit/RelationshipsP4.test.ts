import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine, affinityKey, SEED_AFFINITIES } from '../../src/engine/SocialEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  buildScheduleForArchetype,
  pickGossipLine,
} from '../../src/engine/characterTemplates';
import { planInitiatives, type InitiativeEngine } from '../../src/apps/pulse/utils/initiatives';
import { collectMissedPresenceActivities } from '../../src/apps/pulse/PulseMessengerApp';
import type { BuddyCharacter } from '../../src/engine/types';

function makeSocial(): SocialEngine {
  return new SocialEngine(new EventBus());
}

function makeProceduralDef(id = 'test_pal'): BuddyCharacter {
  return {
    id,
    displayName: 'Test Pal',
    handle: id,
    schedule: buildScheduleForArchetype('regular'),
    initialRelationships: { familiarity: 20, trust: 30, comfort: 30, respect: 30, annoyance: 0 },
    typingSpeedWpm: 70,
    archetype: 'regular',
    metVia: 'work',
    isProcedural: true,
    createdDay: 1,
  };
}

// Controlled stub: stages/moods always eligible, so rolls alone decide outcomes (deterministic).
function makeStubEngine(day: number, opts?: {
  promiseHolder?: string;
  distantIds?: string[];
  blockedIds?: string[];
}): InitiativeEngine {
  const distant = new Set(opts?.distantIds ?? []);
  const buddies = [
    { id: 'alice', displayName: 'Alice', status: 'friend' as const, archetype: 'regular' as const },
    { id: 'bob', displayName: 'Bob', status: 'friend' as const, archetype: 'coworker' as const },
    { id: 'zed', displayName: 'Zed', status: (distant.has('zed') ? 'distant' : 'friend') as string, archetype: 'nightowl' as const },
  ];
  return {
    social: {
      getBuddies: () => buddies,
      getRelationshipStage: () => 'close',
      getPresence: () => ({ status: 'online' }),
      getDailyMood: () => 'warm',
      getOpenPromises: (id: string) => (id === opts?.promiseHolder ? [{ text: 'bring tacos' }] : []),
    },
    world: {
      getTriggeredEvents: () => [{ title: 'Orion 7 released', triggerDay: day }],
    },
  };
}

describe('P4 initiative planner', () => {
  it('is deterministic for the same inputs', () => {
    const engine = makeStubEngine(3, { promiseHolder: 'alice' });
    const args = { day: 3, blockedIds: [] as string[], initiatedToday: {} as Record<string, number>, maxCount: 10, salt: 'login' };
    expect(planInitiatives(engine, args)).toEqual(planInitiatives(engine, args));
  });

  it('respects maxCount and marks only planned buddies', () => {
    const engine = makeStubEngine(3);
    const { plans, initiatedToday } = planInitiatives(engine, { day: 3, blockedIds: [], initiatedToday: {}, maxCount: 1, salt: 'login' });
    expect(plans.length).toBeLessThanOrEqual(1);
    expect(Object.keys(initiatedToday).length).toBe(plans.length);
    if (plans[0]) expect(initiatedToday[plans[0].buddyId]).toBe(3);
  });

  it('keeps plans priority-ordered (promise → event → gossip → checkin → cafe)', () => {
    const order = { promise_reminder: 0, event_share: 1, gossip: 2, checkin: 3, cafe_invite: 4 };
    for (const salt of ['login', 'daypass', 's2', 's3']) {
      const engine = makeStubEngine(5, { promiseHolder: 'alice', distantIds: ['zed'] });
      const { plans } = planInitiatives(engine, { day: 5, blockedIds: [], initiatedToday: {}, maxCount: 10, salt });
      for (let i = 1; i < plans.length; i++) {
        expect(order[plans[i]!.kind]).toBeGreaterThanOrEqual(order[plans[i - 1]!.kind]);
      }
    }
  });

  it('excludes blocked, distant and already-contacted buddies', () => {
    const engine = makeStubEngine(3, { distantIds: ['zed'] });
    const { plans } = planInitiatives(engine, { day: 3, blockedIds: ['alice'], initiatedToday: { bob: 3 }, maxCount: 10, salt: 'login' });
    const ids = plans.map((p) => p.buddyId);
    expect(ids).not.toContain('alice');
    expect(ids).not.toContain('bob');
    expect(ids).not.toContain('zed');
  });

  it('can produce gossip about a distant buddy (name filled, no placeholder)', () => {
    const kinds = new Set<string>();
    let gossipText = '';
    for (let s = 0; s < 16; s++) {
      const engine = makeStubEngine(4, { distantIds: ['zed'] });
      const { plans } = planInitiatives(engine, { day: 4, blockedIds: [], initiatedToday: {}, maxCount: 10, salt: `s${s}` });
      for (const p of plans) {
        kinds.add(p.kind);
        if (p.kind === 'gossip') gossipText = p.text;
      }
    }
    expect(kinds.has('gossip')).toBe(true);
    expect(gossipText).toContain('Zed');
    expect(gossipText).not.toContain('{name}');
  });
});

describe('P4 C2 affinity matrix (SocialEngine)', () => {
  let social: SocialEngine;
  beforeEach(() => { social = makeSocial(); });

  it('seeds core-4 ties and keeps keys symmetric', () => {
    expect(social.getAffinity('maya', 'ryan')).toBe(SEED_AFFINITIES['maya__ryan']);
    expect(social.getAffinity('ryan', 'maya')).toBe(social.getAffinity('maya', 'ryan'));
    expect(affinityKey('ryan', 'maya')).toBe('maya__ryan');
    expect(social.getAffinity('maya', 'henderson')).toBe(10);
  });

  it('clamps shifts and ignores self/unknown pairs', () => {
    expect(social.adjustAffinity('maya', 'maya', 50)).toBe(0);
    expect(social.adjustAffinity('maya', 'ghost', 50)).toBe(0);
    expect(social.adjustAffinity('maya', 'ryan', 1000)).toBe(100);
    expect(social.adjustAffinity('maya', 'ryan', -1000)).toBe(-100);
  });

  it('bumps room pairs +2 with a +6 daily cap', () => {
    social.registerBuddy(makeProceduralDef());
    expect(social.bumpRoomAffinity(['maya', 'ryan', 'test_pal'], 2)).toBe(3); // 3 pairs
    expect(social.getAffinity('maya', 'test_pal')).toBe(2);
    social.bumpRoomAffinity(['maya', 'test_pal'], 2);
    social.bumpRoomAffinity(['maya', 'test_pal'], 2);
    expect(social.getAffinity('maya', 'test_pal')).toBe(6); // capped, not 8
    social.bumpRoomAffinity(['maya', 'test_pal'], 3);
    expect(social.getAffinity('maya', 'test_pal')).toBe(8); // new day, cap resets
  });

  it('builds a bounded affinity context mentioning notable ties', () => {
    const ctx = social.buildAffinityContext('maya');
    expect(ctx).toContain('Ryan');
    expect(ctx).toContain('+15');
    expect(ctx.startsWith('Others:')).toBe(true);
    social.registerBuddy(makeProceduralDef());
    expect(social.buildAffinityContext('test_pal')).toBe(''); // all zeros → empty
  });

  it('persists affinities across save/restore and clears them on remove', () => {
    social.registerBuddy(makeProceduralDef());
    social.adjustAffinity('maya', 'test_pal', 20);
    const restored = new SocialEngine(new EventBus(), social.getState());
    expect(restored.getAffinity('test_pal', 'maya')).toBe(20);
    expect(restored.getAffinity('maya', 'ryan')).toBe(15); // seeds survive
    social.removeBuddy('test_pal');
    expect(social.getAffinity('maya', 'test_pal')).toBe(0);
  });

  it('fills gossip lines deterministically with the target name', () => {
    const a = pickGossipLine('regular', 'seed9', 'Zed', 'gone');
    expect(a).toBe(pickGossipLine('coworker', 'seed9', 'Zed', 'gone')); // shared pools
    expect(a).toContain('Zed');
    expect(a).not.toContain('{name}');
    expect(pickGossipLine('regular', 'seed9', 'Zed', 'distant')).not.toBe(a);
  });
});

describe('P4 witness shifts (SimulationEngine)', () => {
  let sim: SimulationEngine;
  beforeEach(() => { sim = new SimulationEngine(); });

  function dismiss(id: string, times: number): void {
    for (let i = 0; i < times; i++) {
      sim.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId: id, socialAction: 'dismissive' });
    }
  }

  it('applies every schema socialAction without error (B wiring target)', () => {
    const actions = ['empathy', 'remembered_detail', 'tease_playful', 'dismissive', 'vulnerable_share', 'work_camaraderie', 'intellectual_curiosity'];
    for (const action of actions) {
      const res = sim.dispatchAction({ type: 'SOCIAL_APPLY_ACTION', buddyId: 'maya', socialAction: action });
      expect(res.success).toBe(true);
    }
  });

  it('close friends cool toward a buddy they see confronted then abandoned', () => {
    sim.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: makeProceduralDef(), silent: true });
    dismiss('test_pal', 8); // confrontation → witnesses -4 (ryan is friend)
    expect(sim.social.getAffinity('ryan', 'test_pal')).toBe(-4);
    dismiss('test_pal', 3); // 11 total → distant → witnesses -10
    expect(sim.social.getAffinity('ryan', 'test_pal')).toBe(-14);
  });

  it('a return warms witnesses back up', () => {
    sim.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: makeProceduralDef(), silent: true });
    dismiss('test_pal', 11);
    expect(sim.social.getBuddy('test_pal')?.status).toBe('distant');
    sim.advanceGameMinutes(8 * 1440, 'a week passes');
    expect(sim.social.getBuddy('test_pal')?.status).toBe('acquaintance');
    expect(sim.social.getAffinity('ryan', 'test_pal')).toBe(-6); // -14 + 8
  });
});

describe('P4 away-history dedupe ids', () => {
  it('emits deterministic ids so repeats collapse', () => {
    const getBuddy = () => ({
      displayName: 'Ryan',
      schedule: { 1: [{ startMinuteOfDay: 960, endMinuteOfDay: 1080, status: 'away', awayMessage: 'afk grabbin tacos' }] } as any,
    });
    const first = collectMissedPresenceActivities(0, 2000, getBuddy, ['ryan']);
    const second = collectMissedPresenceActivities(0, 2000, getBuddy, ['ryan']);
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((e) => e.id)).toEqual(second.map((e) => e.id));
  });
});
