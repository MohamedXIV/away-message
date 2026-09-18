import type { Cell, Tables } from 'tinybase';
import {
  GENERATED_AMBIENT_PROFILES,
  GENERATED_ANCHORS,
  GENERATED_ASSETS,
  GENERATED_AUDIO_PROFILES,
  GENERATED_BUS_LINES,
  GENERATED_CONTAINERS,
  GENERATED_DISTRICTS,
  GENERATED_EVENT_MODIFIERS,
  GENERATED_INTERACTIONS,
  GENERATED_ITEMS,
  GENERATED_LIGHT_PROFILES,
  GENERATED_PLACES,
  GENERATED_PHYSICAL_OBJECT_DEFS,
  GENERATED_PLACEMENT_SLOTS,
  GENERATED_OBJECT_PLACEMENTS,
  GENERATED_PLACE_SERVICE_POLICIES,
  GENERATED_SPACES,
  GENERATED_TRANSIT_STOPS,
  GENERATED_VIEWS,
} from '../../engine/worldContent.generated';

type StudioRow = Tables[string][string];
type StudioTable = Record<string, StudioRow>;

function tableFrom<T extends { id: string }>(
  definitions: readonly T[],
  project: (definition: T) => StudioRow,
): StudioTable {
  return Object.fromEntries(definitions.map((definition) => [definition.id, project(definition)]));
}

function optionalCell(value: string | null): string {
  return value ?? '';
}

function spatialBoundsCell(bounds: {
  polygon: readonly { x: number; y: number }[];
  minZ?: number;
  maxZ?: number;
  priority?: number;
}): Cell {
  return {
    polygon: bounds.polygon.map((point) => ({ x: point.x, y: point.y })),
    ...(bounds.minZ === undefined ? {} : { minZ: bounds.minZ }),
    ...(bounds.maxZ === undefined ? {} : { maxZ: bounds.maxZ }),
    ...(bounds.priority === undefined ? {} : { priority: bounds.priority }),
  };
}

function spatialPositionCell(position: { x: number; y: number; z: number }): Cell {
  return { x: position.x, y: position.y, z: position.z };
}

