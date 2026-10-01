import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { buildInnerVoiceKnowledgeFromGameContext } from '../../src/engine/innerVoice/GameContextKnowledge';
import { projectEnvironmentAudio } from '../../src/audio/environmentMapping';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

describe('living-world Environment composition gate (#29)', () => {
  it('runs an authored WorldEvent through Environment, Phaser/audio, Mood and Inner Voice, then expires cleanly', () => {
    const sim = new SimulationEngine();
    const startMinute = sim.clock.getTotalMinutes();
    const base = sim.gameContext.environment.current();

    sim.mood.setEnvironmentAffinity('storm', -1);
    const triggered = sim.world.triggerEventById('canal_storm_warning', startMinute);
    expect(triggered?.id).toBe('canal_storm_warning');

    const storm = sim.gameContext.environment.current();
    expect(storm.weather.condition).toBe('storm');
    expect(storm.sourceEventIds).toContain('canal_storm_warning');

    const now = sim.gameContext.time.current();
    const projection = createWorldSceneProjection({
      placeId: sim.getCurrentResidencePlaceId(),
      timeOfDay: now.timeOfDay,
      minuteOfDay: now.hour * 60 + now.minute,
      environment: storm,
      isInterior: true,
    });
    const audio = projectEnvironmentAudio(storm);

    expect(projection.environment).toEqual(storm);
    expect(projection.weather).toBe('rain');
    expect(projection.windIntensity).toBeCloseTo(storm.weather.wind);
    expect(audio.precipitation).toBeCloseTo(storm.weather.precipitation);
    expect(audio.wind).toBeCloseTo(storm.weather.wind);

    const moodFirst = sim.gameContext.player.mood();
    const moodAgain = sim.gameContext.player.mood();
    expect(moodAgain).toEqual(moodFirst);
    const stormInfluences = moodFirst.influences.filter(
      (influence) => influence.id === 'context:environment:preference',
    );
    expect(stormInfluences).toHaveLength(1);
    expect(stormInfluences[0]?.sourceRef).toContain('event:canal_storm_warning');

    const knowledge = buildInnerVoiceKnowledgeFromGameContext(sim.gameContext, {
      visiblePlaceId: sim.getCurrentResidencePlaceId(),
    });
    expect(knowledge.weatherHint).toContain('storm');
    expect(knowledge.moodHint).toContain(moodFirst.band);
    expect(knowledge.moodHint).not.toContain(String(moodFirst.value));

    sim.advanceGameMinutes(181, 'expire authored storm modifier');

    const restored = sim.gameContext.environment.current();
    expect(restored.sourceEventIds).not.toContain('canal_storm_warning');
    expect(restored.weather.condition).toBe(base.weather.condition);

    const restoredMood = sim.gameContext.player.mood();
    expect(restoredMood.influences.some(
      (influence) => influence.id === 'context:environment:preference',
    )).toBe(false);
  });
});
