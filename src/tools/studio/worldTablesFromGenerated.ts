import type { Tables } from 'tinybase';
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
  GENERATED_SPACES,
  GENERATED_TRANSIT_STOPS,
  GENERATED_VIEWS,
} from '../../engine/worldContent.generated';

type StudioRow = Record<string, string | number | boolean>;
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

/** Reconstruct the authoring-store shape from generated runtime definitions. */
export function worldTablesFromGenerated(): Tables {
  return {
    districts: tableFrom(GENERATED_DISTRICTS, (district) => ({
      name: district.name,
      mapX: district.mapX,
      mapY: district.mapY,
      tags: JSON.stringify(district.tags),
    })),
    places: tableFrom(GENERATED_PLACES, (place) => ({
      districtId: place.districtId,
      name: place.name,
      transitAccess: JSON.stringify(place.transitAccess),
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
      stopIds: JSON.stringify(line.stopIds),
      serviceStartMinute: line.serviceStartMinute,
      serviceEndMinute: line.serviceEndMinute,
      headwayMinutes: line.headwayMinutes,
      segmentMinutes: JSON.stringify(line.segmentMinutes),
      fare: line.fare,
    })),
    items: tableFrom(GENERATED_ITEMS, (item) => ({
      name: item.name,
      kind: item.kind,
      portable: item.portable,
      volume: item.volume,
      assetId: optionalCell(item.assetId),
      tags: JSON.stringify(item.tags),
    })),
    containers: tableFrom(GENERATED_CONTAINERS, (container) => ({
      name: container.name,
      capacity: container.capacity,
      allowedItemKinds: JSON.stringify(container.allowedItemKinds),
      tags: JSON.stringify(container.tags),
    })),
    spaces: tableFrom(GENERATED_SPACES, (space) => ({
      placeId: space.placeId,
      name: space.name,
      tags: JSON.stringify(space.tags),
    })),
    views: tableFrom(GENERATED_VIEWS, (view) => ({
      spaceId: view.spaceId,
      name: view.name,
      neighbors: JSON.stringify(view.neighbors),
      assetId: optionalCell(view.assetId),
      tags: JSON.stringify(view.tags),
    })),
    anchors: tableFrom(GENERATED_ANCHORS, (anchor) => ({
      viewId: anchor.viewId,
      name: anchor.name,
      x: anchor.x,
      y: anchor.y,
      tags: JSON.stringify(anchor.tags),
    })),
    interactions: tableFrom(GENERATED_INTERACTIONS, (interaction) => ({
      anchorId: interaction.anchorId,
      capability: interaction.capability,
      name: interaction.name,
      tags: JSON.stringify(interaction.tags),
    })),
    assets: tableFrom(GENERATED_ASSETS, (asset) => ({
      name: asset.name,
      kind: asset.kind,
      uri: asset.uri,
      normalMapAssetId: optionalCell(asset.normalMapAssetId),
      tags: JSON.stringify(asset.tags),
    })),
    lightProfiles: tableFrom(GENERATED_LIGHT_PROFILES, (profile) => ({
      name: profile.name,
      timeOfDay: optionalCell(profile.timeOfDay),
      colorTint: optionalCell(profile.colorTint),
      intensity: profile.intensity,
      tags: JSON.stringify(profile.tags),
    })),
    audioProfiles: tableFrom(GENERATED_AUDIO_PROFILES, (profile) => ({
      name: profile.name,
      kind: profile.kind,
      assetId: optionalCell(profile.assetId),
      volume: profile.volume,
      tags: JSON.stringify(profile.tags),
    })),
    ambientProfiles: tableFrom(GENERATED_AMBIENT_PROFILES, (profile) => ({
      name: profile.name,
      weather: optionalCell(profile.weather),
      timeOfDay: optionalCell(profile.timeOfDay),
      density: profile.density,
      tags: JSON.stringify(profile.tags),
    })),
    eventModifiers: tableFrom(GENERATED_EVENT_MODIFIERS, (spec) => ({
      eventId: spec.eventId,
      domain: spec.domain,
      kind: spec.kind,
      durationMinutes: spec.durationMinutes,
      targetIds: JSON.stringify(spec.targetIds),
      value: spec.value === undefined ? '' : String(spec.value),
    })),
  };
}
