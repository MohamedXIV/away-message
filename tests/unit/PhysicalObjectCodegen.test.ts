import { describe, expect, it } from 'vitest';
import { generatePhysicalObjectWorldSource } from '../../src/tools/content/physicalObjectCodegen';
import type { ContentTables } from '../../src/tools/content/codegen';

function tables(): ContentTables {
  return {
    worldObjects: {
      desk_basic: {
        name: 'Basic desk',
        placementTags: JSON.stringify(['furniture.floor']),
        affordances: JSON.stringify(['inspect']),
        toolCapabilities: '[]',
        resources: '[]',
        slots: JSON.stringify([{ id: 'work_surface', acceptsObjectTags: ['device.desktop'] }]),
        containerDefinitionId: '',
        tags: JSON.stringify(['desk']),
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
    },
    worldObjectPlacements: {
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
    },
  };
}

describe('physical object world codegen (#86)', () => {
  it('emits deterministic object definitions and nested placements', () => {
    const source = generatePhysicalObjectWorldSource(tables());
    expect(source).toContain('GENERATED_WORLD_OBJECTS');
    expect(source).toContain('GENERATED_WORLD_OBJECT_PLACEMENTS');
    expect(source).toContain('"work_surface"');
    expect(source).toContain('"use"');
    expect(source).toContain("owner: \"player\" as 'property' | 'player'");
    expect(source.indexOf('computer_basic')).toBeLessThan(source.indexOf('desk_basic'));
  });
});
