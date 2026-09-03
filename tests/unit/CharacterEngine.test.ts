import { describe, it, expect } from 'vitest';
import { buildCharacter, validatePersistedBuddy } from '../../src/engine/CharacterEngine';
import {
  buildScheduleForArchetype,
  listArchetypes,
  validateCharacterId,
} from '../../src/engine/characterTemplates';
import { EventBus } from '../../src/engine/EventBus';
import { SocialEngine } from '../../src/engine/SocialEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('CharacterEngine (unified factory + templates)', () => {
  it('lists all six archetypes', () => {
    expect(listArchetypes().sort()).toEqual(['artist', 'coworker', 'nightowl', 'regular', 'student', 'trader']);
  });

  it('builds a valid artist buddy (sam_guitar) from template', () => {
    const { definition, personaHint } = buildCharacter({
      id: 'sam_guitar',
      displayName: 'Sam',
      handle: 'sam_guitar',
      archetype: 'artist',
      metVia: 'myplace',
      createdDay: 5,
    });

    expect(definition.id).toBe('sam_guitar');
    expect(definition.archetype).toBe('artist');
    expect(definition.isProcedural).toBe(true);
    expect(definition.status).toBe('acquaintance');
    expect(personaHint.length).toBeGreaterThan(10);
    // Weekly schedule keys 1..7
    expect(Object.keys(definition.schedule).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Artist is online late
    const dayBlocks = definition.schedule[1]!;
    expect(dayBlocks.some((b) => b.status === 'online' && b.startMinuteOfDay >= 1020)).toBe(true);
    // Relationships clamped
    Object.values(definition.initialRelationships).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('rejects invalid ids', () => {
    expect(validateCharacterId('')).toEqual({ ok: false, error: expect.any(String) });
    expect(validateCharacterId('Starlight Maya')).toEqual({ ok: false, error: expect.any(String) });
    expect(validateCharacterId('player')).toEqual({ ok: false, error: expect.any(String) });
    expect(validateCharacterId('sam_guitar').ok).toBe(true);
    expect(() =>
      buildCharacter({ id: 'Bad Id!', displayName: 'X', handle: 'x' })
    ).toThrow();
  });

  it('gives same-archetype buddies stable deterministic jitter', () => {
    const a = buildCharacter({ id: 'aaa_muse', displayName: 'A', handle: 'aaa', archetype: 'regular' });
    const b = buildCharacter({ id: 'aaa_muse', displayName: 'A', handle: 'aaa', archetype: 'regular' });
    expect(a.definition.initialRelationships).toEqual(b.definition.initialRelationships);
  });

  it('validates persisted buddy defs before registering', () => {
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar' });
    const res = validatePersistedBuddy(JSON.parse(JSON.stringify(definition)));
    expect(res.ok).toBe(true);
    expect(res.definition?.id).toBe('sam_guitar');

    expect(validatePersistedBuddy(null).ok).toBe(false);
    expect(validatePersistedBuddy({ id: 'x', displayName: 'X' }).ok).toBe(false);
    expect(validatePersistedBuddy({ ...definition, schedule: {} }).ok).toBe(false);
  });

  it('builds weekly schedules for every archetype', () => {
    for (const arch of listArchetypes()) {
      const sched = buildScheduleForArchetype(arch);
      expect(Object.keys(sched)).toHaveLength(7);
      for (const blocks of Object.values(sched)) {
        expect(blocks.length).toBeGreaterThan(0);
        for (const b of blocks) {
          expect(b.startMinuteOfDay).toBeGreaterThanOrEqual(0);
          expect(b.endMinuteOfDay).toBeLessThanOrEqual(1440);
        }
      }
    }
  });
});

describe('SocialEngine dynamic roster (registerBuddy + weekly rotation + persistence)', () => {
  it('registers a CharacterEngine buddy and seeds relationship/presence/conversation', () => {
    const social = new SocialEngine(new EventBus());
    const { definition } = buildCharacter({
      id: 'sam_guitar',
      displayName: 'Sam',
      handle: 'sam_guitar',
      archetype: 'artist',
      metVia: 'myplace',
      createdDay: 5,
    });
    const registered = social.registerBuddy(definition);
    expect(registered.id).toBe('sam_guitar');
    expect(social.getBuddy('sam_guitar')?.handle).toBe('sam_guitar');
    expect(social.getRelationships('sam_guitar')?.familiarity).toBeGreaterThanOrEqual(0);
    expect(social.getPresence('sam_guitar')?.status).toBe('offline');
    expect(social.getMessages('sam_guitar')).toEqual([]);
  });

  it('rejects duplicates, invalid ids, and core removal', () => {
    const social = new SocialEngine(new EventBus());
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar' });
    social.registerBuddy(definition);
    expect(() => social.registerBuddy(definition)).toThrow(/already registered/);
    expect(() => social.registerBuddy({ ...definition, id: 'Bad Id!' })).toThrow();
    expect(() => social.removeBuddy('maya')).toThrow(/Core buddy/);
    expect(social.removeBuddy('sam_guitar')).toBe(true);
    expect(social.getBuddy('sam_guitar')).toBeUndefined();
  });

  it('resolves weekly rotation for dynamic buddies on day 8+ and free play', () => {
    const social = new SocialEngine(new EventBus());
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    social.registerBuddy(definition);
    // Day 8 21:00 (totalMinutes = 7*1440 + 1260) — artist is online late via weekly rotation
    social.updatePresence(7 * 1440 + 1200);
    expect(social.getPresence('sam_guitar')?.status).toBe('online');
    // Day 20 (free play) still resolves instead of collapsing
    social.updatePresence(19 * 1440 + 1200);
    expect(social.getPresence('sam_guitar')?.status).toBe('online');
  });

  it('keeps core 14-day schedules byte-identical under weekly lookup', () => {
    const social = new SocialEngine(new EventBus());
    // Day 8 08:00 → henderson online (office), same as before the rotation change
    social.updatePresence(7 * 1440 + 480);
    expect(social.getPresence('henderson')?.status).toBe('online');
  });

  it('shares the timeline end-to-end: attitudes + MyPlace stub follow registration', () => {
    const engine = new SimulationEngine();
    const { definition } = buildCharacter({
      id: 'sam_guitar',
      displayName: 'Sam',
      handle: 'sam_guitar',
      archetype: 'artist',
      metVia: 'myplace',
      createdDay: engine.getState().time.day,
    });
    engine.social.registerBuddy(definition);

    // Advance past Day 3 so a world event triggers and attitudes generate
    engine.advanceGameMinutes(3 * 1440, 'meet sam test');
    const knowledge = engine.world.getBuddyKnowledge('sam_guitar');
    expect(knowledge.length).toBeGreaterThan(0);
    // Artist archetype voice, not a silent fallback
    expect(knowledge[0]?.personalTake.length).toBeGreaterThan(5);

    // MyPlace page exists for the newcomer
    const page = engine.myplace.getNpcProfile('sam_guitar');
    expect(page?.displayName).toBe('Sam');

    // Full snapshot round-trip keeps the newcomer
    const snapshot = engine.exportSnapshot();
    const revived = new SimulationEngine();
    revived.loadSnapshot(snapshot);
    expect(revived.social.getBuddy('sam_guitar')?.handle).toBe('sam_guitar');
    expect(revived.world.getBuddyKnowledge('sam_guitar').length).toBeGreaterThan(0);
  });

  it('round-trips a dynamic buddy through getState/restoreState (no wipe on reload)', () => {
    const social = new SocialEngine(new EventBus());
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    social.registerBuddy(definition);
    social.applySocialAction('sam_guitar', 'empathy');

    const snapshot = social.getState();
    expect(snapshot.buddies?.['sam_guitar']?.handle).toBe('sam_guitar');

    const restored = new SocialEngine(new EventBus(), snapshot);
    expect(restored.getBuddy('sam_guitar')?.displayName).toBe('Sam');
    expect(restored.getRelationships('sam_guitar')?.familiarity).toBe(
      social.getRelationships('sam_guitar')?.familiarity
    );
    // Core 4 untouched
    expect(restored.getBuddy('maya')?.handle).toBe('starlight_maya');
  });
});
