import type {
  GeneratedObjectPlacementDef,
  GeneratedPhysicalObjectDef,
  GeneratedPlacementSlotDef,
} from '../worldContent.generated';
import type {
  PhysicalItemDefinition,
  PhysicalItemLocation,
  PhysicalWorldState,
} from '../PhysicalItemEngine';

export interface PhysicalRuntimeGraph {
  objectDefs: readonly GeneratedPhysicalObjectDef[];
  slots: readonly GeneratedPlacementSlotDef[];
  placements: readonly GeneratedObjectPlacementDef[];
}

export type PhysicalObjectLocation =
  | { kind: 'slot'; slotId: string }
  | { kind: 'detached' };

export interface PhysicalObjectInstance {
  instanceId: string;
  objectDefId: string;
  authoredPlacementId?: string;
  location: PhysicalObjectLocation;
}

export interface PhysicalObjectRuntimeState {
  objects: Record<string, PhysicalObjectInstance>;
}

export interface ReachableAffordance {
  objectInstanceId: string;
  affordance: string;
}

export interface PlaceServicePolicy {
  placeId: string;
  acceptsDelivery: boolean;
  deliveryTargetSlotId: string | null;
}

export type ContextRequirement =
  | { kind: 'item'; itemKind: string; quantity: number }
  | { kind: 'tool'; capability: string }
  | { kind: 'resource'; capability: string };

export type ContextBinding =
  | { kind: 'item'; itemInstanceIds: string[] }
  | { kind: 'tool'; capability: string; objectInstanceId: string }
  | { kind: 'resource'; capability: string; objectInstanceId: string };

export type ContextRequirementResult =
  | { ok: true; bindings: ContextBinding[] }
  | { ok: false; missing: ContextRequirement[] };

export type PlaceDeliveryTargetResult =
  | {
      ok: true;
      location: Extract<PhysicalItemLocation, { kind: 'worldAnchor' }>;
      slotId: string;
    }
  | {
      ok: false;
      reason:
        | 'missing_place_policy'
        | 'delivery_not_accepted'
        | 'missing_delivery_target'
        | 'unknown_delivery_target'
        | 'delivery_target_not_anchored';
    };

export function authoredObjectInstanceId(placementId: string): string {
  if (!placementId.trim()) {
    throw new Error('Authored placement ID must be non-empty.');
  }
  return `authored:${placementId}`;
}

function cloneObject(instance: PhysicalObjectInstance): PhysicalObjectInstance {
  return {
    ...instance,
    location: { ...instance.location },
  };
}

function cloneState(state: PhysicalObjectRuntimeState): PhysicalObjectRuntimeState {
  return {
    objects: Object.fromEntries(
      Object.entries(state.objects).map(([instanceId, object]) => [
        instanceId,
        cloneObject(object),
      ]),
    ),
  };
}

function maps(graph: PhysicalRuntimeGraph) {
  return {
    defs: new Map(graph.objectDefs.map((definition) => [definition.id, definition] as const)),
    slots: new Map(graph.slots.map((slot) => [slot.id, slot] as const)),
    placements: new Map(
      graph.placements.map((placement) => [placement.id, placement] as const),
    ),
  };
}

function runtimeByAuthoredPlacement(
  state: PhysicalObjectRuntimeState,
): Map<string, PhysicalObjectInstance> {
  const result = new Map<string, PhysicalObjectInstance>();
  for (const object of Object.values(state.objects)) {
    if (object.authoredPlacementId) result.set(object.authoredPlacementId, object);
  }
  return result;
}

function resolveObjectSpace(
  object: PhysicalObjectInstance,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): string | null {
  if (object.location.kind === 'detached') return null;

  const { slots } = maps(graph);
  const byPlacement = runtimeByAuthoredPlacement(state);
  const visitedObjects = new Set<string>();
  let currentObject: PhysicalObjectInstance | undefined = object;

  while (currentObject) {
    if (visitedObjects.has(currentObject.instanceId)) return null;
    visitedObjects.add(currentObject.instanceId);

    if (currentObject.location.kind === 'detached') return null;
    const slot = slots.get(currentObject.location.slotId);
    if (!slot) return null;

    if (slot.spaceId) return slot.spaceId;
    if (!slot.parentPlacementId) return null;

    currentObject = byPlacement.get(slot.parentPlacementId);
  }

  return null;
}

