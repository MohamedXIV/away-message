import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

describe('living-world residence integration (#29)', () => {
  it('owns current home through persisted ResidenceTenancy instead of a UI alias', () => {
    const sim = new SimulationEngine();
    const residence = sim.getResidenceState();

    expect(residence.currentResidencePlaceId).toBe(sim.getCurrentResidencePlaceId());
    expect(residence.tenancyId).toBeTruthy();

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    expect(restored.getResidenceState()).toEqual(residence);
  });

  it('projects the canonical residence as authored Phaser views with semantic interactions', () => {
    const sim = new SimulationEngine();
    const projection = createWorldSceneProjection({
      placeId: sim.getCurrentResidencePlaceId(),
      environment: sim.gameContext.environment.current(),
      timeOfDay: sim.gameContext.time.current().timeOfDay,
    });

    expect(projection.placeId).toBe(sim.getCurrentResidencePlaceId());
    expect(projection.availableViews.length).toBeGreaterThan(1);
    expect(projection.anchors.flatMap((anchor) => anchor.interactions).map((i) => i.capability))
      .toEqual(expect.arrayContaining(['sleep']));
  });

  it('keeps semantic home delivery resolution on the current tenancy when local XYZ is absent', () => {
    const sim = new SimulationEngine();
    expect(sim.getActorSpatialProjection('player')).toBeNull();
    expect(sim.getCurrentResidencePlaceId()).toBe(sim.getResidenceState().currentResidencePlaceId);
  });
});

describe('living-world housing choice and move gate (#29)', () => {
  it('starts from an authored choice and moves to a better authored residence without resetting identity/state', () => {
    const sim = new SimulationEngine({ starterHousingOfferId: 'starter_room_208' } as any);
    expect(sim.getCurrentResidencePlaceId()).toBe('room_208');
    expect(sim.economy.getCash()).toBe(20);
    expect(sim.getResidenceState().currentRent).toBe(125);

    const buddiesBefore = sim.social.getBuddies().map((buddy) => buddy.id);
    const needsBefore = sim.needs.getState();
    const hardwareBefore = sim.hardware.getState();
    const preparedOwnedItem = sim.inventory.preparePurchase(
      'housing-gate-owned-item',
      [{ catalogItemId: 'chassis_scrapyard_beige_atx', quantity: 1 }],
      { chassis_scrapyard_beige_atx: 'hardware' },
    );
    sim.inventory.commitPurchase(preparedOwnedItem);
    sim.loadSnapshot(sim.exportSnapshot());

    const inventoryBefore = sim.inventory.getState();
    const objectsBefore = sim.getPhysicalObjectState();
    const ownedItemId = preparedOwnedItem.items[0]!.instanceId;
    expect(sim.getPhysicalWorldState().items[ownedItemId]?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room208_delivery',
    });

    const initialProjection = createWorldSceneProjection({
      placeId: sim.getCurrentResidencePlaceId(),
      timeOfDay: sim.gameContext.time.current().timeOfDay,
      environment: sim.gameContext.environment.current(),
      isInterior: true,
    });
    expect(initialProjection.placeId).toBe('room_208');
    expect(initialProjection.viewId).toBe('room208_main_view');

    sim.economy.earnCash(200, 'housing gate setup');
    expect(sim.moveResidenceToOffer('better_room_305')).toEqual({ success: true });

    expect(sim.getCurrentResidencePlaceId()).toBe('room_305');
    expect(sim.getResidenceState().currentRent).toBe(185);
    expect(sim.economy.getState().recurringRentAmount).toBe(185);
    expect(sim.economy.getCash()).toBe(130);
    expect(sim.social.getBuddies().map((buddy) => buddy.id)).toEqual(buddiesBefore);
    expect(sim.needs.getState()).toEqual(needsBefore);
    expect(sim.hardware.getState()).toEqual(hardwareBefore);
    expect(sim.inventory.getState()).toEqual(inventoryBefore);
    expect(sim.getPhysicalObjectState()).toEqual(objectsBefore);
    expect(sim.getPhysicalWorldState().items[ownedItemId]?.location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room305_delivery',
    });

    const movedProjection = createWorldSceneProjection({
      placeId: sim.getCurrentResidencePlaceId(),
      timeOfDay: sim.gameContext.time.current().timeOfDay,
      environment: sim.gameContext.environment.current(),
      isInterior: true,
    });
    expect(movedProjection.placeId).toBe('room_305');
    expect(movedProjection.viewId).toBe('room305_main_view');
  });
});
