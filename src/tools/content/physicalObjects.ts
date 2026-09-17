import type { ContentTables } from './codegen';

export interface AuthoredWorldObjectSlot {
  id: string;
  acceptsObjectTags: string[];
}

export interface AuthoredWorldObjectDef {
  id: string;
  name: string;
  placementTags: string[];
  affordances: string[];
  toolCapabilities: string[];
  resources: string[];
  slots: AuthoredWorldObjectSlot[];
  containerDefinitionId: string | null;
  tags: string[];
}

export interface AuthoredWorldObjectPlacement {
  id: string;
  objectDefinitionId: string;
  anchorId: string | null;
  parentPlacementId: string | null;
  slotId: string | null;
  owner: 'property' | 'player';
}

function parseArray(raw: unknown): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringArray(raw: unknown): string[] {
  return (parseArray(raw) ?? []).filter((value): value is string => typeof value === 'string');
}

function compatible(objectTags: readonly string[], acceptedTags: readonly string[]): boolean {
  return acceptedTags.length === 0 || objectTags.some((tag) => acceptedTags.includes(tag));
}

export function validatePhysicalObjectContent(tables: ContentTables): string[] {
  const errors: string[] = [];
  const places = tables['places'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const containers = tables['containers'] ?? {};
  const objects = tables['worldObjects'] ?? {};
  const placements = tables['worldObjectPlacements'] ?? {};

  for (const [placeId, row] of Object.entries(places)) {
    const raw = (row as Record<string, unknown>)['servicePolicies'];
    if (raw === undefined) continue;
    try {
      const policy: unknown = JSON.parse(String(raw));
      if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
        errors.push(`places/${placeId}.servicePolicies: must be a JSON object.`);
      } else {
        const delivery = (policy as Record<string, unknown>)['canReceiveDelivery'];
        if (delivery !== undefined && typeof delivery !== 'boolean') {
          errors.push(`places/${placeId}.servicePolicies.canReceiveDelivery: must be boolean when present.`);
        }
      }
    } catch {
      errors.push(`places/${placeId}.servicePolicies: invalid JSON object.`);
    }
  }

  for (const [anchorId, row] of Object.entries(anchors)) {
    const raw = (row as Record<string, unknown>)['acceptsObjectTags'];
    if (raw !== undefined && parseArray(raw) === null) {
      errors.push(`anchors/${anchorId}.acceptsObjectTags: must be a JSON array.`);
    }
  }

  for (const [objectId, row] of Object.entries(objects)) {
    const r = row as Record<string, unknown>;
    for (const field of ['placementTags', 'affordances', 'toolCapabilities', 'resources', 'tags']) {
      if (parseArray(r[field]) === null) errors.push(`worldObjects/${objectId}.${field}: must be a JSON array.`);
    }
    const slots = parseArray(r['slots']);
    if (slots === null) {
      errors.push(`worldObjects/${objectId}.slots: must be a JSON array.`);
    } else {
      const seen = new Set<string>();
      for (const [index, slot] of slots.entries()) {
        const id = (slot as Record<string, unknown>)?.['id'];
        const accepts = (slot as Record<string, unknown>)?.['acceptsObjectTags'];
        if (typeof id !== 'string' || !id) errors.push(`worldObjects/${objectId}.slots[${index}].id: required.`);
        else if (seen.has(id)) errors.push(`worldObjects/${objectId}.slots[${index}].id: duplicate slot '${id}'.`);
        else seen.add(id);
        if (!Array.isArray(accepts) || accepts.some((tag) => typeof tag !== 'string')) {
          errors.push(`worldObjects/${objectId}.slots[${index}].acceptsObjectTags: must be a string array.`);
        }
      }
    }
    const containerId = r['containerDefinitionId'];
    if (containerId && (typeof containerId !== 'string' || !containers[String(containerId)])) {
      errors.push(`worldObjects/${objectId}.containerDefinitionId: unknown container '${String(containerId)}'.`);
    }
  }

  for (const [placementId, row] of Object.entries(placements)) {
    const r = row as Record<string, unknown>;
    const objectId = String(r['objectDefinitionId'] ?? '');
    const objectRow = objects[objectId] as Record<string, unknown> | undefined;
    if (!objectRow) {
      errors.push(`worldObjectPlacements/${placementId}.objectDefinitionId: unknown object '${objectId}'.`);
      continue;
    }
    const anchorId = String(r['anchorId'] ?? '');
    const parentId = String(r['parentPlacementId'] ?? '');
    const slotId = String(r['slotId'] ?? '');
    if ((anchorId ? 1 : 0) + (parentId ? 1 : 0) !== 1) {
      errors.push(`worldObjectPlacements/${placementId}: exactly one of anchorId or parentPlacementId is required.`);
      continue;
    }
    const placementTags = stringArray(objectRow['placementTags']);
    if (anchorId) {
      const anchor = anchors[anchorId] as Record<string, unknown> | undefined;
      if (!anchor) errors.push(`worldObjectPlacements/${placementId}.anchorId: unknown anchor '${anchorId}'.`);
      else if (!compatible(placementTags, stringArray(anchor['acceptsObjectTags']))) {
        errors.push(`worldObjectPlacements/${placementId}: object '${objectId}' is incompatible with anchor '${anchorId}'.`);
      }
      if (slotId) errors.push(`worldObjectPlacements/${placementId}.slotId: must be empty for anchor placement.`);
    } else {
      const parent = placements[parentId] as Record<string, unknown> | undefined;
      if (!parent) {
        errors.push(`worldObjectPlacements/${placementId}.parentPlacementId: unknown placement '${parentId}'.`);
        continue;
      }
      const parentObjectId = String(parent['objectDefinitionId'] ?? '');
      const parentObject = objects[parentObjectId] as Record<string, unknown> | undefined;
      const slots = (parseArray(parentObject?.['slots']) ?? []) as Array<Record<string, unknown>>;
      const slot = slots.find((candidate) => candidate['id'] === slotId);
      if (!slot) errors.push(`worldObjectPlacements/${placementId}.slotId: parent '${parentId}' has no slot '${slotId}'.`);
      else {
        const accepts = Array.isArray(slot['acceptsObjectTags']) ? slot['acceptsObjectTags'].filter((x): x is string => typeof x === 'string') : [];
        if (!compatible(placementTags, accepts)) errors.push(`worldObjectPlacements/${placementId}: object '${objectId}' is incompatible with slot '${slotId}'.`);
      }
    }
    if (r['owner'] !== 'property' && r['owner'] !== 'player') {
      errors.push(`worldObjectPlacements/${placementId}.owner: must be property|player.`);
    }
  }

  return errors;
}

