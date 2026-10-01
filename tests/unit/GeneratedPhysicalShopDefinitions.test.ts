import { describe, expect, it } from 'vitest';
import {
  GENERATED_ANCHORS,
  GENERATED_SCENE_PROPS,
  GENERATED_SHOP_FIXTURES,
  GENERATED_SHOP_SLOTS,
  GENERATED_VIEWS,
} from '../../src/engine/worldContent.generated';
import {
  getGeneratedPhysicalShop,
  getGeneratedShopFixtureAtAnchor,
  projectGeneratedPhysicalShopFocus,
} from '../../src/engine/GeneratedPhysicalShopDefinitions';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { resolveCharacterPresence } from '../../src/engine/life/Presence';

describe('CornerMart authored one-view composition (#28)', () => {
  it('authors one hero view with shelf, fridge, cashier and exit hotspots', () => {
    const views = GENERATED_VIEWS.filter((view) => view.spaceId === 'space_b1');
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      id: 'view_b1',
      name: 'CornerMart Hero',
      assetId: 'corner_mart_hero',
    });

    const anchorIds = new Set(
      GENERATED_ANCHORS.filter((anchor) => anchor.viewId === 'view_b1').map((anchor) => anchor.id),
    );
    for (const id of [
      'corner_mart_shelf_left',
      'corner_mart_shelf_center',
      'corner_mart_fridge',
      'fixture_shop_staff_anchor',
      'corner_mart_door',
    ]) {
      expect(anchorIds.has(id), id).toBe(true);
    }
  });

  it('maps authored shop slots into existing PhysicalShopEngine contracts without scene-owned stock', () => {
    const shop = getGeneratedPhysicalShop('place_b1');
    expect(shop.fixtures.map((fixture) => fixture.id).sort()).toEqual(
      GENERATED_SHOP_FIXTURES.filter((fixture) => fixture.placeId === 'place_b1')
        .map((fixture) => fixture.id)
        .sort(),
    );
    expect(shop.fixtures.flatMap((fixture) => fixture.slots)).toHaveLength(GENERATED_SHOP_SLOTS.length);
    expect(shop.pricesByDefinitionId['corner-mart:noodles_cup']).toBeGreaterThan(0);
  });

  it('focuses the same hero view over the exact persisted current stock', () => {
    const sim = new SimulationEngine();
    const shop = getGeneratedPhysicalShop('place_b1');
    const state = sim.getPhysicalShopState(shop.storeId, 'issue-28-world', shop.fixtures);
    const focus = projectGeneratedPhysicalShopFocus('place_b1', 'corner_mart_fridge', state);

    expect(focus.viewId).toBe('view_b1');
    expect(focus.kind).toBe('fridge');
    expect(focus.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotId: 'corner_mart_fridge_a' }),
      expect.objectContaining({ slotId: 'corner_mart_fridge_b' }),
    ]));
    expect(focus.environment.audioProfileIds).toContain('corner_mart_fridge_audio');
  });

  it('authors an independently moving ceiling prop rather than a second main view', () => {
    expect(GENERATED_SCENE_PROPS).toContainEqual(expect.objectContaining({
      id: 'corner_mart_fan_prop',
      viewId: 'view_b1',
      anchorId: 'corner_mart_fan',
      motionType: 'rotation',
    }));
  });

  it('marks cashier interaction as in-person only when player and NPC are co-located', () => {
    expect(getGeneratedShopFixtureAtAnchor('fixture_shop_staff_anchor')).toBe('corner_mart_cashier_counter');

    const coLocated = resolveCharacterPresence({
      actorId: 'cashier_actor',
      place: { status: 'at_place', placeId: 'place_b1' },
      legacyPresence: { status: 'online', awayMessage: '' },
      reach: 'local',
      playerPlaceId: 'place_b1',
      messagingDeviceContext: 'none',
    });
    expect(coLocated.availability.canInteractInPerson).toBe(true);

    const elsewhere = resolveCharacterPresence({
      actorId: 'cashier_actor',
      place: { status: 'at_place', placeId: 'place_b1' },
      legacyPresence: { status: 'online', awayMessage: '' },
      reach: 'local',
      playerPlaceId: 'place_a1',
      messagingDeviceContext: 'none',
    });
    expect(elsewhere.availability.canInteractInPerson).toBe(false);
  });
});
