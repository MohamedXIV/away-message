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
import { GENERATED_BUDDIES, GENERATED_POOLS, CONTENT_VERSION } from '../engine/coreBuddies.generated';

const BUDDY_KEY_ORDER = ['role', 'displayName', 'handle', 'myplace', 'archetype', 'status', 'metVia', 'color', 'persona', 'typingSpeedWpm', 'formerIds'];
const TRAIT_KEY_ORDER = ['shyness', 'warmth', 'discipline', 'spontaneity', 'loyalty'];
const HEART_KEY_ORDER = ['familiarity', 'trust', 'comfort', 'respect', 'annoyance', 'affection', 'attraction', 'suspicion', 'resentment'];
const TABLE_KEY_ORDERS: Record<string, string[]> = {
  buddies: BUDDY_KEY_ORDER,
  buddyTraits: TRAIT_KEY_ORDER,
  buddyHearts: HEART_KEY_ORDER,
  buddySchedules: ['blocks'],
  pools: ['lines', 'version'],
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
  const buddies: Record<string, Record<string, string | number | boolean>> = {};
  const traits: Record<string, Record<string, string | number | boolean>> = {};
  const hearts: Record<string, Record<string, string | number | boolean>> = {};
  const schedules: Record<string, Record<string, string | number | boolean>> = {};
  for (const b of GENERATED_BUDDIES) {
    buddies[b.id] = {
      displayName: b.displayName, handle: b.handle, myplace: b.myplace, archetype: b.archetype,
      status: b.status, metVia: b.metVia, color: b.color, persona: b.persona, typingSpeedWpm: b.typingSpeedWpm,
    };
    traits[b.id] = { ...b.traits };
    hearts[b.id] = { ...b.hearts };
    schedules[b.id] = {
      blocks: JSON.stringify(b.blocks.map((blk) => ({ start: blk.start, end: blk.end, status: blk.status, msg: blk.msg }))),
    };
  }
  const pools: Record<string, Record<string, string | number | boolean>> = {};
  for (const p of GENERATED_POOLS) {
    pools[p.key] = { lines: JSON.stringify(p.lines), version: p.version };
  }
  return { buddies, buddyTraits: traits, buddyHearts: hearts, buddySchedules: schedules, pools };
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
