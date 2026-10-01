import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EnvironmentEngine } from '../../src/engine/EnvironmentEngine';
import { WorldEventsEngine } from '../../src/engine/WorldEventsEngine';
import type { WorldModifierSpec } from '../../src/engine/WorldModifiers';
import { projectEnvironmentPresentation } from '../../src/world/phaser/environment/environmentProjection';
import { projectEnvironmentAudio } from '../../src/audio/environmentMapping';

const atDay = (day: number, minuteOfDay = 720) => (day - 1) * 1440 + minuteOfDay;

describe('EnvironmentEngine (#129)', () => {
  it('resolves deterministic base environment without events', () => {
    const env = new EnvironmentEngine(new EventBus());
    const atMinute = atDay(2, 845);
    expect(env.getSnapshot({ atMinute })).toEqual(env.getSnapshot({ atMinute }));
    const snapshot = env.getSnapshot({ atMinute });
    expect(snapshot.day).toBe(2);
    expect(snapshot.weather.condition).toBe('rain');
    expect(snapshot.weather.tags).toContain('wet');
    expect(snapshot.sourceEventIds).toEqual([]);
  });

  it('resolves a triggered typed world modifier and restores base truth after expiry', () => {
    const bus = new EventBus();
    const specs: WorldModifierSpec[] = [
      { id: 'festival_storm', eventId: 'city_canal_festival', domain: 'environment', kind: 'condition_override', durationMinutes: 120, targetIds: [], value: 'storm' },
      { id: 'festival_cold', eventId: 'city_canal_festival', domain: 'environment', kind: 'temperature_delta', durationMinutes: 120, targetIds: [], value: -8 },
    ];
    const world = new WorldEventsEngine(bus, undefined, specs);
    const env = new EnvironmentEngine(bus, world);
    const firedAt = atDay(5, 600);
    world.triggerEventById('city_canal_festival', firedAt);

    const active = env.getSnapshot({ atMinute: firedAt + 30 });
    expect(active.weather.condition).toBe('storm');
    expect(active.sourceEventIds).toEqual(['city_canal_festival']);

    const expiredAt = firedAt + 121;
    expect(env.getSnapshot({ atMinute: expiredAt })).toEqual(
      new EnvironmentEngine(new EventBus()).getSnapshot({ atMinute: expiredAt }),
    );
  });

  it('resolves conflicts deterministically and clamps scalar deltas', () => {
    const bus = new EventBus();
    const specs: WorldModifierSpec[] = [
      { id: 'a_clear', eventId: 'city_canal_festival', domain: 'environment', kind: 'condition_override', durationMinutes: 60, targetIds: [], value: 'clear' },
      { id: 'z_storm', eventId: 'city_canal_festival', domain: 'environment', kind: 'condition_override', durationMinutes: 60, targetIds: [], value: 'storm' },
      { id: 'z_visibility', eventId: 'city_canal_festival', domain: 'environment', kind: 'visibility_delta', durationMinutes: 60, targetIds: [], value: -99 },
      { id: 'z_wind', eventId: 'city_canal_festival', domain: 'environment', kind: 'wind_delta', durationMinutes: 60, targetIds: [], value: 99 },
    ];
    const world = new WorldEventsEngine(bus, undefined, specs);
    const env = new EnvironmentEngine(bus, world);
    const firedAt = atDay(5, 700);
    world.triggerEventById('city_canal_festival', firedAt);

    const snapshot = env.getSnapshot({ atMinute: firedAt });
    expect(snapshot.weather.condition).toBe('storm');
    expect(snapshot.weather.wind).toBe(1);
    expect(snapshot.weather.visibility).toBe(0);
    expect(snapshot.weather.tags).toContain('severe');
  });

  it('maps rain, drizzle and storm to wet Phaser/audio semantics', () => {
    const env = new EnvironmentEngine(new EventBus());
    for (const day of [2, 4, 15]) {
      const snapshot = env.getSnapshot({ atMinute: atDay(day) });
      const presentation = projectEnvironmentPresentation(snapshot);
      const audio = projectEnvironmentAudio(snapshot);
      expect(presentation.weather).toBe('rain');
      expect(presentation.rainIntensity).toBeGreaterThan(0);
      expect(audio.wet).toBe(true);
      expect(audio.precipitation).toBe(snapshot.weather.precipitation);
    }
  });

  it('keeps forecast deterministic, bounded and read-only', () => {
    const bus = new EventBus();
    const world = new WorldEventsEngine(bus);
    const env = new EnvironmentEngine(bus, world);
    const before = world.getState();
    const first = env.getForecast({ atMinute: atDay(3, 540), count: 20 });
    expect(env.getForecast({ atMinute: atDay(3, 540), count: 20 })).toEqual(first);
    expect(first).toHaveLength(10);
    expect(world.getState()).toEqual(before);
  });

  it('dedupes environment change events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('environment:changed', handler);
    const env = new EnvironmentEngine(bus);
    const atMinute = atDay(2, 720);
    env.publishIfChanged({ atMinute });
    env.publishIfChanged({ atMinute });
    env.publishIfChanged({ atMinute });
    expect(handler).toHaveBeenCalledTimes(1);
    env.publishIfChanged({ atMinute: atMinute + 180 });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