function validateTargetSlotForObject(
  state: PhysicalObjectRuntimeState,
  objectInstanceId: string,
  targetSlotId: string,
  graph: PhysicalRuntimeGraph,
): void {
  const { defs, slots } = maps(graph);
  const object = state.objects[objectInstanceId];
  if (!object) throw new Error(`Unknown physical object instance: ${objectInstanceId}.`);

  const slot = slots.get(targetSlotId);
  if (!slot) throw new Error(`Unknown placement slot: ${targetSlotId}.`);

  const definition = defs.get(object.objectDefId);
  if (!definition) {
    throw new Error(`Unknown physical object definition: ${object.objectDefId}.`);
  }

  if (
    slot.allowedObjectKinds.length > 0 &&
    !slot.allowedObjectKinds.includes(definition.kind)
  ) {
    throw new Error(
      `Object ${objectInstanceId} kind ${definition.kind} is not allowed in slot ${targetSlotId}.`,
    );
  }

  const occupant = Object.values(state.objects).find(
    (candidate) =>
      candidate.instanceId !== objectInstanceId &&
      candidate.location.kind === 'slot' &&
      candidate.location.slotId === targetSlotId,
  );
  if (occupant) {
    throw new Error(
      `Placement slot ${targetSlotId} is already occupied by ${occupant.instanceId}.`,
    );
  }

  if (slot.parentPlacementId && object.authoredPlacementId === slot.parentPlacementId) {
    throw new Error(`Object ${objectInstanceId} cannot occupy its own nested slot.`);
  }
}

export function hydratePhysicalObjectRuntimeState(
  data: unknown,
  graph: PhysicalRuntimeGraph,
): PhysicalObjectRuntimeState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return materializeAuthoredPhysicalObjects(graph);
  }

  const rawObjects = (data as Record<string, unknown>)['objects'];
  if (!rawObjects || typeof rawObjects !== 'object' || Array.isArray(rawObjects)) {
    return materializeAuthoredPhysicalObjects(graph);
  }

  const definitions = new Set(graph.objectDefs.map((definition) => definition.id));
  const slots = new Set(graph.slots.map((slot) => slot.id));
  const placements = new Set(graph.placements.map((placement) => placement.id));
  const objects: Record<string, PhysicalObjectInstance> = {};

  for (const [instanceId, value] of Object.entries(rawObjects as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (record['instanceId'] !== instanceId) continue;
    if (typeof record['objectDefId'] !== 'string' || !definitions.has(record['objectDefId'])) continue;

    const authoredPlacementId =
      typeof record['authoredPlacementId'] === 'string' &&
      placements.has(record['authoredPlacementId'])
        ? record['authoredPlacementId']
        : undefined;
    const location = record['location'];
    if (!location || typeof location !== 'object' || Array.isArray(location)) continue;
    const locationRecord = location as Record<string, unknown>;

    if (locationRecord['kind'] === 'detached') {
      objects[instanceId] = {
        instanceId,
        objectDefId: record['objectDefId'],
        ...(authoredPlacementId ? { authoredPlacementId } : {}),
        location: { kind: 'detached' },
      };
      continue;
    }

    if (
      locationRecord['kind'] === 'slot' &&
      typeof locationRecord['slotId'] === 'string' &&
      slots.has(locationRecord['slotId'])
    ) {
      objects[instanceId] = {
        instanceId,
        objectDefId: record['objectDefId'],
        ...(authoredPlacementId ? { authoredPlacementId } : {}),
        location: { kind: 'slot', slotId: locationRecord['slotId'] },
      };
    }
  }

  const state = { objects };
  for (const object of Object.values(state.objects)) {
    if (object.location.kind === 'slot') {
      validateTargetSlotForObject(state, object.instanceId, object.location.slotId, graph);
    }
  }
  return state;
}

export function bridgePhysicalObjectContainers(
  physicalWorld: PhysicalWorldState,
  objectState: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): PhysicalWorldState {
  const definitions = new Map(
    graph.objectDefs.map((definition) => [definition.id, definition] as const),
  );
  const next: PhysicalWorldState = {
    items: Object.fromEntries(
      Object.entries(physicalWorld.items).map(([id, item]) => [
        id,
        { ...item, location: { ...item.location } },
      ]),
    ),
    containers: Object.fromEntries(
      Object.entries(physicalWorld.containers).map(([id, container]) => [
        id,
        { ...container },
      ]),
    ),
  };

  for (const object of Object.values(objectState.objects)) {
    const definition = definitions.get(object.objectDefId);
    if (!definition?.containerId) continue;

    const existing = next.containers[object.instanceId];
    if (existing && existing.definitionId !== definition.containerId) {
      throw new Error(
        `Physical object container identity conflict for ${object.instanceId}: ${existing.definitionId} != ${definition.containerId}.`,
      );
    }
    next.containers[object.instanceId] = {
      instanceId: object.instanceId,
      definitionId: definition.containerId,
    };
  }

  return next;
}

