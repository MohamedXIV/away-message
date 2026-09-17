import type { ContentTables } from './codegen';
import { readWorldObjectPlacements, readWorldObjects } from './physicalObjects';

function ts(value: string): string {
  return JSON.stringify(value);
}

function arr(values: readonly string[]): string {
  return `[${values.map(ts).join(', ')}]`;
}

/**
 * Emits the #86 physical-object portion of worldContent.generated.ts.
 * Kept separate from the legacy world generator so validation/serialization
 * for the physical graph remains focused and deterministic.
 */
export function generatePhysicalObjectWorldSource(tables: ContentTables): string {
  const objects = readWorldObjects(tables);
  const placements = readWorldObjectPlacements(tables);
  const lines: string[] = [];

  lines.push('export interface GeneratedWorldObjectSlot {');
  lines.push('  id: string;');
  lines.push('  acceptsObjectTags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedWorldObjectDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  placementTags: string[];');
  lines.push('  affordances: string[];');
  lines.push('  toolCapabilities: string[];');
  lines.push('  resources: string[];');
  lines.push('  slots: GeneratedWorldObjectSlot[];');
  lines.push('  containerDefinitionId: string | null;');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedWorldObjectPlacement {');
  lines.push('  id: string;');
  lines.push('  objectDefinitionId: string;');
  lines.push('  anchorId: string | null;');
  lines.push('  parentPlacementId: string | null;');
  lines.push('  slotId: string | null;');
  lines.push("  owner: 'property' | 'player';");
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_WORLD_OBJECTS: GeneratedWorldObjectDef[] = [');
  for (const object of objects) {
    lines.push('  {');
    lines.push(`    id: ${ts(object.id)},`);
    lines.push(`    name: ${ts(object.name)},`);
    lines.push(`    placementTags: ${arr(object.placementTags)},`);
    lines.push(`    affordances: ${arr(object.affordances)},`);
    lines.push(`    toolCapabilities: ${arr(object.toolCapabilities)},`);
    lines.push(`    resources: ${arr(object.resources)},`);
    lines.push(`    slots: [${object.slots.map((slot) => `{ id: ${ts(slot.id)}, acceptsObjectTags: ${arr(slot.acceptsObjectTags)} }`).join(', ')}],`);
    lines.push(`    containerDefinitionId: ${object.containerDefinitionId === null ? 'null' : ts(object.containerDefinitionId)},`);
    lines.push(`    tags: ${arr(object.tags)},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_WORLD_OBJECT_PLACEMENTS: GeneratedWorldObjectPlacement[] = [');
  for (const placement of placements) {
    lines.push('  {');
    lines.push(`    id: ${ts(placement.id)},`);
    lines.push(`    objectDefinitionId: ${ts(placement.objectDefinitionId)},`);
    lines.push(`    anchorId: ${placement.anchorId === null ? 'null' : ts(placement.anchorId)},`);
    lines.push(`    parentPlacementId: ${placement.parentPlacementId === null ? 'null' : ts(placement.parentPlacementId)},`);
    lines.push(`    slotId: ${placement.slotId === null ? 'null' : ts(placement.slotId)},`);
    lines.push(`    owner: ${ts(placement.owner)} as 'property' | 'player',`);
    lines.push('  },');
  }
  lines.push('];');

  return lines.join('\n');
}
