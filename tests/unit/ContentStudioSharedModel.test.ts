import { describe, expect, it } from 'vitest';
import { createCheckpoints } from 'tinybase';
import { createContentModel } from '../../src/tools/content/model';
import {
  generateWorldRegistrySource,
  validateContent,
} from '../../src/tools/content/codegen';
import { exportStoreJson } from '../../src/tools/ContentInspector';
import {
  getContentChildren,
  getContentParents,
  getPlacementSlotsInSpace,
} from '../../src/tools/studio/contentGraph';
import { parseFieldError } from '../../src/tools/studio/validationFeedback';

function createSyntheticModel() {
  const model = createContentModel();
  const { store } = model;

  // Character-domain validation intentionally requires at least one archetype
  // even when this synthetic proof does not author any characters.
  store.setRow('archetypes', 'test_archetype', {
    label: 'Test Archetype',
    description: 'Synthetic validator fixture',
    personaHint: '',
    vocabulary: [],
    defaultInterests: [],
    defaultSong: '',
    typingSpeedWpm: 70,
  });

  store.setRow('districts', 'test_district', {
    name: 'Test District',
    mapX: 10,
    mapY: 20,
    tags: [],
  });
  store.setRow('places', 'test_place', {
    districtId: 'test_district',
    name: 'Test Place',
    transitAccess: [],
    legacyIds: [],
  });
  store.setRow('spaces', 'test_space', {
    placeId: 'test_place',
    name: 'Test Space',
    tags: [],
  });
  store.setRow('views', 'test_view', {
    spaceId: 'test_space',
    name: 'Test View',
    neighbors: [],
    assetId: '',
    tags: [],
  });
  store.setRow('anchors', 'test_anchor', {
    viewId: 'test_view',
    name: 'Test Anchor',
    x: 0.5,
    y: 0.5,
    tags: [],
  });

  store.setRow('physicalObjectDefs', 'test_object_def', {
    name: 'Test Object',
    kind: 'furniture',
    containerId: '',
    affordances: ['inspect'],
    toolCapabilities: [],
    resourceCapabilities: [],
    tags: [],
  });
  store.setRow('placementSlots', 'test_slot', {
    name: 'Test Slot',
    spaceId: 'test_space',
    anchorId: 'test_anchor',
    parentPlacementId: '',
    slotKind: 'floor',
    allowedObjectKinds: ['furniture'],
    tags: [],
  });
  store.setRow('objectPlacements', 'test_placement', {
    objectDefId: 'test_object_def',
    slotId: 'test_slot',
  });

  store.setRow('venueStations', 'test_station', {
    placeId: 'test_place',
    spaceId: 'test_space',
    anchorId: 'test_anchor',
    name: 'Test Station',
    capacity: 1,
    roleKinds: ['worker'],
    tags: [],
  });
  store.setRow('venueRoles', 'test_role', {
    placeId: 'test_place',
    name: 'Test Worker',
    roleKind: 'worker',
    stationIds: ['test_station'],
    tags: [],
  });
  store.setRow('activityTemplates', 'test_activity', {
    placeId: 'test_place',
    name: 'Test Activity',
    purpose: 'work',
    activityKind: 'working',
    phases: [{ id: 'work', durationMinutes: 5, stationId: 'test_station' }],
    completionOwner: 'job',
    completionKind: 'work_completed',
    tags: [],
  });
  store.setRow('venueServices', 'test_service', {
    placeId: 'test_place',
    spaceId: 'test_space',
    name: 'Test Service',
    intentKinds: ['perform_work'],
    activityTemplateId: 'test_activity',
    requiredRoleKinds: ['worker'],
    requiredStationIds: ['test_station'],
    contextRequirements: [],
    tags: [],
  });

  return model;
}

