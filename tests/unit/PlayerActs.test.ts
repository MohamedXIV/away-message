import { describe, it, expect } from 'vitest';
import {
  classifyPlayerTone,
  receptionForBoldAct,
  receptionHintFor,
  isApology,
  pickInnerVoice,
  toneSuggestion,
  batteryCostForOuting,
  BATTERY_DM,
  BATTERY_FLIRTY,
  BATTERY_HOT,
} from '../../src/engine/PlayerActs';

describe('PlayerActs tone classification (rules only)', () => {
  it('classifies everyday, warm, cold, flirty and hot lines with prices', () => {
    expect(classifyPlayerTone('hey, how was your day')).toMatchObject({ tone: 'normal', boldness: 0, upfrontCost: BATTERY_DM, requiresStage: 'any' });
    expect(classifyPlayerTone('thanks, that means a lot')).toMatchObject({ tone: 'warm', boldness: 0 });
    expect(classifyPlayerTone('whatever. leave me alone')).toMatchObject({ tone: 'cold', boldness: 0 });
    expect(classifyPlayerTone('you looked really cute today')).toMatchObject({ tone: 'flirty', boldness: 1, upfrontCost: BATTERY_FLIRTY, requiresStage: 'friend' });
    expect(classifyPlayerTone('i want to kiss you')).toMatchObject({ tone: 'hot', boldness: 2, upfrontCost: BATTERY_HOT, requiresStage: 'close' });
  });

  it('escalates degree on repeated hits (hotter pink / deeper blue)', () => {
    expect(classifyPlayerTone('you are cute').degree).toBe(1);
    expect(classifyPlayerTone('cute cute cute, such a crush on you, adore you').degree).toBe(2);
  });

  it('judges bold acts: offlimits without the stage, warm when safe', () => {
    const maxed = {
      familiarity: 80, trust: 100, comfort: 100, respect: 80, annoyance: 0,
      affection: 60, attraction: 50, suspicion: 0, resentment: 0,
    };
    const traits = { shyness: 25, warmth: 78, discipline: 50, spontaneity: 72, loyalty: 62 };
    // Stranger + flirty: no roll, always offlimits
    expect(receptionForBoldAct({ buddyId: 'x', stage: 'stranger', dims: maxed, traits, day: 1, seed: 's' }, 1)).toBe('offlimits');
    expect(receptionForBoldAct({ buddyId: 'x', stage: 'friend', dims: maxed, traits, day: 1, seed: 's' }, 2)).toBe('offlimits');
    // Maxed close + flirty: score 105 beats any 0..99 roll → always warm
    const maxedOpen = { ...traits, shyness: 0, warmth: 100 };
    for (const seed of ['a', 'bb', 'ccc', 'dddd']) {
      expect(receptionForBoldAct({ buddyId: 'x', stage: 'close', dims: maxed, traits: maxedOpen, day: 3, seed }, 1)).toBe('warm');
    }
    // Maxed close + hot: never rejected (worst case lukewarm)
    for (const seed of ['a', 'bb', 'ccc', 'dddd', 'eeeee']) {
      expect(['warm', 'lukewarm']).toContain(
        receptionForBoldAct({ buddyId: 'x', stage: 'close', dims: maxed, traits, day: 3, seed }, 2)
      );
    }
    // Deterministic per seed
    const input = { buddyId: 'maya', stage: 'friend' as const, dims: { ...maxed, comfort: 40, trust: 40 }, traits, day: 5, seed: 'hey' };
    expect(receptionForBoldAct(input, 1)).toBe(receptionForBoldAct(input, 1));
  });

  it('writes reception hints that never quote mechanics', () => {
    expect(receptionHintFor('warm', 'Maya')).toContain('warmly');
    expect(receptionHintFor('reject', 'Maya')).toContain('distant');
    expect(receptionHintFor('offlimits', 'Maya')).toContain('distant');
  });

  it('detects apologies and prices outings', () => {
    expect(isApology('sorry, that came out wrong')).toBe(true);
    expect(isApology('my bad, forgive me')).toBe(true);
    expect(isApology('hey whats up')).toBe(false);
    expect(batteryCostForOuting(45)).toBe(8);
    expect(batteryCostForOuting(5)).toBe(4);
  });

  it('tones suggestions with price previews', () => {
    expect(toneSuggestion('you looked cute today')).toMatchObject({ tone: 'flirty', cost: BATTERY_FLIRTY });
    expect(toneSuggestion('see you later')).toMatchObject({ tone: 'normal', cost: BATTERY_DM });
  });

  it('picks inner-voice lines deterministically', () => {
    const a = pickInnerVoice('blocked', 'maya:1');
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(5);
    expect(pickInnerVoice('blocked', 'maya:1')).toBe(a);
  });
});
