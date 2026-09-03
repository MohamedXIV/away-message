import { describe, it, expect } from 'vitest';
import { parseNewcomer } from '../../src/ai/characterSchemas';
import {
  generateNewcomer,
  shouldAutoDiscover,
  NEWCOMER_METVIA_ROTATION,
} from '../../src/engine/CharacterDirector';
import { buildCharacter } from '../../src/engine/CharacterEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

describe('characterSchemas (governed newcomer validation)', () => {
  const valid = {
    id: 'june_tape',
    displayName: 'June',
    handle: 'june_tape',
    archetype: 'artist',
    headline: 'Taping rehearsals // new songs weekly',
    bio: 'I record every rehearsal on a handheld deck and trade tapes with friends.',
    interests: ['Tapes', 'Gigs', 'Rain'],
    songTitle: 'Rehearsal 12B',
    introText: 'hey! june here — loved your vibe. mind if i add you?',
  };

  it('accepts a valid newcomer payload', () => {
    expect(parseNewcomer(valid).id).toBe('june_tape');
  });

  it('rejects bad ids, short fields, and extra keys', () => {
    expect(() => parseNewcomer({ ...valid, id: 'Bad Id!' })).toThrow();
    expect(() => parseNewcomer({ ...valid, bio: 'too short' })).toThrow();
    expect(() => parseNewcomer({ ...valid, interests: ['only-one'] })).toThrow();
    expect(() => parseNewcomer({ ...valid, archetype: 'alien' })).toThrow();
    expect(() => parseNewcomer({ ...valid, extra: 'nope' })).toThrow();
  });
});

describe('CharacterDirector template path (offline, deterministic)', () => {
  it('generates a valid newcomer from templates without AI', async () => {
    const res = await generateNewcomer(
      { metVia: 'nightboard', day: 6, seed: 'test-seed-1', useAI: false },
      { existingIds: ['ryan', 'maya', 'nora', 'henderson'] }
    );
    expect(res.source).toBe('template');
    expect(res.definition.id).toMatch(/^[a-z][a-z0-9_]*$/);
    expect(res.definition.metVia).toBe('nightboard');
    expect(res.definition.status).toBe('stranger');
    expect(res.introText).toContain('http://myplace.local/');
    expect(res.profilePatch.headline.length).toBeGreaterThan(5);
  });

  it('is deterministic for the same seed', async () => {
    const a = await generateNewcomer({ metVia: 'myplace', day: 7, seed: 'same', useAI: false }, { existingIds: [] });
    const b = await generateNewcomer({ metVia: 'myplace', day: 7, seed: 'same', useAI: false }, { existingIds: [] });
    expect(a.definition.id).toBe(b.definition.id);
    expect(a.introText).toBe(b.introText);
  });

  it('avoids taken ids with suffixes', async () => {
    const res = await generateNewcomer(
      { metVia: 'work', day: 8, seed: 'test-seed-1', archetype: 'artist', useAI: false },
      { existingIds: ['ryan', 'maya', 'nora', 'henderson', 'june_tape', 'theo_fret', 'lena_reel', 'kai_chorus'] }
    );
    expect(['ryan', 'maya', 'nora', 'henderson', 'june_tape', 'theo_fret', 'lena_reel', 'kai_chorus']).not.toContain(res.definition.id);
  });

  it('honors manual names (AI Lab / MyPlace add flows)', async () => {
    const res = await generateNewcomer(
      { metVia: 'myplace', day: 5, displayName: 'Zed', handle: 'zed_window', useAI: false },
      { existingIds: [] }
    );
    expect(res.definition.displayName).toBe('Zed');
    expect(res.definition.handle).toBe('zed_window');
  });
});

describe('shouldAutoDiscover (throttle)', () => {
  it('never before day 6 and respects the 4-day gap', () => {
    expect(shouldAutoDiscover(5, 0)).toBe(false);
    expect(shouldAutoDiscover(6, 4)).toBe(false);
    expect(shouldAutoDiscover(9, 6)).toBe(false);
    // Deterministic roll — one of these days fires, none crash
    const fired = [6, 7, 8, 9, 10, 11, 12].filter((d) => shouldAutoDiscover(d, 0));
    expect(fired.length).toBeGreaterThan(0);
    expect(fired.length).toBeLessThan(7);
  });

  it('rotates meeting places', () => {
    expect(NEWCOMER_METVIA_ROTATION).toEqual(['nightboard', 'myplace', 'work', 'pulse-room']);
  });
});

describe('SOCIAL_ADD_BUDDY / SOCIAL_REMOVE_BUDDY actions', () => {
  it('adds a buddy with an intro message and telemetry', () => {
    const engine = new SimulationEngine();
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar', archetype: 'artist' });
    const res = engine.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: definition, introText: 'hey! sam here' });
    expect(res.success).toBe(true);
    expect(engine.social.getBuddy('sam_guitar')?.displayName).toBe('Sam');
    const msgs = engine.social.getMessages('sam_guitar');
    expect(msgs.length).toBe(1);
    expect(msgs[0]?.text).toBe('hey! sam here');
    expect(msgs[0]?.tags).toContain('newcomer');
    // Duplicate add fails cleanly
    const dup = engine.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: definition });
    expect(dup.success).toBe(false);
  });

  it('adds silently when asked (MyPlace add flow)', () => {
    const engine = new SimulationEngine();
    const { definition } = buildCharacter({ id: 'zed_window', displayName: 'Zed', handle: 'zed_window' });
    const res = engine.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: definition, silent: true });
    expect(res.success).toBe(true);
    expect(engine.social.getMessages('zed_window')).toEqual([]);
  });

  it('rejects invalid definitions', () => {
    const engine = new SimulationEngine();
    const res = engine.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: { id: 'Bad Id!' } as any });
    expect(res.success).toBe(false);
  });

  it('removes procedural buddies but refuses core ones', () => {
    const engine = new SimulationEngine();
    const { definition } = buildCharacter({ id: 'sam_guitar', displayName: 'Sam', handle: 'sam_guitar' });
    engine.dispatchAction({ type: 'SOCIAL_ADD_BUDDY', buddy: definition, silent: true });
    expect(engine.dispatchAction({ type: 'SOCIAL_REMOVE_BUDDY', buddyId: 'sam_guitar' }).success).toBe(true);
    expect(engine.social.getBuddy('sam_guitar')).toBeUndefined();
    const core = engine.dispatchAction({ type: 'SOCIAL_REMOVE_BUDDY', buddyId: 'maya' });
    expect(core.success).toBe(false);
  });
});
