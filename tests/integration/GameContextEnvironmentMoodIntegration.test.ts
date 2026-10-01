import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EnvironmentEngine } from '../../src/engine/EnvironmentEngine';
import { createGameContextReadApi, type GameContextReadApi } from '../../src/engine/GameContext';
import { MoodEngine } from '../../src/engine/MoodEngine';
import { PlayerNeedsEngine } from '../../src/engine/PlayerNeedsEngine';
import { WorldEventsEngine } from '../../src/engine/WorldEventsEngine';
import type { WorldModifierSpec } from '../../src/engine/WorldModifiers';
import { buildInnerVoiceKnowledgeFromGameContext } from '../../src/engine/innerVoice/GameContextKnowledge';
import { projectEnvironmentAudio } from '../../src/audio/environmentMapping';
import { projectEnvironmentPresentation } from '../../src/world/phaser/environment/environmentProjection';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

describe('Game Context environment/mood integration (#132)', () => {
  it('keeps WorldEvent -> Environment -> Phaser/audio/Mood/InnerVoice on one truth through expiry', () => {
    const bus = new EventBus();
    const modifiers: WorldModifierSpec[] = [{
      id: 'festival_storm',
      eventId: 'city_canal_festival',
      domain: 'environment',
      kind: 'condition_override',
      durationMinutes: 120,
      targetIds: [],
      value: 'storm',
    }, {
      id: 'festival_wind',
      eventId: 'city_canal_festival',
      domain: 'environment',
      kind: 'wind_delta',
      durationMinutes: 120,
      targetIds: [],
      value: 0.1,
    }];
    const world = new WorldEventsEngine(bus, undefined, modifiers);
    let minute = (5 - 1) * 1440 + 600;
    const environment = new EnvironmentEngine(bus, world, () => minute);
    const needs = new PlayerNeedsEngine(bus);
    let gameContext!: GameContextReadApi;
    const mood = new MoodEngine(bus, {
      baseline: 50,
      preferences: { environmentAffinity: { storm: -1 } },
    }, () => ({
      atMinute: minute,
      needs: needs.getSnapshot(),
      environment: environment.getCurrentSnapshot(),
    }));
    gameContext = createGameContextReadApi({
      getTime: () => ({
        day: 5,
        hour: Math.floor((minute % 1440) / 60),
        minute: minute % 60,
        totalMinutes: minute,
        timeOfDay: 'day',
        isWeekend: false,
      }),
      getCurrentEnvironment: (context) => environment.getCurrentSnapshot(context),
      getEnvironmentAt: (query) => environment.getSnapshot(query),
      getEnvironmentForecast: (query) => environment.getForecast(query),
      getNeeds: () => needs.getSnapshot(),
      getMood: () => mood.getCurrentSnapshot(),
    });

    world.triggerEventById('city_canal_festival', minute);
    const current = gameContext.environment.current();
    expect(current.weather.condition).toBe('storm');
    expect(current.sourceEventIds).toEqual(['city_canal_festival']);

    const phaser = projectEnvironmentPresentation(current);
    const audio = projectEnvironmentAudio(current);
    const projection = createWorldSceneProjection({
      placeId: 'place_b1',
      environment: current,
      minuteOfDay: minute % 1440,
      timeOfDay: 'day',
      isInterior: true,
    });

    expect(projection.environment).toEqual(current);
    expect(projection.weather).toBe(phaser.weather);
    expect(projection.windIntensity).toBe(phaser.windIntensity);
    expect(audio.precipitation).toBe(current.weather.precipitation);
    expect(audio.wind).toBe(current.weather.wind);
    expect(projection.spatialAudioSources?.find((source) =>
      source.eventId === 'ambience.weather.rain'
    )?.parameters?.rainIntensity).toBeCloseTo(audio.precipitation * 0.35);

    const firstMood = gameContext.player.mood();
    const secondMood = gameContext.player.mood();
    expect(secondMood).toEqual(firstMood);
    expect(firstMood.influences.filter((influence) =>
      influence.id === 'context:environment:preference'
    )).toHaveLength(1);
    expect(firstMood.influences.find((influence) =>
      influence.id === 'context:environment:preference'
    )?.sourceRef).toContain('event:city_canal_festival');

    const knowledge = buildInnerVoiceKnowledgeFromGameContext(gameContext, {
      visiblePlaceId: 'place_b1',
    });
    expect(knowledge.weatherHint).toContain('storm');
    expect(knowledge.moodHint).toContain(firstMood.band);
    expect(knowledge.moodHint).not.toContain(String(firstMood.value));

    minute += 121;
    const restored = gameContext.environment.current();
    expect(restored.weather.condition).not.toBe('storm');
    expect(restored.sourceEventIds).toEqual([]);
    const restoredMood = gameContext.player.mood();
    expect(restoredMood.influences.some((influence) =>
      influence.id === 'context:environment:preference'
    )).toBe(false);
  });
});
