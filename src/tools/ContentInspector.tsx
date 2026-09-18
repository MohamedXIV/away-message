// src/tools/ContentInspector.tsx
// Dev-only content studio overlay (TinyBase Inspector + JSON export).
// Mounted lazily behind `?studio` in dev — never ships to production.
// Flow: tweak cells → Export store.json → save over content/store.json →
// npm run content:pull (+ content:check in CI). The game reads only the
// generated registry, never this store.

import React from 'react';
import { Provider, useCreateStore } from 'tinybase/ui-react';
import type { Tables } from 'tinybase';
const ContentStudioShell = React.lazy(() =>
  import('./studio/ContentStudioShell').then((m) => ({ default: m.ContentStudioShell }))
);
import { createContentStore } from './content/schema';
import { worldTablesFromGenerated } from './studio/worldTablesFromGenerated';
import {
  GENERATED_CHARACTERS,
  GENERATED_ARCHETYPES,
  GENERATED_AFFINITY_SEEDS,
  GENERATED_DIALOGUE_POOLS,
} from '../engine/coreBuddies.generated';

const CHARACTER_KEY_ORDER = ['role', 'displayName', 'archetypeId', 'reach', 'hair', 'eyes', 'chatColor', 'bio', 'typingSpeedWpm', 'languages', 'roles'];
const ARCHETYPE_KEY_ORDER = ['label', 'description', 'personaHint', 'vocabulary', 'defaultInterests', 'defaultSong', 'typingSpeedWpm'];
const TEMPERAMENT_KEY_ORDER = ['shyness', 'warmth', 'discipline', 'spontaneity', 'loyalty'];
const AFFINITY_KEY_ORDER = ['familiarity', 'trust', 'comfort', 'respect', 'annoyance', 'affection', 'attraction', 'suspicion', 'resentment'];
const ROUTINE_KEY_ORDER = ['wakeMinute', 'sleepMinute', 'workShift', 'preferredHangout'];
const ART_PROFILE_KEY_ORDER = ['engine', 'modelPath', 'expressions', 'defaultOutfit'];
const AFFINITY_SEED_KEY_ORDER = ['roleA', 'roleB', 'value'];
const BACKSTORY_KEY_ORDER = ['relationship', 'label', 'lapseDays', 'knowsAccounts', 'candidates', 'bioSeed'];
const DIALOGUE_POOL_KEY_ORDER = ['lines', 'version'];
const DISTRICT_KEY_ORDER = ['name', 'mapX', 'mapY', 'tags', 'spatialBounds'];
const PLACE_KEY_ORDER = ['districtId', 'name', 'transitAccess', 'legacyIds', 'spatialBounds', 'entryPosition'];
const TRANSIT_STOP_KEY_ORDER = ['districtId', 'name', 'placeId', 'mapX', 'mapY'];
const BUS_LINE_KEY_ORDER = ['name', 'stopIds', 'serviceStartMinute', 'serviceEndMinute', 'headwayMinutes', 'segmentMinutes', 'fare'];
const ITEM_KEY_ORDER = ['name', 'kind', 'portable', 'volume', 'assetId', 'tags'];
const CONTAINER_KEY_ORDER = ['name', 'capacity', 'allowedItemKinds', 'tags'];
const PHYSICAL_OBJECT_DEF_KEY_ORDER = ['name', 'kind', 'containerId', 'affordances', 'toolCapabilities', 'resourceCapabilities', 'tags'];
const PLACEMENT_SLOT_KEY_ORDER = ['name', 'spaceId', 'anchorId', 'parentPlacementId', 'slotKind', 'allowedObjectKinds', 'tags'];
const OBJECT_PLACEMENT_KEY_ORDER = ['objectDefId', 'slotId'];
const PLACE_SERVICE_POLICY_KEY_ORDER = ['placeId', 'acceptsDelivery', 'deliveryTargetSlotId'];
const VENUE_ROLE_KEY_ORDER = ['placeId', 'name', 'roleKind', 'stationIds', 'tags'];
const VENUE_STATION_KEY_ORDER = ['placeId', 'spaceId', 'anchorId', 'name', 'capacity', 'roleKinds', 'tags'];
const VENUE_SERVICE_KEY_ORDER = ['placeId', 'spaceId', 'name', 'intentKinds', 'activityTemplateId', 'requiredRoleKinds', 'requiredStationIds', 'contextRequirements', 'tags'];
const ACTIVITY_TEMPLATE_KEY_ORDER = ['placeId', 'name', 'purpose', 'activityKind', 'phases', 'completionOwner', 'completionKind', 'tags'];
const SPACE_KEY_ORDER = ['placeId', 'name', 'tags', 'spatialBounds', 'entryPosition'];
const VIEW_KEY_ORDER = ['spaceId', 'name', 'neighbors', 'assetId', 'tags'];
const ANCHOR_KEY_ORDER = ['viewId', 'name', 'x', 'y', 'tags'];
const INTERACTION_KEY_ORDER = ['anchorId', 'capability', 'name', 'tags'];
const ASSET_KEY_ORDER = ['name', 'kind', 'uri', 'normalMapAssetId', 'tags'];
const LIGHT_PROFILE_KEY_ORDER = ['name', 'timeOfDay', 'colorTint', 'intensity', 'tags'];
const AUDIO_PROFILE_KEY_ORDER = ['name', 'kind', 'assetId', 'volume', 'tags'];
const AMBIENT_PROFILE_KEY_ORDER = ['name', 'weather', 'timeOfDay', 'density', 'tags'];

