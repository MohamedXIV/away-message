import { describe, expect, it } from 'vitest';
import { getRoom104WorldAnchorPresence } from '../../src/engine/Room104Physical';
import type { PhysicalWorldState } from '../../src/engine/PhysicalItemEngine';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';
import { buildRoom104WorldAnchorMarkers } from '../../src/world/room104WorldAnchorPresentation';

const parcelState: PhysicalWorldState = {
  containers: {
    'parcel:order-1': {
      instanceId: 'parcel:order-1',
      definitionId: 'delivery_parcel',
    },
  },
  items: {
    'parcel:order-1': {
      instanceId: 'parcel:order-1',
      definitionId: 'delivery_parcel',
      location: { kind: 'worldAnchor', anchorId: 'room104:delivery' },
    },
  },
};

describe('Room 104 world-anchor presentation (#26)', () => {
  it('derives exact delivered item identities from canonical world-anchor state', () => {
    expect(getRoom104WorldAnchorPresence(parcelState)).toEqual([
      {
        physicalAnchorId: 'room104:delivery',
        itemCount: 1,
        itemInstanceIds: ['parcel:order-1'],
        itemDefinitionIds: ['delivery_parcel'],
      },
    ]);
  });

  it('maps delivery presence only onto the authored delivery anchor in the active view', () => {
    const entryProjection = createWorldSceneProjection({
      placeId: 'room_104',
      viewId: 'room104_entrance_kitchenette',
    });
    expect(buildRoom104WorldAnchorMarkers(entryProjection, getRoom104WorldAnchorPresence(parcelState))).toEqual([
      {
        physicalAnchorId: 'room104:delivery',
        authoredAnchorId: 'room104_delivery_anchor',
        x: 0.34,
        y: 0.73,
        itemCount: 1,
        itemInstanceIds: ['parcel:order-1'],
        itemDefinitionIds: ['delivery_parcel'],
      },
    ]);

    const deskProjection = createWorldSceneProjection({
      placeId: 'room_104',
      viewId: 'room104_desk_window',
    });
    expect(buildRoom104WorldAnchorMarkers(deskProjection, getRoom104WorldAnchorPresence(parcelState))).toEqual([]);
  });

  it('stops presenting an item after canonical state moves it away from the world anchor', () => {
    const moved: PhysicalWorldState = {
      ...parcelState,
      containers: {
        ...parcelState.containers,
        player_inventory: {
          instanceId: 'player_inventory',
          definitionId: 'player_inventory',
        },
      },
      items: {
        ...parcelState.items,
        'parcel:order-1': {
          ...parcelState.items['parcel:order-1']!,
          location: { kind: 'container', containerInstanceId: 'player_inventory' },
        },
      },
    };

    expect(getRoom104WorldAnchorPresence(moved)).toEqual([]);
  });
});
