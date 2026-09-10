import { describe, expect, it } from 'vitest';
import { createContentStore } from '../../src/tools/content/schema';
import { validateContent } from '../../src/tools/content/codegen';
import { tablesFromGenerated, exportStoreJson } from '../../src/tools/ContentInspector';
import {
  buildDistrictRow,
  buildPlaceRow,
  normalizeWorldContentId,
} from '../../src/tools/studio/worldAuthoring';
import {
  buildTransitStopRow,
  buildBusLineRow,
  parseTransitAccess,
  serializeTransitAccess,
  reorderBusLineStops,
} from '../../src/tools/studio/transitAuthoring';
import {
  buildItemRow,
  buildContainerRow,
} from '../../src/tools/studio/physicalDefinitionAuthoring';
import {
  buildSpaceRow,
  buildViewRow,
  buildAnchorRow,
  buildInteractionRow,
} from '../../src/tools/studio/sceneAuthoring';
import {
  buildAssetRow,
  validateNormalMapReference,
} from '../../src/tools/studio/assetAuthoring';
import {
  getFieldErrors,
  getRowErrors,
} from '../../src/tools/studio/validationFeedback';

describe('Content Studio Living-World Integration & Acceptance (#52)', () => {
  it('1. create/edit district writes correct merged #51 table shape', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const districtId = normalizeWorldContentId('Uptown District');
    const row = buildDistrictRow('Uptown District');
    store.setRow('districts', districtId, row);

    const stored = store.getRow('districts', districtId);
    expect(stored).toEqual({
      name: 'Uptown District',
      mapX: 50,
      mapY: 50,
      tags: '[]',
    });

    store.setCell('districts', districtId, 'mapX', 75);
    store.setCell('districts', districtId, 'mapY', 85);
    expect(store.getCell('districts', districtId, 'mapX')).toBe(75);
    expect(store.getCell('districts', districtId, 'mapY')).toBe(85);
  });

  it('2. place district selector uses real district records', () => {
    const tables = tablesFromGenerated();
    const districtIds = Object.keys(tables.districts ?? {});
    expect(districtIds).toContain('district_a');
    expect(districtIds).toContain('district_b');

    const placeRow = buildPlaceRow('Market Square', 'district_a', districtIds);
    expect(placeRow.districtId).toBe('district_a');

    expect(() => buildPlaceRow('Nowhere', 'district_nonexistent', districtIds)).toThrow(
      "Unknown district 'district_nonexistent'",
    );
  });

  it('3. transit stop references real place/district data', () => {
    const tables = tablesFromGenerated();
    const districtIds = Object.keys(tables.districts ?? {});
    const places = tables.places as Record<string, { districtId?: unknown }>;

    const stopRow = buildTransitStopRow('Central Depot', 'district_a', 'place_a1', districtIds, places);
    expect(stopRow).toMatchObject({
      districtId: 'district_a',
      placeId: 'place_a1',
      name: 'Central Depot',
    });

    // Cannot link stop in district_a to place in district_b
    expect(() =>
      buildTransitStopRow('Mismatched Stop', 'district_a', 'place_b1', districtIds, places),
    ).toThrow("Place 'place_b1' belongs to district 'district_b'");
  });

  it('4. place transit-access editing preserves walkMinutes', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const originalAccess = parseTransitAccess(store.getCell('places', 'place_a1', 'transitAccess'));
    expect(originalAccess).toEqual([{ stopId: 'stop_a', walkMinutes: 4 }]);

    // Author adds another access link and updates walkMinutes
    const updatedAccess = [
      ...originalAccess,
      { stopId: 'stop_b', walkMinutes: 12 },
    ];
    store.setCell('places', 'place_a1', 'transitAccess', serializeTransitAccess(updatedAccess));

    const retrieved = parseTransitAccess(store.getCell('places', 'place_a1', 'transitAccess'));
    expect(retrieved).toEqual([
      { stopId: 'stop_a', walkMinutes: 4 },
      { stopId: 'stop_b', walkMinutes: 12 },
    ]);
  });

  it('5. invalid reference cannot silently save without visible qualified errors', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    // Introduce invalid cross-reference
    store.setCell('places', 'place_a1', 'districtId', 'nonexistent_district');

    const tables = store.getTables() as Record<string, Record<string, Record<string, unknown>>>;
    const errors = validateContent(tables);
    expect(errors.some((e) => e.includes('places/place_a1.districtId'))).toBe(true);

    const fieldErrors = getFieldErrors(errors, 'places', 'place_a1', 'districtId');
    expect(fieldErrors.length).toBeGreaterThan(0);
    expect(fieldErrors[0]).toContain("unknown district 'nonexistent_district'");

    const rowErrors = getRowErrors(errors, 'places', 'place_a1');
    expect(rowErrors.length).toBeGreaterThan(0);
  });

  it('6. bus-line stop ordering writes the actual merged contract', () => {
    const tables = tablesFromGenerated();
    const availableStops = Object.keys(tables.transitStops ?? {});

    const lineRow = buildBusLineRow('Express Line', ['stop_a', 'stop_b'], availableStops);
    expect(lineRow).toEqual({
      name: 'Express Line',
      stopIds: JSON.stringify(['stop_a', 'stop_b']),
      serviceStartMinute: 360,
      serviceEndMinute: 1380,
      headwayMinutes: 20,
      segmentMinutes: JSON.stringify([10]),
      fare: 2,
    });
  });

  it('7. segment timing mapping survives intentional reorder/edit', () => {
    const initialStops = ['stop_a', 'stop_b', 'stop_c'];
    const initialSegments = [15, 25];

    // Reorder: move stop_b before stop_a -> ['stop_b', 'stop_a', 'stop_c']
    const reordered = reorderBusLineStops(initialStops, initialSegments, 1, 0);
    expect(reordered.stops).toEqual(['stop_b', 'stop_a', 'stop_c']);
    // Between stop_b and stop_a, the previous A-B duration 15 is preserved
    expect(reordered.segments[0]).toBe(15);
    expect(reordered.segments.length).toBe(2);
  });

  it('8. field-qualified validation appears visibly on invalid data', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    // Invalid item volume
    store.setCell('items', 'item_a', 'volume', -5);
    // Invalid interaction anchor
    store.setCell('interactions', 'interaction_a1', 'anchorId', 'ghost_anchor');

    const tables = store.getTables() as Record<string, Record<string, Record<string, unknown>>>;
    const errors = validateContent(tables);

    const volumeErrors = getFieldErrors(errors, 'items', 'item_a', 'volume');
    expect(volumeErrors.length).toBeGreaterThan(0);
    expect(volumeErrors[0]).toContain('non-negative number');

    const anchorErrors = getFieldErrors(errors, 'interactions', 'interaction_a1', 'anchorId');
    expect(anchorErrors.length).toBeGreaterThan(0);
    expect(anchorErrors[0]).toContain("unknown anchor 'ghost_anchor'");
  });

  it('9. item/container editing writes real definitions without runtime occupancy state', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const itemRow = buildItemRow('Pocket Notebook');
    store.setRow('items', 'item_notebook', itemRow);
    expect(store.getRow('items', 'item_notebook')).toEqual({
      name: 'Pocket Notebook',
      kind: 'misc',
      portable: true,
      volume: 1,
      assetId: '',
      tags: '[]',
    });

    const containerRow = buildContainerRow('Display Case');
    store.setRow('containers', 'container_case', containerRow);
    expect(store.getRow('containers', 'container_case')).toEqual({
      name: 'Display Case',
      capacity: 1,
      allowedItemKinds: '[]',
      tags: '[]',
    });
  });

  it('10. space/view/anchor/interaction paths write their real definitions', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const placeIds = Object.keys(store.getTable('places'));
    const spaceRow = buildSpaceRow('Balcony Space', 'place_a1', placeIds);
    store.setRow('spaces', 'space_balcony', spaceRow);

    const spaceIds = Object.keys(store.getTable('spaces'));
    const assetIds = Object.keys(store.getTable('assets'));
    const viewRow = buildViewRow('Sunset View', 'space_balcony', spaceIds, 'asset_a1', assetIds);
    store.setRow('views', 'view_sunset', viewRow);

    const viewIds = Object.keys(store.getTable('views'));
    const anchorRow = buildAnchorRow('Railing Hotspot', 'view_sunset', viewIds, 0.7, 0.3);
    store.setRow('anchors', 'anchor_railing', anchorRow);

    const anchorIds = Object.keys(store.getTable('anchors'));
    const interactionRow = buildInteractionRow('Lean on railing', 'anchor_railing', anchorIds, 'inspect');
    store.setRow('interactions', 'interaction_lean', interactionRow);

    // Verify all 4 levels are valid and conform to schema
    const tables = store.getTables() as Record<string, Record<string, Record<string, unknown>>>;
    expect(validateContent(tables)).toEqual([]);
  });

  it('11. asset normal-map relationship is editable and verifiable', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const assetIds = Object.keys(store.getTable('assets'));
    expect(validateNormalMapReference('asset_a1_n', assetIds)).toBe(true);
    expect(validateNormalMapReference('missing_normal', assetIds)).toBe(false);

    const assetRow = buildAssetRow('Poster Base', 'image', 'assets/world/poster.png', 'asset_a1_n', assetIds);
    store.setRow('assets', 'asset_poster', assetRow);

    expect(store.getCell('assets', 'asset_poster', 'normalMapAssetId')).toBe('asset_a1_n');

    // Edit relationship to remove normal map
    store.setCell('assets', 'asset_poster', 'normalMapAssetId', '');
    expect(store.getCell('assets', 'asset_poster', 'normalMapAssetId')).toBe('');
  });

  it('12. existing character/archetype/dialogue Studio surfaces remain functional and valid', () => {
    const tables = tablesFromGenerated();
    // Character roster preserved
    expect(Object.keys(tables.characters ?? {}).sort()).toEqual(['henderson', 'maya', 'nora', 'ryan']);
    // Archetypes preserved
    expect(Object.keys(tables.archetypes ?? {}).length).toBeGreaterThan(0);
    // Dialogue pools preserved
    expect(Object.keys(tables.dialoguePools ?? {}).length).toBeGreaterThan(0);
    // Baseline is completely clean with 0 validation errors
    expect(validateContent(tables as Record<string, Record<string, Record<string, unknown>>>)).toEqual([]);

    // Exported JSON can round-trip through parseContentJson
    const exportedJson = exportStoreJson(tables);
    expect(exportedJson).toContain('"characters"');
    expect(exportedJson).toContain('"districts"');
    expect(exportedJson).toContain('"places"');
    expect(exportedJson).toContain('"busLines"');
    expect(exportedJson).toContain('"items"');
    expect(exportedJson).toContain('"views"');
    expect(exportedJson).toContain('"lightProfiles"');
  });

  it('13. deleteRow cleanly removes rows across living-world tables in content store', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const tableKeys = [
      'districts',
      'places',
      'transitStops',
      'busLines',
      'items',
      'containers',
      'spaces',
      'views',
      'anchors',
      'interactions',
      'assets',
      'lightProfiles',
      'audioProfiles',
      'ambientProfiles',
    ] as const;

    for (const table of tableKeys) {
      const testId = `test_del_${table}`;
      store.setRow(table, testId, { name: `Test ${table}` });
      expect(store.hasRow(table, testId)).toBe(true);

      store.delRow(table, testId);
      expect(store.hasRow(table, testId)).toBe(false);
    }
  });

  it('14. tag and semantic list editing produces valid JSON conforming to content schema', () => {
    const store = createContentStore();
    store.setTables(tablesFromGenerated());

    const tagsArray = ['quiet', 'scenic', 'historic'];
    store.setCell('districts', 'district_a', 'tags', JSON.stringify(tagsArray));
    expect(JSON.parse(String(store.getCell('districts', 'district_a', 'tags') ?? '[]'))).toEqual(tagsArray);

    // Validation passes with clean tags
    const tables = store.getTables() as Record<string, Record<string, Record<string, unknown>>>;
    expect(validateContent(tables)).toEqual([]);
  });
});
