import { describe, expect, it } from 'vitest';
import type { WorldSceneProjection } from '../../src/world/phaser/types';
import type { Room104StoragePresence } from '../../src/engine/Room104Physical';
import { buildRoom104StorageMarkers } from '../../src/world/room104StoragePresentation';

const projection: WorldSceneProjection = {
  placeId: 'room_104',
  placeName: 'Motel Room 104',
  spaceId: 'room104_main',
  spaceName: 'Room 104',
  viewId: 'room104_desk_window',
  viewName: 'Desk & Window',
  assetId: null,
  normalMapAssetId: null,
  timeOfDay: 'day',
  weather: 'clear',
  lighting: { ambientColor: '#ffffff', ambientIntensity: 1, pointLights: [] },
  particles: { dustMotes: false, rain: false, density: 0 },
  anchors: [
    {
      id: 'room104_desk_storage',
      name: 'Desk Storage',
      x: 0.72,
      y: 0.72,
      tags: ['storage'],
      interactions: [],
    },
    {
      id: 'room104_pc',
      name: 'Computer Desk',
      x: 0.62,
      y: 0.61,
      tags: ['computer'],
      interactions: [],
    },
  ],
  availableViews: [],
};

const presence: Room104StoragePresence[] = [
  {
    target: 'desk',
    containerInstanceId: 'room104:desk-storage',
    itemCount: 2,
    itemInstanceIds: ['item-a', 'item-b'],
    itemDefinitionIds: ['book', 'cd'],
  },
  {
    target: 'wardrobe',
    containerInstanceId: 'room104:wardrobe',
    itemCount: 0,
    itemInstanceIds: [],
    itemDefinitionIds: [],
  },
  {
    target: 'bedside',
    containerInstanceId: 'room104:bedside-storage',
    itemCount: 0,
    itemInstanceIds: [],
    itemDefinitionIds: [],
  },
  {
    target: 'kitchen',
    containerInstanceId: 'room104:kitchen-storage',
    itemCount: 1,
    itemInstanceIds: ['item-c'],
    itemDefinitionIds: ['noodles_cup'],
  },
];

describe('Room 104 storage presentation (#26)', () => {
  it('projects only storage that is authored into the active view at its anchor coordinates', () => {
    expect(buildRoom104StorageMarkers(projection, presence)).toEqual([
      {
        target: 'desk',
        anchorId: 'room104_desk_storage',
        x: 0.72,
        y: 0.72,
        itemCount: 2,
        itemInstanceIds: ['item-a', 'item-b'],
        itemDefinitionIds: ['book', 'cd'],
      },
    ]);
  });

  it('keeps an empty active-view container spatially present while carrying a zero count', () => {
    const emptyDesk = presence.map((entry) =>
      entry.target === 'desk'
        ? { ...entry, itemCount: 0, itemInstanceIds: [], itemDefinitionIds: [] }
        : entry,
    );

    expect(buildRoom104StorageMarkers(projection, emptyDesk)[0]).toMatchObject({
      target: 'desk',
      anchorId: 'room104_desk_storage',
      itemCount: 0,
    });
  });
});