describe('Content Studio shared model (#101)', () => {
  it('navigates hierarchy through shared relationships and indexes', () => {
    const model = createSyntheticModel();

    expect(
      getContentParents(model, { tableId: 'places', rowId: 'test_place' }),
    ).toEqual([{ tableId: 'districts', rowId: 'test_district' }]);

    expect(
      getContentChildren(model, { tableId: 'places', rowId: 'test_place' }),
    ).toEqual([
      { tableId: 'activityTemplates', rowId: 'test_activity' },
      { tableId: 'spaces', rowId: 'test_space' },
      { tableId: 'venueRoles', rowId: 'test_role' },
      { tableId: 'venueServices', rowId: 'test_service' },
      { tableId: 'venueStations', rowId: 'test_station' },
    ]);

    expect(
      getContentParents(model, {
        tableId: 'objectPlacements',
        rowId: 'test_placement',
      }),
    ).toEqual([{ tableId: 'placementSlots', rowId: 'test_slot' }]);
  });

  it('uses the shared TinyBase query for physical slot navigation', () => {
    const model = createSyntheticModel();

    expect(getPlacementSlotsInSpace(model, 'test_space')).toEqual([
      { tableId: 'placementSlots', rowId: 'test_slot' },
    ]);
    expect(getPlacementSlotsInSpace(model, 'missing_space')).toEqual([]);
  });

  it('surfaces domain validator errors as actionable table/row/field diagnostics', () => {
    const model = createSyntheticModel();
    model.store.setCell(
      'placementSlots',
      'test_slot',
      'spaceId',
      'missing_space',
    );

    const errors = validateContent(model.store.getTables());
    const issue = errors
      .map(parseFieldError)
      .find(
        (candidate) =>
          candidate.table === 'placementSlots' &&
          candidate.rowId === 'test_slot' &&
          candidate.field === 'spaceId',
      );

    expect(issue).toMatchObject({
      table: 'placementSlots',
      rowId: 'test_slot',
      field: 'spaceId',
    });
    expect(issue?.message).toContain('missing_space');
  });

  it('undoes and redoes edits using TinyBase checkpoints over the shared store', () => {
    const model = createSyntheticModel();
    const checkpoints = createCheckpoints(model.store);

    model.store.setCell('places', 'test_place', 'name', 'Edited Place');
    checkpoints.addCheckpoint('Rename test place');

    expect(model.store.getCell('places', 'test_place', 'name')).toBe(
      'Edited Place',
    );

    checkpoints.goBackward();
    expect(model.store.getCell('places', 'test_place', 'name')).toBe(
      'Test Place',
    );

    checkpoints.goForward();
    expect(model.store.getCell('places', 'test_place', 'name')).toBe(
      'Edited Place',
    );
  });

  it('supports generic create/edit/delete rows without an editor-only schema', () => {
    const model = createSyntheticModel();

    model.store.setRow('physicalObjectDefs', 'test_second_def', {
      name: 'Second Object',
      kind: 'decor',
      containerId: '',
      affordances: [],
      toolCapabilities: [],
      resourceCapabilities: [],
      tags: ['decor'],
    });
    expect(model.store.hasRow('physicalObjectDefs', 'test_second_def')).toBe(
      true,
    );

    model.store.setCell(
      'physicalObjectDefs',
      'test_second_def',
      'name',
      'Edited Second Object',
    );
    expect(
      model.store.getCell(
        'physicalObjectDefs',
        'test_second_def',
        'name',
      ),
    ).toBe('Edited Second Object');

    model.store.delRow('physicalObjectDefs', 'test_second_def');
    expect(model.store.hasRow('physicalObjectDefs', 'test_second_def')).toBe(
      false,
    );
  });

  it('exports and compiles deterministic artifacts from the edited shared model', () => {
    const model = createSyntheticModel();

    expect(validateContent(model.store.getTables())).toEqual([]);

    const jsonA = exportStoreJson(model.store.getTables());
    const jsonB = exportStoreJson(model.store.getTables());
    expect(jsonB).toBe(jsonA);

    const sourceA = generateWorldRegistrySource(model.store.getTables());
    const sourceB = generateWorldRegistrySource(model.store.getTables());
    expect(sourceB).toBe(sourceA);
    expect(sourceA).toContain('id: "test_place"');
    expect(sourceA).toContain('id: "test_object_def"');
    expect(sourceA).toContain('id: "test_service"');
  });
});
