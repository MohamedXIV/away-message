import type { ContentTables } from '../../src/tools/content/codegen';

/**
 * Shared neutral contract fixtures for #51 world-content slices.
 * Not production town content: District A / Place A1 / Stop A,
 * District B / Place B1 / Stop B, Bus Line stop_a → stop_b.
 * Slice tests compose on validTownTables() and add their own tables.
 */
export function validTownTables(): ContentTables {
  return {
    // Minimal character-domain scaffold: validateContent requires at least
    // one archetype, and the live store always carries both domains.
    archetypes: {
      regular: {
        label: 'Regular',
        description: 'Town fixture scaffold.',
        personaHint: 'Steady.',
        vocabulary: '[]',
        defaultInterests: '[]',
        defaultSong: '',
        typingSpeedWpm: 70,
      },
    },
    districts: {
      district_a: { name: 'District A', mapX: 20, mapY: 60, tags: '["residential"]' },
      district_b: { name: 'District B', mapX: 80, mapY: 40, tags: '["downtown"]' },
    },
    places: {
      place_a1: {
        districtId: 'district_a',
        name: 'Place A1',
        transitAccess: JSON.stringify([{ stopId: 'stop_a', walkMinutes: 4 }]),
      },
      place_b1: {
        districtId: 'district_b',
        name: 'Place B1',
        transitAccess: JSON.stringify([{ stopId: 'stop_b', walkMinutes: 5 }]),
      },
    },
    transitStops: {
      stop_a: { districtId: 'district_a', name: 'Stop A', placeId: 'place_a1', mapX: 22, mapY: 58 },
      stop_b: { districtId: 'district_b', name: 'Stop B', placeId: 'place_b1', mapX: 78, mapY: 42 },
    },
    busLines: {
      line_ab: {
        name: 'Line AB',
        stopIds: JSON.stringify(['stop_a', 'stop_b']),
        serviceStartMinute: 360,
        serviceEndMinute: 1380,
        headwayMinutes: 20,
        segmentMinutes: JSON.stringify([12]),
        fare: 2,
      },
    },
  };
}

export function cloneTables(tables: ContentTables): ContentTables {
  return JSON.parse(JSON.stringify(tables));
}

/** Slice-5 composition: asset_a1 (image + normal sibling) linked from item_a/view_a1. */
export function validAssetTables(): ContentTables {
  const base = validAnchorTables();
  const items = { ...(base['items'] as Record<string, Record<string, unknown>> | undefined) };
  const views = { ...(base['views'] as Record<string, Record<string, unknown>>) };
  if (items['item_a']) {
    items['item_a'] = { ...items['item_a'], assetId: 'asset_a1' };
  } else {
    items['item_a'] = {
      name: 'Item A',
      kind: 'food',
      portable: true,
      volume: 1,
      assetId: 'asset_a1',
      tags: '["food","perishable"]',
    };
  }
  if (!base['containers']) {
    (base as Record<string, unknown>)['containers'] = {
      container_a: { name: 'Container A', capacity: 10, allowedItemKinds: '["food"]', tags: '["storage"]' },
    };
  }
  views['view_a1'] = { ...views['view_a1'], assetId: 'asset_a1' };
  return {
    ...base,
    items,
    views,
    assets: {
      asset_a1: {
        name: 'Asset A1',
        kind: 'image',
        uri: 'assets/world/a1.png',
        normalMapAssetId: 'asset_a1_n',
        tags: '[]',
      },
      asset_a1_n: {
        name: 'Asset A1 Normal',
        kind: 'image',
        uri: 'assets/world/a1_n.png',
        normalMapAssetId: '',
        tags: '[]',
      },
    },
  };
}

/** Slice-4 composition: anchor_a1 in view_a1 with one inspect interaction. */
export function validAnchorTables(): ContentTables {
  return {
    ...validSpaceTables(),
    anchors: {
      anchor_a1: {
        viewId: 'view_a1',
        name: 'Anchor A1',
        x: 0.5,
        y: 0.5,
        tags: '["hotspot"]',
      },
    },
    interactions: {
      interaction_a1: {
        anchorId: 'anchor_a1',
        capability: 'inspect',
        name: 'Interaction A1',
        tags: '[]',
      },
    },
  };
}

/** Slice-3 composition: space_a1 in place_a1 holding two neighboring views. */
export function validSpaceTables(): ContentTables {
  return {
    ...validTownTables(),
    spaces: {
      space_a1: {
        placeId: 'place_a1',
        name: 'Space A1',
        tags: '["interior"]',
      },
    },
    views: {
      view_a1: {
        spaceId: 'space_a1',
        name: 'View A1',
        neighbors: '["view_a2"]',
        tags: '[]',
      },
      view_a2: {
        spaceId: 'space_a1',
        name: 'View A2',
        neighbors: '["view_a1"]',
        tags: '[]',
      },
    },
  };
}
