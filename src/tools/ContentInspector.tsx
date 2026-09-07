// src/tools/ContentInspector.tsx
// Dev-only content studio overlay (TinyBase Inspector + JSON export).
// Mounted lazily behind `?studio` in dev — never ships to production.
// Flow: tweak cells → Export store.json → save over content/store.json →
// npm run content:pull (+ content:check in CI). The game reads only the
// generated registry, never this store.

import React, { useState } from 'react';
import { Provider, useCreateStore } from 'tinybase/ui-react';
import { Inspector } from 'tinybase/ui-react-inspector';
import type { Tables } from 'tinybase';
import { createContentStore } from './content/schema';
import {
  GENERATED_CHARACTERS,
  GENERATED_ARCHETYPES,
  GENERATED_AFFINITY_SEEDS,
  GENERATED_DIALOGUE_POOLS,
  CONTENT_VERSION,
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
  const characters: Record<string, Record<string, string | number | boolean>> = {};
  const temperaments: Record<string, Record<string, number>> = {};
  const initialAffinities: Record<string, Record<string, number>> = {};
  const routines: Record<string, Record<string, string | number>> = {};
  const artProfiles: Record<string, Record<string, string>> = {};
  const backstories: Record<string, Record<string, string | number | boolean>> = {};

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
      languages: JSON.stringify(c.languages),
      roles: JSON.stringify(c.roles),
    };
    temperaments[c.id] = { ...c.temperament };
    initialAffinities[c.id] = { ...c.initialAffinity };
    routines[c.id] = { ...c.routine };
    artProfiles[c.id] = {
      engine: c.art.engine,
      modelPath: c.art.modelPath,
      expressions: JSON.stringify(c.art.expressions),
      defaultOutfit: c.art.defaultOutfit,
    };
    if (c.backstory) {
      backstories[c.id] = {
        relationship: c.backstory.relationship,
        label: c.backstory.label,
        lapseDays: c.backstory.lapseDays,
        knowsAccounts: c.backstory.knowsAccounts,
        candidates: JSON.stringify(c.backstory.candidates),
        bioSeed: c.backstory.bioSeed,
      };
    }
  }

  const archetypes: Record<string, Record<string, string | number>> = {};
  for (const a of GENERATED_ARCHETYPES) {
    archetypes[a.id] = {
      label: a.label,
      description: a.description,
      personaHint: a.personaHint,
      vocabulary: JSON.stringify(a.vocabulary),
      defaultInterests: JSON.stringify(a.defaultInterests),
      defaultSong: a.defaultSong,
      typingSpeedWpm: a.typingSpeedWpm,
    };
  }

  const affinitySeeds: Record<string, Record<string, string | number>> = {};
  for (const s of GENERATED_AFFINITY_SEEDS) {
    affinitySeeds[`${s.roleA}__${s.roleB}`] = {
      roleA: s.roleA,
      roleB: s.roleB,
      value: s.value,
    };
  }

  const dialoguePools: Record<string, Record<string, string | number>> = {};
  for (const p of GENERATED_DIALOGUE_POOLS) {
    dialoguePools[p.key] = {
      lines: JSON.stringify(p.lines),
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
  };
}

export const ContentInspector: React.FC = () => {
  const [notice, setNotice] = useState('');
  const store = useCreateStore(() => {
    const next = createContentStore();
    next.setTables(tablesFromGenerated());
    return next;
  });

  const handleExport = () => {
    try {
      const blob = new Blob([exportStoreJson(store.getTables())], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'store.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('Downloaded store.json — save it over content/store.json, then run: npm run content:pull');
    } catch {
      setNotice('Export failed in this browser.');
    }
  };

  return (
    <div className="absolute inset-0 z-[100] pointer-events-none">
      <div className="absolute left-2 top-2 pointer-events-auto flex items-center gap-2 rounded border border-purple-500 bg-[#1c1030] px-2 py-1 text-[11px] text-purple-100 shadow-lg">
        <span className="font-bold">Content studio</span>
        <span className="opacity-70">v{CONTENT_VERSION}</span>
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-purple-600 px-2 py-0.5 font-bold hover:bg-purple-500"
        >
          Export store.json
        </button>
        {notice && <span className="max-w-[420px] truncate opacity-80" title={notice}>{notice}</span>}
      </div>
      <Provider store={store}>
        <Inspector open position="right" hue={270} />
      </Provider>
    </div>
  );
};
