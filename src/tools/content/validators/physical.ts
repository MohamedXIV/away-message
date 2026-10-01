import type { ContentTables } from '../shared';
import { validateWorldId } from '../shared';

const TAG_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

function isTag(value: unknown): value is string {
  return typeof value === 'string' && TAG_PATTERN.test(value);
}

function checkTagArray(
  errors: string[],
  table: string,
  id: string,
  field: string,
  value: unknown,
  max = 24,
): string[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${table}/${id}.${field}: must be an array.`);
    return null;
  }
  if (value.length > max) {
    errors.push(`${table}/${id}.${field}: max ${max} entries.`);
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!isTag(entry)) {
      errors.push(`${table}/${id}.${field}[${index}]: '${String(entry)}' must be a lowercase semantic tag.`);
      continue;
    }
    if (seen.has(entry)) {
      errors.push(`${table}/${id}.${field}[${index}]: duplicate '${entry}'.`);
      continue;
    }
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

function checkName(
  errors: string[],
  table: string,
  id: string,
  row: Record<string, unknown>,
): void {
  const name = row['name'];
  if (typeof name !== 'string' || !name.trim() || name.length > 60) {
    errors.push(`${table}/${id}.name: must be a non-empty string <= 60 chars.`);
  }
}

/**
 * Validate the authored physical graph only.
 *
 * These tables describe reusable definitions and baseline authored placement,
 * never mutable runtime instances, ownership, occupancy, or current contents.
 */
export function validatePhysicalGraph(tables: ContentTables): string[] {
  const errors: string[] = [];
  const containers = tables['containers'] ?? {};
  const spaces = tables['spaces'] ?? {};
  const views = tables['views'] ?? {};
  const anchors = tables['anchors'] ?? {};
  const places = tables['places'] ?? {};
  const objectDefs = tables['physicalObjectDefs'] ?? {};
  const slots = tables['placementSlots'] ?? {};
  const placements = tables['objectPlacements'] ?? {};
  const policies = tables['placeServicePolicies'] ?? {};
  const housingOffers = tables['housingOffers'] ?? {};

  for (const [id, row] of Object.entries(objectDefs)) {
    if (!row || typeof row !== 'object') {
      errors.push(`physicalObjectDefs/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`physicalObjectDefs/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName(errors, 'physicalObjectDefs', id, r);

    if (!isTag(r['kind'])) {
      errors.push(`physicalObjectDefs/${id}.kind: must be a lowercase semantic tag.`);
    }

    const containerId = r['containerId'];
    if (
      containerId !== undefined &&
      containerId !== null &&
      containerId !== '' &&
      (typeof containerId !== 'string' || !containers[String(containerId)])
    ) {
      errors.push(`physicalObjectDefs/${id}.containerId: unknown container '${String(containerId)}'.`);
    }

    const affordances = checkTagArray(errors, 'physicalObjectDefs', id, 'affordances', r['affordances']);
    const toolCapabilities = checkTagArray(
      errors,
      'physicalObjectDefs',
      id,
      'toolCapabilities',
      r['toolCapabilities'],
    );
    checkTagArray(
      errors,
      'physicalObjectDefs',
      id,
      'resourceCapabilities',
      r['resourceCapabilities'],
    );
    checkTagArray(errors, 'physicalObjectDefs', id, 'tags', r['tags'], 12);

    if (affordances && toolCapabilities) {
      const tools = new Set(toolCapabilities);
      for (const affordance of affordances) {
        if (tools.has(affordance)) {
          errors.push(
            `physicalObjectDefs/${id}: direct affordance '${affordance}' must not also be a tool capability.`,
          );
        }
      }
    }
  }

  for (const [id, row] of Object.entries(slots)) {
    if (!row || typeof row !== 'object') {
      errors.push(`placementSlots/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`placementSlots/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    checkName(errors, 'placementSlots', id, r);

    const spaceId = typeof r['spaceId'] === 'string' ? r['spaceId'] : '';
    const parentPlacementId =
      typeof r['parentPlacementId'] === 'string' ? r['parentPlacementId'] : '';
    const anchorId = typeof r['anchorId'] === 'string' ? r['anchorId'] : '';

    const isRoot = spaceId.length > 0;
    const isNested = parentPlacementId.length > 0;
    if (isRoot === isNested) {
      errors.push(
        `placementSlots/${id}: exactly one of spaceId or parentPlacementId must be set.`,
      );
    }

    if (isRoot && !spaces[spaceId]) {
      errors.push(`placementSlots/${id}.spaceId: unknown space '${spaceId}'.`);
    }
    if (isNested && !placements[parentPlacementId]) {
      errors.push(
        `placementSlots/${id}.parentPlacementId: unknown placement '${parentPlacementId}'.`,
      );
    }
    if (isNested && anchorId) {
      errors.push(
        `placementSlots/${id}.anchorId: nested slots derive containment from parentPlacementId and must not set an anchor.`,
      );
    }

    if (anchorId) {
      const anchor = anchors[anchorId];
      if (!anchor || typeof anchor !== 'object') {
        errors.push(`placementSlots/${id}.anchorId: unknown anchor '${anchorId}'.`);
      } else if (isRoot) {
        const viewId = String((anchor as Record<string, unknown>)['viewId'] ?? '');
        const view = views[viewId];
        const anchorSpaceId =
          view && typeof view === 'object'
            ? String((view as Record<string, unknown>)['spaceId'] ?? '')
            : '';
        if (anchorSpaceId !== spaceId) {
          errors.push(
            `placementSlots/${id}.anchorId: anchor '${anchorId}' belongs to space '${anchorSpaceId}', expected '${spaceId}'.`,
          );
        }
      }
    }

    if (!isTag(r['slotKind'])) {
      errors.push(`placementSlots/${id}.slotKind: must be a lowercase semantic tag.`);
    }
    checkTagArray(
      errors,
      'placementSlots',
      id,
      'allowedObjectKinds',
      r['allowedObjectKinds'],
    );
    checkTagArray(errors, 'placementSlots', id, 'tags', r['tags'], 12);
  }

  const occupiedSlots = new Map<string, string>();
  for (const [id, row] of Object.entries(placements)) {
    if (!row || typeof row !== 'object') {
      errors.push(`objectPlacements/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`objectPlacements/${id}: ${idCheck.error}`);
    const r = row as Record<string, unknown>;
    const objectDefId = r['objectDefId'];
    const slotId = r['slotId'];

    const objectDef =
      typeof objectDefId === 'string' ? objectDefs[objectDefId] : undefined;
    if (!objectDef) {
      errors.push(
        `objectPlacements/${id}.objectDefId: unknown physical object definition '${String(objectDefId)}'.`,
      );
    }

    const slot = typeof slotId === 'string' ? slots[slotId] : undefined;
    if (!slot) {
      errors.push(`objectPlacements/${id}.slotId: unknown placement slot '${String(slotId)}'.`);
      continue;
    }

    const prior = occupiedSlots.get(String(slotId));
    if (prior) {
      errors.push(
        `objectPlacements/${id}.slotId: slot '${String(slotId)}' is already occupied by '${prior}'.`,
      );
    } else {
      occupiedSlots.set(String(slotId), id);
    }

    if (objectDef && typeof objectDef === 'object') {
      const objectKind = (objectDef as Record<string, unknown>)['kind'];
      const allowed = (slot as Record<string, unknown>)['allowedObjectKinds'];
      if (
        Array.isArray(allowed) &&
        allowed.length > 0 &&
        (typeof objectKind !== 'string' || !allowed.includes(objectKind))
      ) {
        errors.push(
          `objectPlacements/${id}.objectDefId: kind '${String(objectKind)}' is not allowed by slot '${String(slotId)}'.`,
        );
      }
    }
  }

  const policyPlaces = new Set<string>();
  for (const [id, row] of Object.entries(policies)) {
    if (!row || typeof row !== 'object') {
      errors.push(`placeServicePolicies/${id}: must be an object.`);
      continue;
    }

    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`placeServicePolicies/${id}: ${idCheck.error}`);

    const record = row as Record<string, unknown>;
    const placeId = record['placeId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push(
        `placeServicePolicies/${id}.placeId: unknown place '${String(placeId)}'.`,
      );
      continue;
    }
    if (policyPlaces.has(placeId)) {
      errors.push(
        `placeServicePolicies/${id}.placeId: place '${placeId}' already has a service policy.`,
      );
    }
    policyPlaces.add(placeId);

    const acceptsDelivery = record['acceptsDelivery'];
    if (typeof acceptsDelivery !== 'boolean') {
      errors.push(`placeServicePolicies/${id}.acceptsDelivery: must be a boolean.`);
    }

    const targetSlotId =
      typeof record['deliveryTargetSlotId'] === 'string'
        ? record['deliveryTargetSlotId']
        : '';

    if (acceptsDelivery === true && !targetSlotId) {
      errors.push(
        `placeServicePolicies/${id}.deliveryTargetSlotId: delivery acceptance requires an explicit target slot.`,
      );
      continue;
    }
    if (!targetSlotId) continue;

    const targetSlot = slots[targetSlotId] as Record<string, unknown> | undefined;
    if (!targetSlot) {
      errors.push(
        `placeServicePolicies/${id}.deliveryTargetSlotId: unknown placement slot '${targetSlotId}'.`,
      );
      continue;
    }

    const spaceId = targetSlot['spaceId'];
    const parentPlacementId = targetSlot['parentPlacementId'];
    if (typeof spaceId !== 'string' || !spaceId || (typeof parentPlacementId === 'string' && parentPlacementId)) {
      errors.push(
        `placeServicePolicies/${id}.deliveryTargetSlotId: delivery target must be a root slot in a canonical Space.`,
      );
      continue;
    }

    const space = spaces[spaceId] as Record<string, unknown> | undefined;
    if (!space || space['placeId'] !== placeId) {
      errors.push(
        `placeServicePolicies/${id}.deliveryTargetSlotId: target slot must belong to place '${placeId}'.`,
      );
    }

    const anchorId = targetSlot['anchorId'];
    if (typeof anchorId !== 'string' || !anchorId || !anchors[anchorId]) {
      errors.push(
        `placeServicePolicies/${id}.deliveryTargetSlotId: target slot requires an explicit authored anchor.`,
      );
    }
  }

  const housingPlaces = new Set<string>();
  let starterDefaultCount = 0;
  for (const [id, row] of Object.entries(housingOffers)) {
    if (!row || typeof row !== 'object') {
      errors.push(`housingOffers/${id}: must be an object.`);
      continue;
    }
    const idCheck = validateWorldId(id);
    if (!idCheck.ok) errors.push(`housingOffers/${id}: ${idCheck.error}`);
    const record = row as Record<string, unknown>;
    const placeId = record['placeId'];
    if (typeof placeId !== 'string' || !places[placeId]) {
      errors.push(`housingOffers/${id}.placeId: unknown place '${String(placeId)}'.`);
      continue;
    }
    if (housingPlaces.has(placeId)) {
      errors.push(`housingOffers/${id}.placeId: place '${placeId}' already has a housing offer.`);
    }
    housingPlaces.add(placeId);
    for (const field of ['available', 'starterEligible', 'starterDefault'] as const) {
      if (typeof record[field] !== 'boolean') errors.push(`housingOffers/${id}.${field}: must be a boolean.`);
    }
    for (const field of ['monthlyRent', 'moveInCost'] as const) {
      const amount = record[field];
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        errors.push(`housingOffers/${id}.${field}: must be a non-negative finite number.`);
      }
    }
    const hasHomeSpace = Object.values(spaces).some((space) => {
      const candidate = space as Record<string, unknown>;
      return candidate['placeId'] === placeId
        && Array.isArray(candidate['tags'])
        && (candidate['tags'] as unknown[]).includes('home');
    });
    if (!hasHomeSpace) {
      errors.push(`housingOffers/${id}.placeId: residence place '${placeId}' needs at least one Space tagged 'home'.`);
    }
    if (record['starterDefault'] === true) {
      starterDefaultCount += 1;
      if (record['starterEligible'] !== true || record['available'] !== true) {
        errors.push(`housingOffers/${id}.starterDefault: default starter housing must also be available and starterEligible.`);
      }
    }
  }
  if (starterDefaultCount > 1) errors.push('housingOffers: at most one starterDefault offer is allowed.');

  // Every authored nesting chain must terminate at a root slot in a Space.
  for (const placementId of Object.keys(placements)) {
    const seen = new Set<string>();
    let currentPlacementId: string | undefined = placementId;

    while (currentPlacementId) {
      if (seen.has(currentPlacementId)) {
        errors.push(
          `objectPlacements/${placementId}: physical placement nesting cycle detected at '${currentPlacementId}'.`,
        );
        break;
      }
      seen.add(currentPlacementId);

      const placement = placements[currentPlacementId] as Record<string, unknown> | undefined;
      if (!placement) break;
      const slotId = placement['slotId'];
      const slot =
        typeof slotId === 'string'
          ? (slots[slotId] as Record<string, unknown> | undefined)
          : undefined;
      if (!slot) break;

      const spaceId = slot['spaceId'];
      if (typeof spaceId === 'string' && spaceId) break;

      const parentPlacementId = slot['parentPlacementId'];
      currentPlacementId =
        typeof parentPlacementId === 'string' && parentPlacementId
          ? parentPlacementId
          : undefined;
    }
  }

  return errors;
}
