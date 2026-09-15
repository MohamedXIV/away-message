// tests/unit/Room104Content.test.ts
// #82 — Room 104 canonical content proof. Room 104 must come from the
// canonical content pipeline (content/store.json -> generated registries),
// never from a handwritten bridge: place room_104 with the legacy home
// alias, one main space, three views with the flagship neighbor graph,
// anchors/interactions carrying the flagship capabilities, and the four
// storage container definitions owned by this lane (instances belong to #80).

import { describe, expect, it } from 'vitest';
import {
  GENERATED_ANCHORS,
  GENERATED_CONTAINERS,
  GENERATED_INTERACTIONS,
  GENERATED_PLACES,
  GENERATED_SPACES,
  GENERATED_VIEWS,
} from '../../src/engine/worldContent.generated';
import {
  getSharedPlaceAliases,
  getSharedTransitNetwork,
  resolveTransitPlaceId,
} from '../../src/engine/transit/NpcTrips';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

const DESK_VIEW = 'room104_desk_window';
const BED_VIEW = 'room104_bed_wardrobe';
const ENTRY_VIEW = 'room104_entrance_kitchenette';

function capabilities(viewId: string): string[] {
  return createWorldSceneProjection({ placeId: 'room_104', viewId })
    .anchors
    .flatMap((anchor) => anchor.interactions.map((interaction) => interaction.capability));
}

describe('Room 104 canonical content (#82)', () => {
  it('1. generates the room_104 place with the legacy home alias', () => {
    const place = GENERATED_PLACES.find((p) => p.id === 'room_104');
    expect(place).toBeDefined();
    expect(place!.name).toBe('Motel Room 104');
    expect(place!.districtId).toBe('district_a');
    expect(place!.legacyIds ?? []).toContain('home');
    expect(place!.transitAccess).toEqual([]);
  });

  it('2. generates the Room 104 space/view/anchor/interaction contract', () => {
    const spaces = GENERATED_SPACES.filter((s) => s.placeId === 'room_104');
    expect(spaces.map((s) => s.id)).toEqual(['room104_main']);

    const spaceIds = new Set(spaces.map((s) => s.id));
    const views = GENERATED_VIEWS.filter((v) => spaceIds.has(v.spaceId));
    expect(views.map((v) => v.id).sort()).toEqual([BED_VIEW, DESK_VIEW, ENTRY_VIEW].sort());
    for (const view of views) {
      expect(view.assetId).toBeNull();
    }

    const viewIds = new Set(views.map((v) => v.id));
    const anchors = GENERATED_ANCHORS.filter((a) => viewIds.has(a.viewId));
    expect(anchors.length).toBeGreaterThanOrEqual(10);
    for (const anchor of anchors) {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.x).toBeLessThanOrEqual(1);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeLessThanOrEqual(1);
    }

    const anchorIds = new Set(anchors.map((a) => a.id));
    const interactions = GENERATED_INTERACTIONS.filter((i) => anchorIds.has(i.anchorId));
    expect(interactions.length).toBeGreaterThanOrEqual(10);
    for (const interaction of interactions) {
      expect(interaction.capability).toBeTruthy();
    }
  });

  it('3. preserves the flagship neighbor graph and per-view capabilities', () => {
    const desk = createWorldSceneProjection({ placeId: 'room_104', viewId: DESK_VIEW });
    expect(desk.placeId).toBe('room_104');
    expect(desk.placeName).toBe('Motel Room 104');
    expect(desk.isInterior).toBe(true);
    // Set-compared on purpose: generated registries emit in deterministic
    // alphabetical id order (bed, desk, entry); the flagship runtime selects
    // views by explicit id/neighbor links, never by list position.
    expect(desk.availableViews.map((view) => view.id).sort()).toEqual([BED_VIEW, DESK_VIEW, ENTRY_VIEW].sort());

    const bed = createWorldSceneProjection({ placeId: 'room_104', viewId: BED_VIEW });
    const entry = createWorldSceneProjection({ placeId: 'room_104', viewId: ENTRY_VIEW });
    expect(desk.availableViews.find((view) => view.id === DESK_VIEW)?.neighbors).toEqual([BED_VIEW, ENTRY_VIEW]);
    expect(bed.availableViews.find((view) => view.id === BED_VIEW)?.neighbors).toEqual([DESK_VIEW, ENTRY_VIEW]);
    expect(entry.availableViews.find((view) => view.id === ENTRY_VIEW)?.neighbors).toEqual([DESK_VIEW, BED_VIEW]);

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

  it('4. exposes home -> room_104 from generated authored content', () => {
    expect(getSharedPlaceAliases()['home']).toBe('room_104');
  });

  it('5. resolves home to room_104 through the existing resolver with no hardcode', () => {
    const network = getSharedTransitNetwork();
    expect(network).not.toBeNull();
    expect(resolveTransitPlaceId('home', network!, getSharedPlaceAliases())).toBe('room_104');
  });

  it('6. authors the four Room 104 storage container definitions (no instances)', () => {
    const byId = new Map(GENERATED_CONTAINERS.map((c) => [c.id, c]));
    expect(byId.get('room104_storage_desk')).toMatchObject({ capacity: 12, allowedItemKinds: [] });
    expect(byId.get('room104_storage_wardrobe')).toMatchObject({ capacity: 24, allowedItemKinds: [] });
    expect(byId.get('room104_storage_bedside')).toMatchObject({ capacity: 8, allowedItemKinds: [] });
    expect(byId.get('room104_storage_kitchen')).toMatchObject({ capacity: 24, allowedItemKinds: [] });
  });
});
