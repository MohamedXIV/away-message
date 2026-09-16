// tests/unit/ResidenceAuthorityAndPhysicalInteraction.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { PhysicalInteractionEngine, type InstalledObject } from '../../src/engine/PhysicalInteractionEngine';

describe('Residence Authority and Contextual Physical-Interaction Resolution (#86)', () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
  });

  it('1. resolves current home to currentResidencePlaceId', () => {
    expect(engine.residence.getCurrentResidencePlaceId()).toBe('room_104');
    expect(engine.getState().residence.currentResidencePlaceId).toBe('room_104');
  });

  it('2. changing current residence changes the home root without changing canonical Place identity', () => {
    const previousPlaceId = engine.residence.getCurrentResidencePlaceId();
    engine.residence.setResidence({
      currentResidencePlaceId: 'apartment_2b',
      tenancyId: 'tenancy_apt_2b_01',
      currentRent: 220,
    });

    expect(engine.residence.getCurrentResidencePlaceId()).toBe('apartment_2b');
    expect(engine.getState().residence.currentResidencePlaceId).toBe('apartment_2b');
    expect(previousPlaceId).toBe('room_104');
  });

  it('3. no core consumer requires a specific residence/place ID', () => {
    engine.residence.setResidence({
      currentResidencePlaceId: 'studio_loft_9',
      tenancyId: 'tenancy_studio_9',
    });

    // Travel home when away from home resolves current residence place
    engine.economy.setLocation('cafe');
    const travelRes = engine.dispatchAction({ type: 'TRAVEL_TO', to: 'home', mode: 'walk' });
    expect(travelRes.success).toBe(true);
    expect(engine.economy.getLocation()).toBe('home');
    expect(engine.residence.getCurrentResidencePlaceId()).toBe('studio_loft_9');
  });

  it('4. legitimate location-wide policy such as delivery acceptance remains Place-level', () => {
    const interactions = new PhysicalInteractionEngine();

    // Default place permits delivery
    expect(interactions.getPlacePolicy('room_104').canReceiveDelivery).toBe(true);

    // Set custom Place policy restricting delivery
    interactions.setPlacePolicy({
      placeId: 'secure_vault',
      canReceiveDelivery: false,
    });

    expect(interactions.getPlacePolicy('secure_vault').canReceiveDelivery).toBe(false);
  });

  it('5. a compatible object can be installed in a slot and may expose a nested slot', () => {
    const interactions = new PhysicalInteractionEngine();

    const deskObject: InstalledObject = {
      instanceId: 'obj_workbench_desk',
      definitionId: 'desk_heavy',
      name: 'Workbench Desk',
      placeId: 'studio_loft_9',
      spaceId: 'space_main',
      anchorId: 'anchor_desk_slot',
      owner: 'player',
      affordances: ['use_workbench'],
      toolCapabilities: ['soldering_surface'],
      providedResources: [],
      nestedSlots: ['slot_desk_drawer_left', 'slot_desk_drawer_right'],
    };

    interactions.installObject(deskObject);

    const installed = interactions.getInstalledObjects('studio_loft_9');
    expect(installed).toHaveLength(1);
    expect(installed[0]?.instanceId).toBe('obj_workbench_desk');
    expect(installed[0]?.nestedSlots).toEqual(['slot_desk_drawer_left', 'slot_desk_drawer_right']);
  });

  it('6. an accessible object exposes its direct affordance without a duplicate Place.canX flag', () => {
    const interactions = new PhysicalInteractionEngine();

    const bathTub: InstalledObject = {
      instanceId: 'obj_luxury_tub',
      definitionId: 'bathtub_porcelain',
      name: 'Bathtub',
      placeId: 'apartment_2b',
      spaceId: 'space_bathroom',
      anchorId: 'anchor_tub',
      owner: 'landlord',
      affordances: ['bathe', 'soak'],
      toolCapabilities: [],
      providedResources: ['water'],
    };

    interactions.installObject(bathTub);

    expect(interactions.getDirectAffordances('apartment_2b')).toEqual(expect.arrayContaining(['bathe', 'soak']));
    expect(interactions.hasDirectAffordance('apartment_2b', 'bathe')).toBe(true);
  });

  it('7. removing or moving an object removes or moves its affordance without changing Place definition', () => {
    const interactions = new PhysicalInteractionEngine();

    const tvObj: InstalledObject = {
      instanceId: 'obj_crt_tv',
      definitionId: 'tv_crt_20',
      name: 'CRT Television',
      placeId: 'room_104',
      spaceId: 'room104_main',
      anchorId: 'room104_desk_storage',
      owner: 'player',
      affordances: ['watch_tv'],
      toolCapabilities: [],
      providedResources: [],
    };

    interactions.installObject(tvObj);
    expect(interactions.hasDirectAffordance('room_104', 'watch_tv')).toBe(true);

    // Move object to another place
    interactions.moveObject('obj_crt_tv', 'apartment_2b', 'space_main', 'anchor_stand');
    expect(interactions.hasDirectAffordance('room_104', 'watch_tv')).toBe(false);
    expect(interactions.hasDirectAffordance('apartment_2b', 'watch_tv')).toBe(true);

    // Remove object completely
    interactions.removeObject('obj_crt_tv');
    expect(interactions.hasDirectAffordance('apartment_2b', 'watch_tv')).toBe(false);
  });

  it('8. a composed recipe/action can combine a player-carried item with a local tool/resource provider', () => {
    const interactions = new PhysicalInteractionEngine();

    interactions.installObject({
      instanceId: 'obj_kettle',
      definitionId: 'kettle_electric',
      name: 'Electric Kettle',
      placeId: 'room_104',
      spaceId: 'room104_main',
      anchorId: 'room104_kettle',
      owner: 'landlord',
      affordances: ['boil_water'],
      toolCapabilities: ['water_heating'],
      providedResources: ['water'],
    });

    const playerCarriedItems = [
      { instanceId: 'noodles_item_1', definitionId: 'spicy_noodle_cup', kind: 'noodles' },
    ];

    const result = interactions.resolveComposedRequirements(
      {
        placeId: 'room_104',
        playerInventoryItems: playerCarriedItems,
      },
      {
        itemKindsOrTags: ['noodles'],
        requiredTools: ['water_heating'],
        requiredResources: ['water'],
      },
    );

    expect(result.satisfied).toBe(true);
    expect(result.matchedItem?.source).toBe('player_inventory');
    expect(result.matchedTools).toContain('water_heating');
    expect(result.matchedResources).toContain('water');
  });

  it('9. the same recipe/action can source an item from an accessible local container', () => {
    const interactions = new PhysicalInteractionEngine();

    interactions.installObject({
      instanceId: 'obj_stove',
      definitionId: 'gas_stove',
      name: 'Gas Stove',
      placeId: 'apartment_2b',
      spaceId: 'kitchen_space',
      anchorId: 'stove_anchor',
      owner: 'landlord',
      affordances: ['cook'],
      toolCapabilities: ['water_heating'],
      providedResources: ['water'],
    });

    const accessibleContainers = {
      pantry_cabinet_1: [
        { instanceId: 'stored_noodle_pack', definitionId: 'instant_ramen', kind: 'noodles' },
      ],
    };

    const result = interactions.resolveComposedRequirements(
      {
        placeId: 'apartment_2b',
        playerInventoryItems: [], // No items in inventory
        accessibleContainers,
      },
      {
        itemKindsOrTags: ['noodles'],
        requiredTools: ['water_heating'],
        requiredResources: ['water'],
      },
    );

    expect(result.satisfied).toBe(true);
    expect(result.matchedItem?.source).toBe('local_container');
    expect(result.matchedItem?.containerInstanceId).toBe('pantry_cabinet_1');
  });

  it('10. missing composed requirements fail cleanly instead of inventing a Place-level capability', () => {
    const interactions = new PhysicalInteractionEngine();

    // Place has no kettle or stove installed
    const result = interactions.resolveComposedRequirements(
      {
        placeId: 'empty_hallway',
        playerInventoryItems: [
          { instanceId: 'ramen_1', definitionId: 'ramen', kind: 'noodles' },
        ],
      },
      {
        itemKindsOrTags: ['noodles'],
        requiredTools: ['water_heating'],
        requiredResources: ['water'],
      },
    );

    expect(result.satisfied).toBe(false);
    expect(result.missingTools).toContain('water_heating');
    expect(result.missingResources).toContain('water');
  });

  it('11. delivery requires the appropriate Place policy and resolves the concrete route/target', () => {
    const interactions = new PhysicalInteractionEngine();

    // Place allowing delivery with anchor
    interactions.setPlacePolicy({
      placeId: 'motel_lobby',
      canReceiveDelivery: true,
      acceptedDeliveryTags: ['reception', 'delivery'],
    });
    interactions.installObject({
      instanceId: 'obj_reception_desk',
      definitionId: 'reception_counter',
      name: 'Reception Counter',
      placeId: 'motel_lobby',
      spaceId: 'lobby_main',
      anchorId: 'reception_delivery_slot',
      owner: 'landlord',
      affordances: ['reception', 'delivery'],
      toolCapabilities: [],
      providedResources: [],
    });

    const successRes = interactions.resolveDeliveryTarget('motel_lobby');
    expect(successRes.ok).toBe(true);
    expect(successRes.targetAnchorId).toBe('reception_delivery_slot');

    // Place disallowing delivery
    interactions.setPlacePolicy({
      placeId: 'restricted_area',
      canReceiveDelivery: false,
    });

    const failRes = interactions.resolveDeliveryTarget('restricted_area');
    expect(failRes.ok).toBe(false);
    expect(failRes.error).toContain('does not permit deliveries');
  });

  it('12. a bathtub/shower path proves Bathe/Shower comes from the object itself rather than place.canBathe', () => {
    const currentHomePlace = engine.residence.getCurrentResidencePlaceId();

    // Check default room_104 has shower installed
    expect(engine.physicalInteractions.hasDirectAffordance(currentHomePlace, 'shower')).toBe(true);

    // Remove shower unit object
    engine.physicalInteractions.removeObject('obj_room104_shower');

    expect(engine.physicalInteractions.hasDirectAffordance(currentHomePlace, 'shower')).toBe(false);

    // Attempting shower interaction now fails because object is missing from graph
    const res = engine.dispatchAction({ type: 'PLAYER_INTERACT_ROOM', activity: 'shower' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('No shower or bathtub installed');
  });

  it('13. shared facilities use the same object/policy/context rules outside the home context', () => {
    // Motel shared bathroom
    const bathObj = engine.physicalInteractions.getAccessibleObjectWithAffordance('motel_bathroom', 'bathe');
    expect(bathObj).toBeDefined();
    expect(bathObj?.instanceId).toBe('obj_shared_motel_bath');
    expect(bathObj?.owner).toBe('landlord');
  });

  it('14. clean new-game state works and exports/restores cleanly', () => {
    const snapshot = engine.exportSnapshot();
    expect(snapshot.residence).toBeDefined();
    expect(snapshot.residence.currentResidencePlaceId).toBe('room_104');

    const freshEngine = new SimulationEngine(snapshot);
    expect(freshEngine.residence.getCurrentResidencePlaceId()).toBe('room_104');
  });
});
