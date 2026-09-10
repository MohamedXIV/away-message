import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildContainerRow,
  buildItemRow,
  parseSemanticList,
  serializeSemanticList,
} from '../physicalDefinitionAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';

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
  const assets = (studio.tables['assets'] ?? {}) as StudioRows;
  const items = (studio.tables['items'] ?? {}) as StudioRows;

  const ids = useMemo(() => Object.keys(rows).sort(), [rows]);
  const assetIds = useMemo(() => Object.keys(assets).sort(), [assets]);
  const knownItemKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const id of Object.keys(items)) {
      const k = String(items[id]?.['kind'] ?? '').trim();
      if (k) kinds.add(k);
    }
    return Array.from(kinds).sort();
  }, [items]);

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

  const toggleContainerAllowedKind = (kind: string) => {
    const current = parseSemanticList(String(activeRow?.['allowedItemKinds'] ?? '[]'));
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
    studio.setCell('containers', activeId, 'allowedItemKinds', serializeSemanticList(next));
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
                className={`rounded px-2 py-1.5 text-xs font-bold capitalize ${
                  section === id ? 'bg-purple-700 text-white' : 'bg-purple-950/50 text-purple-300 hover:bg-purple-900/60'
                }`}
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
              className={`w-full rounded border p-2.5 text-left ${
                id === activeId
                  ? 'border-purple-500/60 bg-purple-900/50 text-white'
                  : 'border-transparent text-gray-300 hover:bg-purple-950/40'
              }`}
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
          <button
            type="button"
            onClick={createRecord}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            Add {section === 'items' ? 'Item' : 'Container'}
          </button>
        </div>
      </aside>

      <section className="flex-1 overflow-y-auto p-6">
        {activeRow ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeRow['name'] || activeId)}</h2>
              <div className="text-xs font-mono text-purple-400">
                {section === 'items' ? 'Item' : 'Container'} ID: @{activeId}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                Authored definition only — runtime location/occupancy belongs to the physical-world system.
              </div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table={section} rowId={activeId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeRow['name'] ?? '')}
                    onChange={(event) => studio.setCell(section, activeId, 'name', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table={section} rowId={activeId} field="name" />
              </div>

              {section === 'items' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Kind
                      <input
                        value={String(activeRow['kind'] ?? 'misc')}
                        onChange={(event) => studio.setCell('items', activeId, 'kind', event.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="items" rowId={activeId} field="kind" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Volume
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={Number(activeRow['volume'] ?? 1)}
                        onChange={(event) => studio.setCell('items', activeId, 'volume', Number(event.target.value))}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="items" rowId={activeId} field="volume" />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <label className="flex items-center gap-2 text-xs font-bold text-purple-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(activeRow['portable'])}
                        onChange={(event) => studio.setCell('items', activeId, 'portable', event.target.checked)}
                      />
                      Portable
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="items" rowId={activeId} field="portable" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-purple-300">
                      Visual Asset
                      <select
                        value={String(activeRow['assetId'] ?? '')}
                        onChange={(event) => studio.setCell('items', activeId, 'assetId', event.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        <option value="">None / No visual asset</option>
                        {assetIds.map((id) => (
                          <option key={id} value={id}>
                            {String(assets[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="items" rowId={activeId} field="assetId" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Capacity
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={Number(activeRow['capacity'] ?? 1)}
                        onChange={(event) => studio.setCell('containers', activeId, 'capacity', Number(event.target.value))}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="containers" rowId={activeId} field="capacity" />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-purple-300">
                      Allowed item kinds (comma separated; empty = unrestricted)
                      <input
                        value={semanticListValue('allowedItemKinds')}
                        onChange={(event) => setSemanticList('allowedItemKinds', event.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                      />
                    </label>

                    {knownItemKinds.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-gray-400">Quick toggle:</span>
                        {knownItemKinds.map((kind) => {
                          const currentKinds = parseSemanticList(String(activeRow?.['allowedItemKinds'] ?? '[]'));
                          const isAllowed = currentKinds.includes(kind);
                          return (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => toggleContainerAllowedKind(kind)}
                              className={`rounded px-2 py-0.5 text-[10px] font-mono transition-colors ${
                                isAllowed
                                  ? 'bg-purple-600 text-white font-bold'
                                  : 'bg-purple-950/60 text-purple-300 hover:bg-purple-900/60'
                              }`}
                            >
                              {kind}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="containers" rowId={activeId} field="allowedItemKinds" />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Tags (comma separated)
                  <input
                    value={semanticListValue('tags')}
                    onChange={(event) => setSemanticList('tags', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table={section} rowId={activeId} field="tags" />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No {section} authored yet.
          </div>
        )}
      </section>
    </div>
  );
};