export function materializeAuthoredPhysicalObjects(
  graph: PhysicalRuntimeGraph,
): PhysicalObjectRuntimeState {
  const { defs, slots } = maps(graph);
  const objects: Record<string, PhysicalObjectInstance> = {};

  for (const placement of [...graph.placements].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!defs.has(placement.objectDefId)) {
      throw new Error(
        `Authored placement ${placement.id} references unknown object definition ${placement.objectDefId}.`,
      );
    }
    if (!slots.has(placement.slotId)) {
      throw new Error(
        `Authored placement ${placement.id} references unknown slot ${placement.slotId}.`,
      );
    }

    const instanceId = authoredObjectInstanceId(placement.id);
    objects[instanceId] = {
      instanceId,
      objectDefId: placement.objectDefId,
      authoredPlacementId: placement.id,
      location: { kind: 'slot', slotId: placement.slotId },
    };
  }

  const state = { objects };
  for (const object of Object.values(state.objects)) {
    if (object.location.kind === 'slot') {
      validateTargetSlotForObject(state, object.instanceId, object.location.slotId, graph);
    }
  }
  return state;
}

export function getReachablePhysicalObjects(
  spaceId: string,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): PhysicalObjectInstance[] {
  return Object.values(state.objects)
    .filter((object) => resolveObjectSpace(object, state, graph) === spaceId)
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
    .map(cloneObject);
}

export function getReachableAffordances(
  spaceId: string,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): ReachableAffordance[] {
  const definitions = new Map(
    graph.objectDefs.map((definition) => [definition.id, definition] as const),
  );

  return getReachablePhysicalObjects(spaceId, state, graph)
    .flatMap((object) => {
      const definition = definitions.get(object.objectDefId);
      if (!definition) return [];
      return definition.affordances
        .map((affordance) => ({
          objectInstanceId: object.instanceId,
          affordance,
        }));
    })
    .sort(
      (a, b) =>
        a.objectInstanceId.localeCompare(b.objectInstanceId) ||
        a.affordance.localeCompare(b.affordance),
    );
}

export function movePhysicalObject(
  state: PhysicalObjectRuntimeState,
  objectInstanceId: string,
  targetSlotId: string,
  graph: PhysicalRuntimeGraph,
): PhysicalObjectRuntimeState {
  validateTargetSlotForObject(state, objectInstanceId, targetSlotId, graph);

  const candidate = cloneState(state);
  candidate.objects[objectInstanceId] = {
    ...candidate.objects[objectInstanceId]!,
    location: { kind: 'slot', slotId: targetSlotId },
  };

  // Reject a move that makes the object or any descendant lose a terminating
  // root because of a cycle in runtime nesting.
  const target = candidate.objects[objectInstanceId]!;
  if (resolveObjectSpace(target, candidate, graph) === null) {
    const slot = graph.slots.find((entry) => entry.id === targetSlotId);
    if (slot?.parentPlacementId) {
      throw new Error(`Moving ${objectInstanceId} to ${targetSlotId} creates invalid nesting.`);
    }
  }

  return candidate;
}

export function detachPhysicalObject(
  state: PhysicalObjectRuntimeState,
  objectInstanceId: string,
  _graph: PhysicalRuntimeGraph,
): PhysicalObjectRuntimeState {
  const object = state.objects[objectInstanceId];
  if (!object) throw new Error(`Unknown physical object instance: ${objectInstanceId}.`);

  const candidate = cloneState(state);
  candidate.objects[objectInstanceId] = {
    ...candidate.objects[objectInstanceId]!,
    location: { kind: 'detached' },
  };
  return candidate;
}

function reachableContainerIds(
  spaceId: string,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): Set<string> {
  const definitions = new Map(
    graph.objectDefs.map((definition) => [definition.id, definition] as const),
  );
  return new Set(
    getReachablePhysicalObjects(spaceId, state, graph)
      .filter((object) => Boolean(definitions.get(object.objectDefId)?.containerId))
      .map((object) => object.instanceId),
  );
}

