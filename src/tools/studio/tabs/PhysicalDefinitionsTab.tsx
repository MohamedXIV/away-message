import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildContainerRow,
  buildItemRow,
  parseSemanticList,
  serializeSemanticList,
} from '../physicalDefinitionAuthoring';

interface Props {
  studio: StudioStoreContext;
}

type Section = 'items' | 'containers';
type StudioRows = Record<string, Record<string, unknown>>;

export const PhysicalDefinitionsTab: React.FC<Props> = ({ studio }) => {
  const [section, setSection] = useState<Section>('items');
  const [selectedId, setSelectedId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const rows = (studio.tables[section] ?? {}) as StudioRows;
  const ids = useMemo(() => Object.keys(rows).sort(), [rows]);
  const activeId = selectedId && rows[selectedId] ? selectedId : ids[0] || '';
  const activeRow = rows[activeId];

  const createRecord = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || rows[id]) {
      setError(`Enter a unique ${section === 'items' ? 'item' : 'container'} ID.`);
      return;
    }
    studio.setRow(section, id, section === 'items' ? buildItemRow(newName || id) : buildContainerRow(newName || id));
    setSelectedId(id);
    setNewId('');
    setNewName('');
    setError('');
  };

  const semanticListValue = (cell: 'tags' | 'allowedItemKinds') =>
    parseSemanticList(String(activeRow?.[cell] ?? '[]')).join(', ');

  const setSemanticList = (cell: 'tags' | 'allowedItemKinds', value: string) => {
    studio.setCell(section, activeId, cell, serializeSemanticList(value.split(',')));
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      <aside className="w-72 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Physical definitions
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(['items', 'containers'] as Section[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSection(id);
                  setSelectedId('');
                  setError('');
                }}
                className={`rounded px-2 py-1.5 text-xs font-bold capitalize ${section === id ? 'bg-purple-700 text-white' : 'bg-purple-950/50 text-purple-300 hover:bg-purple-900/60'}`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={`w-full rounded border p-2.5 text-left ${id === activeId ? 'border-purple-500/60 bg-purple-900/50 text-white' : 'border-transparent text-gray-300 hover:bg-purple-950/40'}`}
            >
              <div className="text-xs font-bold truncate">{String(rows[id]?.['name'] || id)}</div>
              <div className="text-[10px] font-mono text-purple-400 truncate">@{id}</div>
            </button>
          ))}
        </div>

        <div className="border-t border-purple-900/50 p-3 space-y-2">
          <input
            aria-label="New physical definition ID"
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <input
            aria-label="New physical definition name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button type="button" onClick={createRecord} className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white">
            Add {section === 'items' ? 'Item' : 'Container'}
          </button>
        </div>
      </aside>

      <section className="flex-1 overflow-y-auto p-6">
        {activeRow ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeRow['name'] || activeId)}</h2>
              <div className="text-xs font-mono text-purple-400">{section === 'items' ? 'Item' : 'Container'} ID: @{activeId}</div>
              <div className="mt-1 text-[11px] text-gray-500">Authored definition only — runtime location/occupancy belongs to the physical-world system.</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs font-bold text-purple-300">
                Name
                <input value={String(activeRow['name'] ?? '')} onChange={(event) => studio.setCell(section, activeId, 'name', event.target.value)} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
              </label>

              {section === 'items' ? (
                <>
                  <label className="text-xs font-bold text-purple-300">
                    Kind
                    <input value={String(activeRow['kind'] ?? 'misc')} onChange={(event) => studio.setCell('items', activeId, 'kind', event.target.value)} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="text-xs font-bold text-purple-300">
                    Volume
                    <input type="number" min={0} step="0.1" value={Number(activeRow['volume'] ?? 1)} onChange={(event) => studio.setCell('items', activeId, 'volume', Number(event.target.value))} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-purple-300 mt-6">
                    <input type="checkbox" checked={Boolean(activeRow['portable'])} onChange={(event) => studio.setCell('items', activeId, 'portable', event.target.checked)} />
                    Portable
                  </label>
                  <label className="md:col-span-2 text-xs font-bold text-purple-300">
                    Asset ID (optional)
                    <input value={String(activeRow['assetId'] ?? '')} onChange={(event) => studio.setCell('items', activeId, 'assetId', event.target.value)} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 font-mono text-xs text-white" />
                  </label>
                </>
              ) : (
                <>
                  <label className="text-xs font-bold text-purple-300">
                    Capacity
                    <input type="number" min={0} step="0.1" value={Number(activeRow['capacity'] ?? 1)} onChange={(event) => studio.setCell('containers', activeId, 'capacity', Number(event.target.value))} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
                  </label>
                  <label className="md:col-span-2 text-xs font-bold text-purple-300">
                    Allowed item kinds (comma separated; empty = unrestricted)
                    <input value={semanticListValue('allowedItemKinds')} onChange={(event) => setSemanticList('allowedItemKinds', event.target.value)} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
                  </label>
                </>
              )}

              <label className="md:col-span-2 text-xs font-bold text-purple-300">
                Tags (comma separated)
                <input value={semanticListValue('tags')} onChange={(event) => setSemanticList('tags', event.target.value)} className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white" />
              </label>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">No {section} authored yet.</div>
        )}
      </section>
    </div>
  );
};
