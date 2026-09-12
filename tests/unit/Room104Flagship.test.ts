import { describe, expect, it } from 'vitest';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

const DESK_VIEW = 'room104_desk_window';
const BED_VIEW = 'room104_bed_wardrobe';
const ENTRY_VIEW = 'room104_entrance_kitchenette';

function capabilities(viewId: string): string[] {
  return createWorldSceneProjection({ placeId: 'room_104', viewId })
    .anchors
    .flatMap((anchor) => anchor.interactions.map((interaction) => interaction.capability));
}

describe('Room 104 flagship living-place contract (#26)', () => {
  it('authors three main views through the generic place projection layer', () => {
    const projection = createWorldSceneProjection({ placeId: 'room_104', viewId: DESK_VIEW });

    expect(projection.placeId).toBe('room_104');
    expect(projection.placeName).toBe('Motel Room 104');
    expect(projection.isInterior).toBe(true);
    expect(projection.availableViews.map((view) => view.id)).toEqual([
      DESK_VIEW,
      BED_VIEW,
      ENTRY_VIEW,
    ]);
  });

  it('keeps deterministic authored neighbor navigation between the three room views', () => {
    const desk = createWorldSceneProjection({ placeId: 'room_104', viewId: DESK_VIEW });
    const bed = createWorldSceneProjection({ placeId: 'room_104', viewId: BED_VIEW });
    const entry = createWorldSceneProjection({ placeId: 'room_104', viewId: ENTRY_VIEW });

    expect(desk.availableViews.find((view) => view.id === DESK_VIEW)?.neighbors).toEqual([BED_VIEW, ENTRY_VIEW]);
    expect(bed.availableViews.find((view) => view.id === BED_VIEW)?.neighbors).toEqual([DESK_VIEW, ENTRY_VIEW]);
    expect(entry.availableViews.find((view) => view.id === ENTRY_VIEW)?.neighbors).toEqual([DESK_VIEW, BED_VIEW]);
  });

  it('exposes physical semantic hotspots instead of a room action menu', () => {
    expect(capabilities(DESK_VIEW)).toEqual(expect.arrayContaining([
      'use_computer',
      'observe_window',
      'inspect_desk_storage',
    ]));

    expect(capabilities(BED_VIEW)).toEqual(expect.arrayContaining([
      'sleep',
      'open_wardrobe',
      'inspect_bedside_storage',
    ]));

    expect(capabilities(ENTRY_VIEW)).toEqual(expect.arrayContaining([
      'prepare_drink',
      'leave_room',
      'open_kitchen_storage',
      'inspect_delivery_anchor',
    ]));
  });

  it('keeps Room 104 weather presentation interior-scoped', () => {
    const rainy = createWorldSceneProjection({
      placeId: 'room_104',
      viewId: DESK_VIEW,
      weather: 'rain',
    });

    expect(rainy.isInterior).toBe(true);
    expect(rainy.weather).toBe('rain');
    expect(rainy.particles.rain).toBe(true);
  });
});
