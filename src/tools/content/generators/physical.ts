import type { ContentTables } from '../shared';
import { tsString } from '../shared';

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const optionalId = (value: unknown): string =>
  value === undefined || value === null || value === ''
    ? 'null'
    : tsString(String(value));

/** Emit the generic authored physical graph into the world registry. */
export function generatePhysicalWorldSource(tables: ContentTables): string {
  const objectDefs = tables['physicalObjectDefs'] ?? {};
  const slots = tables['placementSlots'] ?? {};
  const placements = tables['objectPlacements'] ?? {};
  const policies = tables['placeServicePolicies'] ?? {};
  const housingOffers = tables['housingOffers'] ?? {};
  const lines: string[] = [];

  lines.push('export interface GeneratedPhysicalObjectDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  kind: string;');
  lines.push('  containerId: string | null;');
  lines.push('  affordances: string[];');
  lines.push('  toolCapabilities: string[];');
  lines.push('  resourceCapabilities: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export interface GeneratedPlacementSlotDef {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  spaceId: string | null;');
  lines.push('  anchorId: string | null;');
  lines.push('  parentPlacementId: string | null;');
  lines.push('  slotKind: string;');
  lines.push('  allowedObjectKinds: string[];');
  lines.push('  tags: string[];');
  lines.push('}');
  lines.push('');

  lines.push('export interface GeneratedObjectPlacementDef {');
  lines.push('  id: string;');
  lines.push('  objectDefId: string;');
  lines.push('  slotId: string;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedPlaceServicePolicy {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  acceptsDelivery: boolean;');
  lines.push('  deliveryTargetSlotId: string | null;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GeneratedHousingOfferDef {');
  lines.push('  id: string;');
  lines.push('  placeId: string;');
  lines.push('  available: boolean;');
  lines.push('  monthlyRent: number;');
  lines.push('  moveInCost: number;');
  lines.push('  starterEligible: boolean;');
  lines.push('  starterDefault: boolean;');
  lines.push('}');
  lines.push('');

  lines.push('export const GENERATED_PHYSICAL_OBJECT_DEFS: GeneratedPhysicalObjectDef[] = [');
  for (const id of Object.keys(objectDefs).sort()) {
    const row = objectDefs[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(row['name'] ?? ''))},`);
    lines.push(`    kind: ${tsString(String(row['kind'] ?? 'fixture'))},`);
    lines.push(`    containerId: ${optionalId(row['containerId'])},`);
    lines.push(`    affordances: [${stringArray(row['affordances']).map(tsString).join(', ')}],`);
    lines.push(`    toolCapabilities: [${stringArray(row['toolCapabilities']).map(tsString).join(', ')}],`);
    lines.push(`    resourceCapabilities: [${stringArray(row['resourceCapabilities']).map(tsString).join(', ')}],`);
    lines.push(`    tags: [${stringArray(row['tags']).map(tsString).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_PLACEMENT_SLOTS: GeneratedPlacementSlotDef[] = [');
  for (const id of Object.keys(slots).sort()) {
    const row = slots[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    name: ${tsString(String(row['name'] ?? ''))},`);
    lines.push(`    spaceId: ${optionalId(row['spaceId'])},`);
    lines.push(`    anchorId: ${optionalId(row['anchorId'])},`);
    lines.push(`    parentPlacementId: ${optionalId(row['parentPlacementId'])},`);
    lines.push(`    slotKind: ${tsString(String(row['slotKind'] ?? 'generic'))},`);
    lines.push(`    allowedObjectKinds: [${stringArray(row['allowedObjectKinds']).map(tsString).join(', ')}],`);
    lines.push(`    tags: [${stringArray(row['tags']).map(tsString).join(', ')}],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_OBJECT_PLACEMENTS: GeneratedObjectPlacementDef[] = [');
  for (const id of Object.keys(placements).sort()) {
    const row = placements[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    objectDefId: ${tsString(String(row['objectDefId'] ?? ''))},`);
    lines.push(`    slotId: ${tsString(String(row['slotId'] ?? ''))},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_PLACE_SERVICE_POLICIES: GeneratedPlaceServicePolicy[] = [');
  for (const id of Object.keys(policies).sort()) {
    const row = policies[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    placeId: ${tsString(String(row['placeId'] ?? ''))},`);
    lines.push(`    acceptsDelivery: ${row['acceptsDelivery'] === true ? 'true' : 'false'},`);
    lines.push(`    deliveryTargetSlotId: ${optionalId(row['deliveryTargetSlotId'])},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');

  lines.push('export const GENERATED_HOUSING_OFFERS: GeneratedHousingOfferDef[] = [');
  for (const id of Object.keys(housingOffers).sort()) {
    const row = housingOffers[id] as Record<string, unknown>;
    lines.push('  {');
    lines.push(`    id: ${tsString(id)},`);
    lines.push(`    placeId: ${tsString(String(row['placeId'] ?? ''))},`);
    lines.push(`    available: ${row['available'] === true ? 'true' : 'false'},`);
    lines.push(`    monthlyRent: ${Number(row['monthlyRent'] ?? 0)},`);
    lines.push(`    moveInCost: ${Number(row['moveInCost'] ?? 0)},`);
    lines.push(`    starterEligible: ${row['starterEligible'] === true ? 'true' : 'false'},`);
    lines.push(`    starterDefault: ${row['starterDefault'] === true ? 'true' : 'false'},`);
    lines.push('  },');
  }
  lines.push('];');

  return lines.join('\n');
}
