// src/tools/studio/tabs/EventsTab.tsx
// Content Studio tab for world-event modifier specs (#46). Authors the
// eventModifiers table: which triggered events publish which bounded,
// domain-owned effects. Validation comes from the shared content validator
// (surfaced in the shell's Issues modal); row creation is guarded here by
// the same closed domain/kind vocabulary the engine enforces.

import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildEventModifierRow,
  listModifierDomains,
  listModifierKinds,
} from '../eventModifierAuthoring';

interface Props {
  studio: StudioStoreContext;
}

type Rows = Record<string, Record<string, unknown>>;

const DOMAINS = listModifierDomains();

export const EventsTab: React.FC<Props> = ({ studio }) => {
  const [selectedId, setSelectedId] = useState('');
  const [newId, setNewId] = useState('');
  const [newEventId, setNewEventId] = useState('city_canal_festival');
  const [newDomain, setNewDomain] = useState<string>(DOMAINS[0] ?? 'delivery');
  const [newKind, setNewKind] = useState('courier_backlog');
  const [newDuration, setNewDuration] = useState('1440');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState('');

  const rows = (studio.tables['eventModifiers'] ?? {}) as Rows;
  const rowIds = useMemo(() => Object.keys(rows).sort(), [rows]);
  const activeId = selectedId || rowIds[0] || '';
  const active = rows[activeId];
  const kindsForNewDomain = useMemo(() => listModifierKinds(newDomain), [newDomain]);

  const createRow = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || rows[id]) {
      setError('Enter a unique modifier-spec ID.');
      return;
    }
    const kind = kindsForNewDomain.includes(newKind) ? newKind : (kindsForNewDomain[0] ?? '');
    const duration = Math.round(Number(newDuration));
    try {
      studio.setRow('eventModifiers', id, buildEventModifierRow(newEventId.trim(), newDomain, kind, duration, [], newValue));
      setSelectedId(id);
      setNewId('');
      setNewValue('');
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create modifier spec.');
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      <aside className="w-80 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Event Modifiers
          </div>
          <div className="text-[11px] text-gray-400 mb-2">
            Which triggered events publish bounded effects. The event engine stays the sole truth; domains apply.
          </div>
          <input
            className="w-full rounded bg-[#0d0718] border border-purple-900/60 px-2 py-1 text-xs text-purple-100 mb-1"
            placeholder="new spec id (e.g. festival_courier_backlog)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
          />
          <input
            className="w-full rounded bg-[#0d0718] border border-purple-900/60 px-2 py-1 text-xs text-purple-100 mb-1"
            placeholder="source event id (e.g. city_canal_festival)"
            value={newEventId}
            onChange={(e) => setNewEventId(e.target.value)}
          />
          <div className="flex gap-1 mb-1">
            <select
              className="flex-1 rounded bg-[#0d0718] border border-purple-900/60 px-1 py-1 text-xs text-purple-100"
              value={newDomain}
              onChange={(e) => { setNewDomain(e.target.value); setNewKind(listModifierKinds(e.target.value)[0] ?? ''); }}
            >
              {DOMAINS.map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
            <select
              className="flex-1 rounded bg-[#0d0718] border border-purple-900/60 px-1 py-1 text-xs text-purple-100"
              value={kindsForNewDomain.includes(newKind) ? newKind : (kindsForNewDomain[0] ?? '')}
              onChange={(e) => setNewKind(e.target.value)}
            >
              {kindsForNewDomain.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1 mb-1">
            <input
              className="flex-1 rounded bg-[#0d0718] border border-purple-900/60 px-2 py-1 text-xs text-purple-100"
              placeholder="duration min (0..4320)"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
            <input
              className="flex-1 rounded bg-[#0d0718] border border-purple-900/60 px-2 py-1 text-xs text-purple-100"
              placeholder="value (min/priority)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={createRow}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow"
          >
            Add modifier spec
          </button>
          {error && <div className="mt-1 text-[11px] text-red-300">{error}</div>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rowIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={`w-full text-left px-3 py-2 border-b border-purple-900/40 text-xs ${
                id === activeId ? 'bg-purple-900/50 text-white' : 'text-gray-300 hover:bg-purple-950/40'
              }`}
            >
              <div className="font-bold font-mono">{id}</div>
              <div className="text-gray-400">
                {String(rows[id]?.['domain'] ?? '')} / {String(rows[id]?.['kind'] ?? '')} ← {String(rows[id]?.['eventId'] ?? '')}
              </div>
            </button>
          ))}
          {rowIds.length === 0 && (
            <div className="p-3 text-xs text-gray-500">No modifier specs yet.</div>
          )}
        </div>
      </aside>
      <div className="flex-1 overflow-y-auto p-4">
        {!active ? (
          <div className="text-xs text-gray-500">Select or create a modifier spec.</div>
        ) : (
          <div className="max-w-lg">
            <div className="text-sm font-bold text-purple-100 font-mono mb-3">{activeId}</div>
            {(['eventId', 'durationMinutes', 'value'] as const).map((field) => (
              <label key={field} className="block mb-2 text-xs text-gray-300">
                <span className="block mb-1 font-bold text-purple-300">{field}</span>
                <input
                  className="w-full rounded bg-[#140b26] border border-purple-900/60 px-2 py-1 text-xs text-purple-100"
                  value={String(active[field] ?? '')}
                  onChange={(e) => {
                    const raw = e.target.value;
                    studio.setCell('eventModifiers', activeId, field, field === 'durationMinutes' ? Math.round(Number(raw)) : raw);
                  }}
                />
              </label>
            ))}
            <div className="text-[11px] text-gray-500 mb-3">
              domain/kind: {String(active['domain'] ?? '')} / {String(active['kind'] ?? '')} — delete and recreate to change the effect type.
            </div>
            <button
              type="button"
              onClick={() => { studio.deleteRow('eventModifiers', activeId); setSelectedId(''); }}
              className="rounded border border-red-700/60 bg-red-950/60 hover:bg-red-900/60 px-3 py-1 text-xs font-semibold text-red-200"
            >
              Delete spec
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
