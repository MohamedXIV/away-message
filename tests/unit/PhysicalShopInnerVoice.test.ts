import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { requestPhysicalShopArrivalThought } from '../../src/engine/PhysicalShopInnerVoice';

describe('physical shop Inner Voice integration (#28)', () => {
  it('queues one visible-place arrival observation and suppresses immediate repetition', () => {
    const simulation = new SimulationEngine();

    const first = requestPhysicalShopArrivalThought(simulation, {
      placeId: 'place_b1',
      placeName: 'CornerMart',
      timeOfDay: 'day',
      weather: 'clear',
      nowMinute: 720,
    });
    const repeated = requestPhysicalShopArrivalThought(simulation, {
      placeId: 'place_b1',
      placeName: 'CornerMart',
      timeOfDay: 'day',
      weather: 'clear',
      nowMinute: 721,
    });

    expect(first).toMatchObject({
      source: 'world:physical_shop',
      knowledgeRefs: ['visible:place:place_b1'],
      cooldownKey: 'physical_shop_arrival:place_b1',
      presentation: 'ambient',
    });
    expect(repeated).toBeNull();
  });

  it('uses canonical Game Context weather rather than observation weather as alternate truth', () => {
    const simulation = new SimulationEngine();
    // Day 2 is deterministic rain in the canonical Environment base provider.
    simulation.advanceGameMinutes(1440);
    const nowMinute = simulation.clock.getTotalMinutes();
    expect(simulation.gameContext.environment.current().weather.condition).toBe('rain');

    const thought = requestPhysicalShopArrivalThought(simulation, {
      placeId: 'place_b1',
      placeName: 'CornerMart',
      timeOfDay: 'day',
      // Deliberately stale/presentation input: canonical Game Context must win.
      weather: 'clear',
      nowMinute,
    });

    expect(thought?.knowledgeRefs).toEqual([
      'visible:place:place_b1',
      'visible:weather:rain',
    ]);
    expect(thought?.semanticMeaning).toContain('Rain');
  });
});