/** Reconstruct the authoring-store shape from generated runtime definitions. */
export function worldTablesFromGenerated(): Tables {
  return {
    districts: tableFrom(GENERATED_DISTRICTS, (district) => ({
      name: district.name,
      mapX: district.mapX,
      mapY: district.mapY,
      tags: [...district.tags],
      ...(district.spatialBounds
        ? { spatialBounds: spatialBoundsCell(district.spatialBounds) }
        : {}),
    })),
    places: tableFrom(GENERATED_PLACES, (place) => ({
      districtId: place.districtId,
      name: place.name,
      transitAccess: [...place.transitAccess],
      legacyIds: [...(place.legacyIds ?? [])],
      ...(place.spatialBounds
        ? { spatialBounds: spatialBoundsCell(place.spatialBounds) }
        : {}),
      ...(place.entryPosition
        ? { entryPosition: spatialPositionCell(place.entryPosition) }
        : {}),
    })),
    transitStops: tableFrom(GENERATED_TRANSIT_STOPS, (stop) => ({
      districtId: stop.districtId,
      name: stop.name,
      placeId: optionalCell(stop.placeId),
      mapX: stop.mapX,
      mapY: stop.mapY,
    })),
    busLines: tableFrom(GENERATED_BUS_LINES, (line) => ({
      name: line.name,
      stopIds: [...line.stopIds],
      serviceStartMinute: line.serviceStartMinute,
      serviceEndMinute: line.serviceEndMinute,
      headwayMinutes: line.headwayMinutes,
      segmentMinutes: [...line.segmentMinutes],
      fare: line.fare,
    })),
    items: tableFrom(GENERATED_ITEMS, (item) => ({
      name: item.name,
      kind: item.kind,
      portable: item.portable,
      volume: item.volume,
      assetId: optionalCell(item.assetId),
      tags: [...item.tags],
    })),
    containers: tableFrom(GENERATED_CONTAINERS, (container) => ({
      name: container.name,
      capacity: container.capacity,
      allowedItemKinds: [...container.allowedItemKinds],
      tags: [...container.tags],
    })),
    physicalObjectDefs: tableFrom(GENERATED_PHYSICAL_OBJECT_DEFS, (definition) => ({
      name: definition.name,
      kind: definition.kind,
      containerId: optionalCell(definition.containerId),
      affordances: [...definition.affordances],
      toolCapabilities: [...definition.toolCapabilities],
      resourceCapabilities: [...definition.resourceCapabilities],
      tags: [...definition.tags],
    })),
    placementSlots: tableFrom(GENERATED_PLACEMENT_SLOTS, (slot) => ({
      name: slot.name,
      spaceId: optionalCell(slot.spaceId),
      anchorId: optionalCell(slot.anchorId),
      parentPlacementId: optionalCell(slot.parentPlacementId),
      slotKind: slot.slotKind,
      allowedObjectKinds: [...slot.allowedObjectKinds],
      tags: [...slot.tags],
    })),
    objectPlacements: tableFrom(GENERATED_OBJECT_PLACEMENTS, (placement) => ({
      objectDefId: placement.objectDefId,
      slotId: placement.slotId,
    })),
    placeServicePolicies: tableFrom(GENERATED_PLACE_SERVICE_POLICIES, (policy) => ({
      placeId: policy.placeId,
      acceptsDelivery: policy.acceptsDelivery,
      deliveryTargetSlotId: optionalCell(policy.deliveryTargetSlotId),
    })),
    spaces: tableFrom(GENERATED_SPACES, (space) => ({
      placeId: space.placeId,
      name: space.name,
      tags: [...space.tags],
      ...(space.spatialBounds
        ? { spatialBounds: spatialBoundsCell(space.spatialBounds) }
        : {}),
      ...(space.entryPosition
        ? { entryPosition: spatialPositionCell(space.entryPosition) }
        : {}),
    })),
    views: tableFrom(GENERATED_VIEWS, (view) => ({
      spaceId: view.spaceId,
      name: view.name,
      neighbors: [...view.neighbors],
      assetId: optionalCell(view.assetId),
      tags: [...view.tags],
    })),
    anchors: tableFrom(GENERATED_ANCHORS, (anchor) => ({
      viewId: anchor.viewId,
      name: anchor.name,
      x: anchor.x,
      y: anchor.y,
      tags: [...anchor.tags],
    })),
    interactions: tableFrom(GENERATED_INTERACTIONS, (interaction) => ({
      anchorId: interaction.anchorId,
      capability: interaction.capability,
      name: interaction.name,
      tags: [...interaction.tags],
    })),
    assets: tableFrom(GENERATED_ASSETS, (asset) => ({
      name: asset.name,
      kind: asset.kind,
      uri: asset.uri,
      normalMapAssetId: optionalCell(asset.normalMapAssetId),
      tags: [...asset.tags],
    })),
    lightProfiles: tableFrom(GENERATED_LIGHT_PROFILES, (profile) => ({
      name: profile.name,
      timeOfDay: optionalCell(profile.timeOfDay),
      colorTint: optionalCell(profile.colorTint),
      intensity: profile.intensity,
      tags: [...profile.tags],
    })),
    audioProfiles: tableFrom(GENERATED_AUDIO_PROFILES, (profile) => ({
      name: profile.name,
      kind: profile.kind,
      assetId: optionalCell(profile.assetId),
      volume: profile.volume,
      tags: [...profile.tags],
    })),
    ambientProfiles: tableFrom(GENERATED_AMBIENT_PROFILES, (profile) => ({
      name: profile.name,
      weather: optionalCell(profile.weather),
      timeOfDay: optionalCell(profile.timeOfDay),
      density: profile.density,
      tags: [...profile.tags],
    })),
    eventModifiers: tableFrom(GENERATED_EVENT_MODIFIERS, (spec) => ({
      eventId: spec.eventId,
      domain: spec.domain,
      kind: spec.kind,
      durationMinutes: spec.durationMinutes,
      targetIds: [...spec.targetIds],
      value: spec.value === undefined ? '' : String(spec.value),
    })),
  };
}
