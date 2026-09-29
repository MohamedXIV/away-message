import { describe, expect, it } from 'vitest';
import { createGeneratedPhysicalShopProjection } from '../../src/world/phaser/GeneratedPhysicalShopPresentation';

describe('generated physical shop presentation (#28)', () => {
  it('keeps CornerMart on one authored hero view while focus changes only camera projection', () => {
    const hero = createGeneratedPhysicalShopProjection('place_b1', {
      actorByAnchorId: { fixture_shop_staff_anchor: 'corner_mart_cashier' },
    });
    const fridge = createGeneratedPhysicalShopProjection('place_b1', {
      focusFixtureId: 'corner_mart_fridge',
    });

    expect(hero.viewId).toBe('view_b1');
    expect(hero.availableViews).toHaveLength(1);
    expect(hero.focus).toBeNull();
    expect(hero.anchors.find((anchor) => anchor.id === 'fixture_shop_staff_anchor')?.actorId)
      .toBe('corner_mart_cashier');
    expect(fridge.viewId).toBe('view_b1');
    expect(fridge.focus).toMatchObject({ zoom: 1.75 });
  });

  it('projects authored fluorescent/fridge lighting, compressor audio and moving fan prop', () => {
    const projection = createGeneratedPhysicalShopProjection('place_b1');

    expect(projection.authoredLights?.some((light) => light.flicker?.type === 'fluorescent')).toBe(true);
    expect(projection.authoredLights?.some((light) => light.kind === 'fridge')).toBe(true);
    expect(projection.spatialAudioSources?.some((source) => source.eventId.includes('fridge'))).toBe(true);
    expect(projection.sceneProps).toContainEqual(expect.objectContaining({
      id: 'corner_mart_fan_prop',
      assetId: 'corner_mart_fan',
    }));
    expect(projection.ambientMotions).toContainEqual(expect.objectContaining({
      targetName: 'corner_mart_fan_prop',
      type: 'rotation',
    }));
    expect(projection.weatherWindowZones).toEqual([
      expect.objectContaining({
        id: 'corner_mart_window_prop',
        width: 0.055,
        height: 0.333,
      }),
    ]);
  });

  it('preserves generic day/weather environment truth for manual clear/rain phase smoke tests', () => {
    const morning = createGeneratedPhysicalShopProjection('place_b1', {
      timeOfDay: 'morning',
      weather: 'clear',
    });
    const rainyNight = createGeneratedPhysicalShopProjection('place_b1', {
      timeOfDay: 'night',
      weather: 'rain',
    });

    expect(morning.timeOfDay).toBe('morning');
    expect(morning.minuteOfDay).not.toBe(rainyNight.minuteOfDay);
    expect(morning.weather).toBe('clear');
    expect(rainyNight.timeOfDay).toBe('night');
    expect(rainyNight.weather).toBe('rain');
    expect(rainyNight.spatialAudioSources?.some((source) => source.eventId.includes('rain'))).toBe(true);
    expect(rainyNight.isInterior).toBe(true);
  });
});
