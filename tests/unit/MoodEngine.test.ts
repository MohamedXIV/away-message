import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EnvironmentEngine } from '../../src/engine/EnvironmentEngine';
import { MoodEngine, type MoodContext, type MoodState } from '../../src/engine/MoodEngine';
import { PlayerNeedsEngine } from '../../src/engine/PlayerNeedsEngine';
import { SimulationEngine } from '../../src/engine/SimulationEngine';

function contextAt(
  atMinute: number,
  options: {
    needs?: ConstructorParameters<typeof PlayerNeedsEngine>[1];
    moodWeatherAffinity?: -1 | 0 | 1;
    finance?: MoodContext['finance'];
  } = {},
): { context: MoodContext; moodState: Partial<MoodState> } {
  const bus = new EventBus();
  const environment = new EnvironmentEngine(bus);
  const needs = new PlayerNeedsEngine(bus, options.needs);
  const snapshot = environment.getSnapshot({ atMinute });
  return {
    context: {
      atMinute,
      needs: needs.getSnapshot(),
      environment: snapshot,
      ...(options.finance ? { finance: options.finance } : {}),
    },
    moodState: {
      preferences: {
        environmentAffinity: options.moodWeatherAffinity === undefined
          ? {}
          : { [snapshot.weather.condition]: options.moodWeatherAffinity },
      },
    },
  };
}

describe('MoodEngine (#131)', () => {
  it('resolves baseline + canonical context deterministically without contextual stacking', () => {
    const { context, moodState } = contextAt((2 - 1) * 1440 + 720, {
      needs: {
        energy: 10,
        fatigue: 85,
        hunger: 95,
        health: 35,
        sleepDebt: 6,
        socialBattery: 100,
      },
      moodWeatherAffinity: -1,
      finance: {
        cash: 10,
        rentDueDay: 2,
        rentAmount: 140,
        rentPaid: false,
        currentDay: 2,
      },
    });
    const mood = new MoodEngine(new EventBus(), { baseline: 60, ...moodState });

    const first = mood.getSnapshot(context);
    const second = mood.getSnapshot(context);

    expect(second).toEqual(first);
    expect(first.influences.map((influence) => influence.id)).toEqual(
      [...new Set(first.influences.map((influence) => influence.id))],
    );
    expect(first.influences).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'context:needs:starving', delta: -10 }),
      expect.objectContaining({ id: 'context:needs:exhausted', delta: -8 }),
      expect.objectContaining({ id: 'context:environment:preference', delta: -4 }),
      expect.objectContaining({ id: 'context:finance:rent-pressure' }),
    ]));
  });

  it('keeps environment subjectivity explicit instead of assuming rain is bad', () => {
    const { context } = contextAt((2 - 1) * 1440 + 720);
    expect(context.environment.weather.condition).toBe('rain');

    const neutral = new MoodEngine(new EventBus(), { baseline: 50 });
    const dislikesRain = new MoodEngine(new EventBus(), {
      baseline: 50,
      preferences: { environmentAffinity: { rain: -1 } },
    });
    const likesRain = new MoodEngine(new EventBus(), {
      baseline: 50,
      preferences: { environmentAffinity: { rain: 1 } },
    });

    expect(neutral.getSnapshot(context).influences.some((i) => i.id === 'context:environment:preference')).toBe(false);
    expect(dislikesRain.getSnapshot(context).value).toBe(46);
    expect(likesRain.getSnapshot(context).value).toBe(54);
  });

  it('applies semantic transient effects idempotently and decays/expirs across large jumps', () => {
    const { context } = contextAt(100);
    const mood = new MoodEngine(new EventBus(), { baseline: 50 });

    expect(mood.applyEffect({
      kind: 'pleasant_social_interaction',
      sourceRef: 'conversation:42',
      atMinute: 100,
    })).toBe(true);
    expect(mood.applyEffect({
      kind: 'pleasant_social_interaction',
      sourceRef: 'conversation:42',
      atMinute: 100,
    })).toBe(false);
    expect(mood.getState().effects).toHaveLength(1);

    const start = mood.getSnapshot(context);
    expect(start.value).toBe(58);

    const midway = mood.getSnapshot({ ...context, atMinute: 220 });
    expect(midway.value).toBe(54);

    const after = mood.publishIfChanged({ ...context, atMinute: 1000 });
    expect(after.value).toBe(50);
    expect(after.influences.some((i) => i.kind === 'transient')).toBe(false);
    expect(mood.getState().effects).toHaveLength(0);
  });

  it('persists transient provenance/preferences and round-trips deterministically', () => {
    const { context } = contextAt(500);
    const first = new MoodEngine(new EventBus(), {
      baseline: 53,
      preferences: { environmentAffinity: { overcast: 1 } },
    });
    first.applyEffect({
      kind: 'meaningful_achievement',
      sourceRef: 'achievement:first-payday',
      atMinute: 500,
    });
    const saved = first.getState();

    const restored = new MoodEngine(new EventBus(), saved);
    expect(restored.getState()).toEqual(saved);
    expect(restored.getSnapshot(context)).toEqual(first.getSnapshot(context));
  });

  it('never mutates Needs while resolving Mood', () => {
    const bus = new EventBus();
    const needs = new PlayerNeedsEngine(bus, { energy: 9, socialBattery: 3 });
    const environment = new EnvironmentEngine(bus);
    const before = needs.getState();
    const mood = new MoodEngine(bus, { baseline: 50 });
    const context: MoodContext = {
      atMinute: 720,
      needs: needs.getSnapshot(),
      environment: environment.getSnapshot({ atMinute: 720 }),
    };

    mood.applyEffect({ kind: 'stressful_failure', sourceRef: 'job:failed', atMinute: 720 });
    mood.getSnapshot(context);
    expect(needs.getState()).toEqual(before);
  });

  it('emits mood:changed only for effective semantic changes', () => {
    const bus = new EventBus();
    const environment = new EnvironmentEngine(bus);
    const needs = new PlayerNeedsEngine(bus);
    let atMinute = 720;
    const mood = new MoodEngine(bus, { baseline: 50 }, () => ({
      atMinute,
      needs: needs.getSnapshot(),
      environment: environment.getSnapshot({ atMinute }),
    }));
    const handler = vi.fn();
    bus.on('mood:changed', handler);

    mood.publishIfChanged();
    mood.publishIfChanged();
    expect(handler).toHaveBeenCalledTimes(1);

    needs.consumeEnergy(90);
    mood.publishIfChanged();
    mood.publishIfChanged();
    expect(handler).toHaveBeenCalledTimes(2);

    mood.applyEffect({ kind: 'stressful_failure', sourceRef: 'job:x' });
    expect(handler).toHaveBeenCalledTimes(3);
    mood.applyEffect({ kind: 'stressful_failure', sourceRef: 'job:x' });
    expect(handler).toHaveBeenCalledTimes(3);

    atMinute += 600;
    mood.publishIfChanged();
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('survives Simulation current-format save/reload with transient history', () => {
    const sim = new SimulationEngine();
    sim.mood.setEnvironmentAffinity('overcast', 1);
    expect(sim.mood.applyEffect({
      kind: 'meaningful_achievement',
      sourceRef: 'milestone:setup',
    })).toBe(true);

    const snapshot = sim.exportSnapshot();
    expect(snapshot.mood?.effects).toHaveLength(1);

    const restored = new SimulationEngine(snapshot);
    expect(restored.mood.getState()).toEqual(sim.mood.getState());
    expect(restored.mood.getCurrentSnapshot()).toEqual(sim.mood.getCurrentSnapshot());
  });
});
