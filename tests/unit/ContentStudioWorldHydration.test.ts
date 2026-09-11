import { describe, expect, it } from 'vitest';
import { tablesFromGenerated } from '../../src/tools/ContentInspector';

describe('Content Studio world hydration', () => {
  it('hydrates the generated world/transit contract into editable TinyBase-shaped tables', () => {
    const tables = tablesFromGenerated();

    expect(tables.districts?.district_a).toMatchObject({
      name: 'District A',
      mapX: 20,
      mapY: 60,
      tags: JSON.stringify(['residential']),
    });
    expect(tables.places?.place_a1).toMatchObject({
      districtId: 'district_a',
      name: 'Place A1',
      transitAccess: JSON.stringify([{ stopId: 'stop_a', walkMinutes: 4 }]),
    });
    expect(tables.transitStops?.stop_a).toMatchObject({
      districtId: 'district_a',
      placeId: 'place_a1',
    });
    expect(tables.busLines?.line_ab).toMatchObject({
      stopIds: JSON.stringify(['stop_a', 'stop_b']),
      segmentMinutes: JSON.stringify([12]),
      headwayMinutes: 20,
      fare: 2,
    });
    expect(tables.items?.item_a).toMatchObject({
      kind: 'food',
      portable: true,
      assetId: 'asset_a1',
      tags: JSON.stringify(['food', 'perishable']),
    });
    expect(tables.containers?.container_a).toMatchObject({
      capacity: 10,
      allowedItemKinds: JSON.stringify(['food']),
    });
    expect(tables.spaces?.space_a1?.placeId).toBe('place_a1');
    expect(tables.views?.view_a1).toMatchObject({
      spaceId: 'space_a1',
      neighbors: JSON.stringify(['view_a2']),
      assetId: 'asset_a1',
    });
    expect(tables.anchors?.anchor_a1?.viewId).toBe('view_a1');
    expect(tables.interactions?.interaction_a1?.anchorId).toBe('anchor_a1');
    expect(tables.assets?.asset_a1?.normalMapAssetId).toBe('asset_a1_n');
    expect(tables.lightProfiles?.light_a1).toBeDefined();
    expect(tables.audioProfiles?.audio_a1).toBeDefined();
    expect(tables.ambientProfiles?.ambient_a1).toBeDefined();
  });
});
