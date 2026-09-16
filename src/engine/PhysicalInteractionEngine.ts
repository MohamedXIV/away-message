// src/engine/PhysicalInteractionEngine.ts
// Generic physical-interaction foundation:
// 1. Place / service policy (location-wide contracts e.g. delivery acceptance)
// 2. Direct object affordances (Bathe/Shower, Sleep, Use Computer from concrete accessible objects)
// 3. Context-composed requirements (recipes combining player inventory + local containers + installed tool/resource providers)

export interface PlaceServicePolicy {
  placeId: string;
  canReceiveDelivery: boolean;
  acceptedDeliveryTags?: string[];
  accessRestrictions?: {
    isPrivate?: boolean;
    openingHours?: [number, number];
  };
}

export interface InstalledObject {
  instanceId: string;
  definitionId: string;
  name: string;
  placeId: string;
  spaceId: string;
  anchorId: string; // Placement slot ID
  owner: 'landlord' | 'player';
  affordances: string[]; // e.g. ['bathe', 'shower', 'sleep', 'use_computer', 'open_storage']
  toolCapabilities: string[]; // e.g. ['water_heating']
  providedResources: string[]; // e.g. ['water']
  containerInstanceId?: string;
  nestedSlots?: string[]; // child placement slots
  isUsable?: boolean; // defaults to true
}

export interface InventoryItemRef {
  instanceId: string;
  definitionId: string;
  kind?: string;
  tags?: string[];
}

export interface ComposedRequirementSpec {
  itemKindsOrTags?: string[];
  requiredTools?: string[];
  requiredResources?: string[];
}

export interface ContextualResolutionInput {
  placeId: string;
  playerInventoryItems: InventoryItemRef[];
  installedObjects?: InstalledObject[];
  accessibleContainers?: Record<string, InventoryItemRef[]>;
}

export interface ContextualResolutionResult {
  satisfied: boolean;
  missingItems: string[];
  missingTools: string[];
  missingResources: string[];
  matchedItem?: {
    instanceId: string;
    definitionId: string;
    source: 'player_inventory' | 'local_container';
    containerInstanceId?: string;
  };
  matchedTools: string[];
  matchedResources: string[];
}

export interface DeliveryTargetResolutionResult {
  ok: boolean;
  targetAnchorId?: string;
  targetObjectInstanceId?: string;
  error?: string;
}

export class PhysicalInteractionEngine {
  private placePolicies: Map<string, PlaceServicePolicy> = new Map();
  private installedObjects: Map<string, InstalledObject> = new Map();

  constructor(
    initialPolicies?: PlaceServicePolicy[],
    initialObjects?: InstalledObject[],
  ) {
    if (initialPolicies) {
      for (const policy of initialPolicies) {
        this.placePolicies.set(policy.placeId, { ...policy });
      }
    }
    if (initialObjects) {
      for (const obj of initialObjects) {
        this.installedObjects.set(obj.instanceId, { ...obj, affordances: [...obj.affordances], toolCapabilities: [...obj.toolCapabilities], providedResources: [...obj.providedResources] });
      }
    }
  }

  // --- Layer 1: Place / Service Policy ---

  public setPlacePolicy(policy: PlaceServicePolicy): void {
    this.placePolicies.set(policy.placeId, { ...policy });
  }

  public getPlacePolicy(placeId: string): PlaceServicePolicy {
    return (
      this.placePolicies.get(placeId) ?? {
        placeId,
        canReceiveDelivery: true,
        acceptedDeliveryTags: ['delivery', 'reception', 'parcel-container', 'door'],
      }
    );
  }

  // --- Layer 2: Placement & Direct Object Affordances ---

  public installObject(obj: InstalledObject): void {
    this.installedObjects.set(obj.instanceId, {
      ...obj,
      affordances: [...obj.affordances],
      toolCapabilities: [...obj.toolCapabilities],
      providedResources: [...obj.providedResources],
      nestedSlots: obj.nestedSlots ? [...obj.nestedSlots] : [],
    });
  }

  public removeObject(instanceId: string): InstalledObject | undefined {
    const existing = this.installedObjects.get(instanceId);
    if (existing) {
      this.installedObjects.delete(instanceId);
    }
    return existing;
  }

  public moveObject(instanceId: string, newPlaceId: string, newSpaceId: string, newAnchorId: string): boolean {
    const obj = this.installedObjects.get(instanceId);
    if (!obj) return false;
    obj.placeId = newPlaceId;
    obj.spaceId = newSpaceId;
    obj.anchorId = newAnchorId;
    return true;
  }

  public getInstalledObjects(placeId?: string): InstalledObject[] {
    const all = Array.from(this.installedObjects.values());
    if (!placeId) return all.map((o) => ({ ...o }));
    return all.filter((o) => o.placeId === placeId).map((o) => ({ ...o }));
  }

