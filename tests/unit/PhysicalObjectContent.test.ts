import { describe, expect, it } from 'vitest';
import {
  generateWorldRegistrySource,
  validateContent,
  type ContentTables,
} from '../../src/tools/content/codegen';
import { cloneTables, validAnchorTables } from './worldFixtures';

function physicalObjectTables(): ContentTables {
  const tables = cloneTables(validAnchorTables());

  (tables['places']!['place_a1']! as Record<string, unknown>)['servicePolicies'] = JSON.stringify({
    canReceiveDelivery: true,
  });
  (tables['anchors']!['anchor_a1']! as Record<string, unknown>)['acceptsObjectTags'] = JSON.stringify([
    'furniture.floor',
  ]);

  tables['worldObjects'] = {
    desk_basic: {
      name: 'Basic desk',
      placementTags: JSON.stringify(['furniture.floor']),
      affordances: JSON.stringify(['inspect']),
      toolCapabilities: '[]',
      resources: '[]',
      slots: JSON.stringify([
        { id: 'work_surface', acceptsObjectTags: ['device.desktop'] },
      ]),
      containerDefinitionId: '',
      tags: JSON.stringify(['furniture', 'desk']),
    },
    computer_basic: {
      name: 'Basic computer',
      placementTags: JSON.stringify(['device.desktop']),
      affordances: JSON.stringify(['use', 'power', 'inspect']),
      toolCapabilities: '[]',
      resources: '[]',
      slots: '[]',
      containerDefinitionId: '',
      tags: JSON.stringify(['computer']),
    },
    kettle_basic: {
      name: 'Basic kettle',
      placementTags: JSON.stringify(['appliance.countertop']),
      affordances: JSON.stringify(['inspect']),
      toolCapabilities: JSON.stringify(['heat_water']),
      resources: '[]',
      slots: '[]',
      containerDefinitionId: '',
      tags: JSON.stringify(['appliance']),
    },
  };

  tables['worldObjectPlacements'] = {
    desk_install: {
      objectDefinitionId: 'desk_basic',
      anchorId: 'anchor_a1',
      parentPlacementId: '',
      slotId: '',
      owner: 'property',
    },
    computer_install: {
      objectDefinitionId: 'computer_basic',
      anchorId: '',
      parentPlacementId: 'desk_install',
      slotId: 'work_surface',
      owner: 'player',
    },
  };

  return tables;
}

describe('physical object content contract (#86)', () => {
  it('generates place policy, placement slots, nested objects, affordances and tool capabilities', () => {
    const tables = physicalObjectTables();
    expect(validateContent(tables)).toEqual([]);

    const generated = generateWorldRegistrySource(tables);
    for (const token of [
      'servicePolicies',
      'canReceiveDelivery',
      'acceptsObjectTags',
      'GENERATED_WORLD_OBJECTS',
      'GENERATED_WORLD_OBJECT_PLACEMENTS',
      'desk_basic',
      'work_surface',
      'computer_basic',
      '"use"',
      'heat_water',
    ]) {
      expect(generated, `missing ${token}`).toContain(token);
    }
  });

  it('rejects a nested placement whose parent slot does not exist', () => {
    const tables = physicalObjectTables();
    (tables['worldObjectPlacements']!['computer_install']! as Record<string, unknown>)['slotId'] =
      'missing_slot';

    const errors = validateContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('worldObjectPlacements/computer_install') && error.includes('missing_slot'),
      ),
    ).toBe(true);
  });

  it('rejects an object whose placement tags are incompatible with its target slot', () => {
    const tables = physicalObjectTables();
    (tables['worldObjects']!['computer_basic']! as Record<string, unknown>)['placementTags'] =
      JSON.stringify(['appliance.countertop']);

    const errors = validateContent(tables);
    expect(
      errors.some(
        (error) =>
          error.includes('worldObjectPlacements/computer_install') && error.includes('incompatible'),
      ),
    ).toBe(true);
  });
});