export function readWorldObjects(tables: ContentTables): AuthoredWorldObjectDef[] {
  const objects = tables['worldObjects'] ?? {};
  return Object.keys(objects).sort().map((id) => {
    const row = objects[id] as Record<string, unknown>;
    const slots = (parseArray(row['slots']) ?? []).filter((slot): slot is Record<string, unknown> => !!slot && typeof slot === 'object');
    return {
      id,
      name: String(row['name'] ?? ''),
      placementTags: stringArray(row['placementTags']),
      affordances: stringArray(row['affordances']),
      toolCapabilities: stringArray(row['toolCapabilities']),
      resources: stringArray(row['resources']),
      slots: slots.map((slot) => ({ id: String(slot['id'] ?? ''), acceptsObjectTags: Array.isArray(slot['acceptsObjectTags']) ? slot['acceptsObjectTags'].filter((x): x is string => typeof x === 'string') : [] })),
      containerDefinitionId: row['containerDefinitionId'] ? String(row['containerDefinitionId']) : null,
      tags: stringArray(row['tags']),
    };
  });
}

export function readWorldObjectPlacements(tables: ContentTables): AuthoredWorldObjectPlacement[] {
  const placements = tables['worldObjectPlacements'] ?? {};
  return Object.keys(placements).sort().map((id) => {
    const row = placements[id] as Record<string, unknown>;
    const optional = (value: unknown): string | null => value ? String(value) : null;
    return {
      id,
      objectDefinitionId: String(row['objectDefinitionId'] ?? ''),
      anchorId: optional(row['anchorId']),
      parentPlacementId: optional(row['parentPlacementId']),
      slotId: optional(row['slotId']),
      owner: row['owner'] === 'player' ? 'player' : 'property',
    };
  });
}