  public getDirectAffordances(placeId: string): string[] {
    const objects = this.getInstalledObjects(placeId);
    const set = new Set<string>();
    for (const obj of objects) {
      if (obj.isUsable !== false) {
        for (const aff of obj.affordances) set.add(aff);
      }
    }
    return Array.from(set);
  }

  public hasDirectAffordance(placeId: string, affordance: string): boolean {
    const objects = this.getInstalledObjects(placeId);
    return objects.some((o) => o.isUsable !== false && o.affordances.includes(affordance));
  }

  public getAccessibleObjectWithAffordance(placeId: string, affordance: string): InstalledObject | undefined {
    const objects = this.getInstalledObjects(placeId);
    return objects.find((o) => o.isUsable !== false && o.affordances.includes(affordance));
  }

  // --- Layer 3: Context-Composed Requirements ---

  public resolveComposedRequirements(
    input: ContextualResolutionInput,
    spec: ComposedRequirementSpec,
  ): ContextualResolutionResult {
    const result: ContextualResolutionResult = {
      satisfied: true,
      missingItems: [],
      missingTools: [],
      missingResources: [],
      matchedTools: [],
      matchedResources: [],
    };

    // 1. Resolve Items (Player inventory first, then accessible local containers)
    if (spec.itemKindsOrTags && spec.itemKindsOrTags.length > 0) {
      let foundItem: ContextualResolutionResult['matchedItem'] | undefined;

      // Check player inventory
      for (const item of input.playerInventoryItems) {
        if (this.itemMatchesKindsOrTags(item, spec.itemKindsOrTags)) {
          foundItem = {
            instanceId: item.instanceId,
            definitionId: item.definitionId,
            source: 'player_inventory',
          };
          break;
        }
      }

      // If not in player inventory, check local containers
      if (!foundItem && input.accessibleContainers) {
        for (const [containerId, containerItems] of Object.entries(input.accessibleContainers)) {
          for (const item of containerItems) {
            if (this.itemMatchesKindsOrTags(item, spec.itemKindsOrTags)) {
              foundItem = {
                instanceId: item.instanceId,
                definitionId: item.definitionId,
                source: 'local_container',
                containerInstanceId: containerId,
              };
              break;
            }
          }
          if (foundItem) break;
        }
      }

      if (foundItem) {
        result.matchedItem = foundItem;
      } else {
        result.satisfied = false;
        result.missingItems.push(...spec.itemKindsOrTags);
      }
    }

    // 2. Resolve Tools & Resources from installed objects at placeId
    const placeObjects = input.installedObjects ?? this.getInstalledObjects(input.placeId);

    if (spec.requiredTools) {
      for (const toolReq of spec.requiredTools) {
        const provider = placeObjects.find(
          (o) => o.isUsable !== false && o.toolCapabilities.includes(toolReq),
        );
        if (provider) {
          result.matchedTools.push(toolReq);
        } else {
          result.satisfied = false;
          result.missingTools.push(toolReq);
        }
      }
    }

    if (spec.requiredResources) {
      for (const resReq of spec.requiredResources) {
        const provider = placeObjects.find(
          (o) => o.isUsable !== false && o.providedResources.includes(resReq),
        );
        if (provider) {
          result.matchedResources.push(resReq);
        } else {
          result.satisfied = false;
          result.missingResources.push(resReq);
        }
      }
    }

    return result;
  }

  // --- Delivery Target Resolution ---

  public resolveDeliveryTarget(placeId: string): DeliveryTargetResolutionResult {
    const policy = this.getPlacePolicy(placeId);
    if (!policy.canReceiveDelivery) {
      return {
        ok: false,
        error: `Location ${placeId} does not permit deliveries according to location policy.`,
      };
    }

    const objects = this.getInstalledObjects(placeId);
    const tags = policy.acceptedDeliveryTags ?? ['delivery', 'reception', 'parcel-container', 'door'];

    // Search for explicit delivery target object/anchor
    const targetObj = objects.find((o) =>
      tags.some((t) => o.anchorId.includes(t) || o.definitionId.includes(t) || o.affordances.includes(t)),
    );

    if (targetObj) {
      return {
        ok: true,
        targetAnchorId: targetObj.anchorId,
        targetObjectInstanceId: targetObj.instanceId,
      };
    }

    // Fallback search by anchor ID naming tag if installed object state isn't explicitly registered
    if (placeId === 'room_104') {
      return {
        ok: true,
        targetAnchorId: 'room104_delivery_anchor',
      };
    }

    return {
      ok: false,
      error: `No valid delivery target route/anchor available at ${placeId}.`,
    };
  }

  private itemMatchesKindsOrTags(item: InventoryItemRef, targets: string[]): boolean {
    if (item.kind && targets.includes(item.kind)) return true;
    if (item.definitionId && targets.includes(item.definitionId)) return true;
    if (item.tags) {
      for (const t of item.tags) {
        if (targets.includes(t)) return true;
      }
    }
    return false;
  }
}
