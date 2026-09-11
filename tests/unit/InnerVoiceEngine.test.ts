import { describe, expect, it } from 'vitest';
import { InnerVoiceEngine } from '../../src/engine/innerVoice/InnerVoiceEngine';
import type { ThoughtTrigger } from '../../src/engine/innerVoice/types';

function ambientTrigger(overrides: Partial<ThoughtTrigger> = {}): ThoughtTrigger {
  return {
    kind: 'street_detail',
    topic: 'rain on the awning',
    semanticMeaning: 'i notice rain has started outside the corner mart awning',
    tone: 'neutral',
    priority: 10,
    source: 'world:weather',
    knowledgeRefs: ['visible:weather:rain', 'visible:place:corner_mart'],
    cooldownKey: 'weather:rain',
    presentation: 'ambient',
    knowledge: {
      visiblePlaceId: 'corner_mart',
      weatherHint: 'rain has started outside',
    },
    ...overrides,
  };
}

describe('InnerVoiceEngine rules (rules decide, AI only paraphrases)', () => {
  it('1. hidden knowledge cannot enter a ThoughtIntent', () => {
    const engine = new InnerVoiceEngine();
    const hidden = ambientTrigger({
      id: undefined,
      knowledgeRefs: ['npc_private:motive', 'hidden:schedule', 'visible:weather:rain'],
      knowledge: {
        visiblePlaceId: 'corner_mart',
        weatherHint: 'rain has started outside',
        // Runtime-only hidden fields smuggled past the type boundary.
        hiddenMotive: 'she is lying about the money',
        undisclosedFact: 'the safe code is 4412',
        npcPrivateSchedule: 'meets at midnight',
      } as unknown as ThoughtTrigger['knowledge'],
    } as Partial<ThoughtTrigger> as ThoughtTrigger);
    expect(engine.request(hidden, 100)).toBeNull();

    // Even a directly-constructed intent built from hidden refs must be rejected.
    expect(
      engine.request(
        ambientTrigger({ knowledgeRefs: ['undisclosed:item:safe_code'] }),
        100,
      ),
    ).toBeNull();
  });

  it('2. cooldown prevents repeated thought spam', () => {
    const engine = new InnerVoiceEngine();
    const first = engine.request(ambientTrigger(), 1000);
    expect(first).not.toBeNull();
    expect(first?.cooldownKey).toBe('weather:rain');

    // Same cooldown key inside the window is suppressed.
    expect(engine.request(ambientTrigger(), 1010)).toBeNull();
    expect(engine.request(ambientTrigger(), 1100)).toBeNull();

    // After the thought is dismissed and the window elapses, the same
    // observation may surface again (no permanent spam-block for ordinary notes).
    engine.dismissActive();
    const later = engine.request(ambientTrigger(), 5000);
    expect(later).not.toBeNull();
  });

  it('3. higher priority beats ambient (one active thought at a time)', () => {
    const engine = new InnerVoiceEngine();
    const ambient = engine.request(ambientTrigger(), 100);
    expect(ambient?.presentation).toBe('ambient');
    expect(engine.peekActive()?.id).toBe(ambient?.id);

    const urgent = engine.request(
      ambientTrigger({
        topic: 'missed rent',
        semanticMeaning: 'i realize rent is due tomorrow and my cash is short',
        tone: 'uneasy',
        priority: 90,
        source: 'economy:rent',
        knowledgeRefs: ['player:economy:cash', 'player:economy:rent_due'],
        cooldownKey: 'economy:rent_due',
        presentation: 'urgent',
        knowledge: { economyHint: 'cash is short, rent due tomorrow' },
      }),
      105,
    );
    expect(urgent).not.toBeNull();
    expect(urgent?.presentation).toBe('urgent');
    // Preemption: the urgent thought is now the single active thought.
    expect(engine.peekActive()?.id).toBe(urgent?.id);

    // A late ambient thought must not displace the urgent one.
    const lateAmbient = engine.request(
      ambientTrigger({ cooldownKey: 'street:neon', topic: 'neon flicker' }),
      106,
    );
    expect(engine.peekActive()?.id).toBe(urgent?.id);
    expect(lateAmbient === null || engine.peekActive()?.id === urgent?.id).toBe(true);
  });

  it('4. Inspect/Think requests a contextual thought without mutating its input', () => {
    const engine = new InnerVoiceEngine();
    const knowledge = Object.freeze({
      visiblePlaceId: 'room104',
      visibleObjects: Object.freeze(['chipped mug', 'crt monitor']),
    }) as ThoughtTrigger['knowledge'];
    const before = JSON.stringify(knowledge);
    const intent = engine.requestInspect(
      {
        topic: 'chipped mug',
        semanticMeaning: 'i turn the chipped mug over in my hands',
        source: 'inspect:item',
        knowledgeRefs: ['visible:object:chipped_mug'],
        knowledge,
      },
      200,
    );
    expect(intent).not.toBeNull();
    expect(intent?.presentation).toBe('inspect');
    expect(JSON.stringify(knowledge)).toBe(before);
  });

  it('suppresses ambient thoughts during important UI/dialogue, keeps urgent ones', () => {
    const engine = new InnerVoiceEngine();
    const suppressed = engine.request(ambientTrigger(), 300, { importantDialogueOpen: true });
    expect(suppressed).toBeNull();

    const urgent = engine.request(
      ambientTrigger({
        priority: 95,
        presentation: 'urgent',
        cooldownKey: 'urgent:test',
        knowledgeRefs: ['player:economy:cash'],
        knowledge: { economyHint: 'cash is short' },
      }),
      301,
      { importantDialogueOpen: true },
    );
    expect(urgent).not.toBeNull();
  });

  it('8. reload does not replay persisted notable thought (engine-level hydration)', () => {
    const first = new InnerVoiceEngine();
    const notable = first.request(
      ambientTrigger({
        topic: 'missed rent',
        semanticMeaning: 'i realize rent is due tomorrow and my cash is short',
        tone: 'uneasy',
        priority: 90,
        source: 'economy:rent',
        knowledgeRefs: ['player:economy:cash'],
        cooldownKey: 'economy:rent_due',
        presentation: 'urgent',
        knowledge: { economyHint: 'cash is short' },
      }),
      400,
    );
    expect(notable).not.toBeNull();

    // Hydrate a fresh engine from persisted cooldown/notable state: same trigger suppressed.
    const persisted = first.getPersistedState();
    const second = new InnerVoiceEngine(persisted);
    expect(
      second.request(
        ambientTrigger({
          topic: 'missed rent',
          semanticMeaning: 'i realize rent is due tomorrow and my cash is short',
          tone: 'uneasy',
          priority: 90,
          source: 'economy:rent',
          knowledgeRefs: ['player:economy:cash'],
          cooldownKey: 'economy:rent_due',
          presentation: 'urgent',
          knowledge: { economyHint: 'cash is short' },
        }),
        410,
      ),
    ).toBeNull();
  });

  it('bounds recent history so the queue cannot grow without limit', () => {
    const engine = new InnerVoiceEngine();
    for (let i = 0; i < 40; i++) {
      engine.request(
        ambientTrigger({
          topic: `detail ${i}`,
          semanticMeaning: `i notice street detail number ${i}`,
          cooldownKey: `street:detail:${i}`,
          knowledgeRefs: ['visible:place:corner_mart'],
        }),
        1000 + i * 500,
      );
      engine.dismissActive();
    }
    expect(engine.getRecent().length).toBeLessThanOrEqual(20);
  });
});