function availableItemIds(
  args: {
    spaceId: string;
    objectState: PhysicalObjectRuntimeState;
    graph: PhysicalRuntimeGraph;
    physicalWorld: PhysicalWorldState;
    itemDefinitions: Readonly<Record<string, PhysicalItemDefinition>>;
    playerInventoryContainerId: string;
  },
  itemKind: string,
): string[] {
  const localContainers = reachableContainerIds(
    args.spaceId,
    args.objectState,
    args.graph,
  );

  return Object.values(args.physicalWorld.items)
    .filter((item) => {
      const definition = args.itemDefinitions[item.definitionId];
      if (!definition || definition.kind !== itemKind) return false;
      if (item.location.kind !== 'container') return false;
      return (
        item.location.containerInstanceId === args.playerInventoryContainerId ||
        localContainers.has(item.location.containerInstanceId)
      );
    })
    .map((item) => item.instanceId)
    .sort();
}

function findProvider(
  kind: 'tool' | 'resource',
  capability: string,
  spaceId: string,
  state: PhysicalObjectRuntimeState,
  graph: PhysicalRuntimeGraph,
): PhysicalObjectInstance | undefined {
  const definitions = new Map(
    graph.objectDefs.map((definition) => [definition.id, definition] as const),
  );

  return getReachablePhysicalObjects(spaceId, state, graph).find((object) => {
    const definition = definitions.get(object.objectDefId);
    if (!definition) return false;
    return kind === 'tool'
      ? definition.toolCapabilities.includes(capability)
      : definition.resourceCapabilities.includes(capability);
  });
}

export function resolveContextRequirements(args: {
  spaceId: string;
  objectState: PhysicalObjectRuntimeState;
  graph: PhysicalRuntimeGraph;
  physicalWorld: PhysicalWorldState;
  itemDefinitions: Readonly<Record<string, PhysicalItemDefinition>>;
  playerInventoryContainerId: string;
  requirements: readonly ContextRequirement[];
}): ContextRequirementResult {
  const bindings: ContextBinding[] = [];
  const missing: ContextRequirement[] = [];
  const reservedItems = new Set<string>();

  for (const requirement of args.requirements) {
    if (requirement.kind === 'item') {
      const quantity = Math.max(0, Math.floor(requirement.quantity));
      const available = availableItemIds(args, requirement.itemKind)
        .filter((instanceId) => !reservedItems.has(instanceId));
      const selected = available.slice(0, quantity);
      selected.forEach((instanceId) => reservedItems.add(instanceId));

      if (selected.length < quantity) {
        missing.push({
          kind: 'item',
          itemKind: requirement.itemKind,
          quantity: quantity - selected.length,
        });
        continue;
      }

      bindings.push({ kind: 'item', itemInstanceIds: selected });
      continue;
    }

    const provider = findProvider(
      requirement.kind,
      requirement.capability,
      args.spaceId,
      args.objectState,
      args.graph,
    );
    if (!provider) {
      missing.push({ ...requirement });
      continue;
    }

    bindings.push({
      kind: requirement.kind,
      capability: requirement.capability,
      objectInstanceId: provider.instanceId,
    });
  }

  return missing.length > 0 ? { ok: false, missing } : { ok: true, bindings };
}

export function resolvePlaceDeliveryTarget(
  placeId: string,
  policies: readonly PlaceServicePolicy[],
  graph: PhysicalRuntimeGraph,
): PlaceDeliveryTargetResult {
  const policy = policies.find((candidate) => candidate.placeId === placeId);
  if (!policy) return { ok: false, reason: 'missing_place_policy' };
  if (!policy.acceptsDelivery) return { ok: false, reason: 'delivery_not_accepted' };
  if (!policy.deliveryTargetSlotId) {
    return { ok: false, reason: 'missing_delivery_target' };
  }

  const slot = graph.slots.find((candidate) => candidate.id === policy.deliveryTargetSlotId);
  if (!slot) return { ok: false, reason: 'unknown_delivery_target' };
  if (!slot.anchorId) return { ok: false, reason: 'delivery_target_not_anchored' };

  return {
    ok: true,
    location: { kind: 'worldAnchor', anchorId: slot.anchorId },
    slotId: slot.id,
  };
}