const TABLE_KEY_ORDERS: Record<string, string[]> = {
  characters: CHARACTER_KEY_ORDER,
  archetypes: ARCHETYPE_KEY_ORDER,
  temperaments: TEMPERAMENT_KEY_ORDER,
  initialAffinities: AFFINITY_KEY_ORDER,
  routines: ROUTINE_KEY_ORDER,
  artProfiles: ART_PROFILE_KEY_ORDER,
  affinitySeeds: AFFINITY_SEED_KEY_ORDER,
  backstories: BACKSTORY_KEY_ORDER,
  dialoguePools: DIALOGUE_POOL_KEY_ORDER,
  districts: DISTRICT_KEY_ORDER,
  places: PLACE_KEY_ORDER,
  transitStops: TRANSIT_STOP_KEY_ORDER,
  busLines: BUS_LINE_KEY_ORDER,
  items: ITEM_KEY_ORDER,
  containers: CONTAINER_KEY_ORDER,
  physicalObjectDefs: PHYSICAL_OBJECT_DEF_KEY_ORDER,
  placementSlots: PLACEMENT_SLOT_KEY_ORDER,
  objectPlacements: OBJECT_PLACEMENT_KEY_ORDER,
  placeServicePolicies: PLACE_SERVICE_POLICY_KEY_ORDER,
  venueRoles: VENUE_ROLE_KEY_ORDER,
  venueStations: VENUE_STATION_KEY_ORDER,
  venueServices: VENUE_SERVICE_KEY_ORDER,
  activityTemplates: ACTIVITY_TEMPLATE_KEY_ORDER,
  spaces: SPACE_KEY_ORDER,
  views: VIEW_KEY_ORDER,
  anchors: ANCHOR_KEY_ORDER,
  interactions: INTERACTION_KEY_ORDER,
  assets: ASSET_KEY_ORDER,
  lightProfiles: LIGHT_PROFILE_KEY_ORDER,
  audioProfiles: AUDIO_PROFILE_KEY_ORDER,
  ambientProfiles: AMBIENT_PROFILE_KEY_ORDER,
};


/** Canonical store.json text from live tables (sorted ids/keys — stable diffs). */
export function exportStoreJson(tables: Tables): string {
  const out: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const table of Object.keys(tables).sort()) {
    out[table] = {};
    const order = TABLE_KEY_ORDERS[table];
    for (const rowId of Object.keys(tables[table] ?? {}).sort()) {
      const row = (tables[table] ?? {})[rowId] ?? {};
      const cells: Record<string, unknown> = {};
      const keys = order ?? Object.keys(row).sort();
      for (const key of keys) {
        if (key in row) cells[key] = row[key];
      }
      out[table]![rowId] = cells;
    }
  }
  return JSON.stringify(out, null, 2);
}

/** Baseline tables from the generated registry (Inspector hydration). */
export function tablesFromGenerated(): Tables {
  type StudioRow = Tables[string][string];
  type StudioTable = Record<string, StudioRow>;
  const characters: StudioTable = {};
  const temperaments: StudioTable = {};
  const initialAffinities: StudioTable = {};
  const routines: StudioTable = {};
  const artProfiles: StudioTable = {};
  const backstories: StudioTable = {};

  for (const c of GENERATED_CHARACTERS) {
    characters[c.id] = {
      role: c.role,
      displayName: c.displayName,
      archetypeId: c.archetypeId,
      reach: c.reach,
      hair: c.hair,
      eyes: c.eyes,
      chatColor: c.chatColor,
      bio: c.bio,
      typingSpeedWpm: c.typingSpeedWpm,
      languages: c.languages.map((entry) => ({ ...entry })),
      roles: [...c.roles],
    };
    temperaments[c.id] = { ...c.temperament };
    initialAffinities[c.id] = { ...c.initialAffinity };
    routines[c.id] = { ...c.routine };
    artProfiles[c.id] = {
      engine: c.art.engine,
      modelPath: c.art.modelPath,
      expressions: { ...c.art.expressions },
      defaultOutfit: c.art.defaultOutfit,
    };
    if (c.backstory) {
      backstories[c.id] = {
        relationship: c.backstory.relationship,
        label: c.backstory.label,
        lapseDays: c.backstory.lapseDays,
        knowsAccounts: c.backstory.knowsAccounts,
        candidates: c.backstory.candidates.map((entry) => ({ ...entry })),
        bioSeed: c.backstory.bioSeed,
      };
    }
  }

  const archetypes: StudioTable = {};
  for (const a of GENERATED_ARCHETYPES) {
    archetypes[a.id] = {
      label: a.label,
      description: a.description,
      personaHint: a.personaHint,
      vocabulary: [...a.vocabulary],
      defaultInterests: [...a.defaultInterests],
      defaultSong: a.defaultSong,
      typingSpeedWpm: a.typingSpeedWpm,
    };
  }

  const affinitySeeds: StudioTable = {};
  for (const s of GENERATED_AFFINITY_SEEDS) {
    affinitySeeds[`${s.roleA}__${s.roleB}`] = {
      roleA: s.roleA,
      roleB: s.roleB,
      value: s.value,
    };
  }

  const dialoguePools: StudioTable = {};
  for (const p of GENERATED_DIALOGUE_POOLS) {
    dialoguePools[p.key] = {
      lines: [...p.lines],
      version: p.version,
    };
  }

  return {
    characters,
    archetypes,
    temperaments,
    initialAffinities,
    routines,
    artProfiles,
    affinitySeeds,
    backstories,
    dialoguePools,
    ...worldTablesFromGenerated(),
  };
}

export const ContentInspector: React.FC = () => {
  const store = useCreateStore(() => {
    const next = createContentStore();
    next.setTables(tablesFromGenerated());
    return next;
  });

  return (
    <Provider store={store}>
      <React.Suspense fallback={null}>
        <ContentStudioShell store={store} />
      </React.Suspense>
    </Provider>
  );
};
