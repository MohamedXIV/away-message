import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildSpaceRow,
  buildViewRow,
  buildAnchorRow,
  buildInteractionRow,
} from '../sceneAuthoring';
import { parseSemanticList, serializeSemanticList } from '../physicalDefinitionAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';

interface Props {
  studio: StudioStoreContext;
}

type SceneSection = 'spaces' | 'views' | 'anchors' | 'interactions';
type StudioRows = Record<string, Record<string, unknown>>;

export const ScenesTab: React.FC<Props> = ({ studio }) => {
  const [section, setSection] = useState<SceneSection>('spaces');
  const [selectedId, setSelectedId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  // Creation drafts
  const [newSpacePlaceId, setNewSpacePlaceId] = useState('');
  const [newViewSpaceId, setNewViewSpaceId] = useState('');
  const [newViewAssetId, setNewViewAssetId] = useState('');
  const [newAnchorViewId, setNewAnchorViewId] = useState('');
  const [newInteractionAnchorId, setNewInteractionAnchorId] = useState('');
  const [newInteractionCapability, setNewInteractionCapability] = useState('inspect');

  const spaces = (studio.tables['spaces'] ?? {}) as StudioRows;
  const views = (studio.tables['views'] ?? {}) as StudioRows;
  const anchors = (studio.tables['anchors'] ?? {}) as StudioRows;
  const interactions = (studio.tables['interactions'] ?? {}) as StudioRows;
  const places = (studio.tables['places'] ?? {}) as StudioRows;
  const assets = (studio.tables['assets'] ?? {}) as StudioRows;

  const spaceIds = useMemo(() => Object.keys(spaces).sort(), [spaces]);
  const viewIds = useMemo(() => Object.keys(views).sort(), [views]);
  const anchorIds = useMemo(() => Object.keys(anchors).sort(), [anchors]);
  const interactionIds = useMemo(() => Object.keys(interactions).sort(), [interactions]);
  const placeIds = useMemo(() => Object.keys(places).sort(), [places]);
  const assetIds = useMemo(() => Object.keys(assets).sort(), [assets]);

  const currentIds =
    section === 'spaces'
      ? spaceIds
      : section === 'views'
      ? viewIds
      : section === 'anchors'
      ? anchorIds
      : interactionIds;

  const currentRows =
    section === 'spaces'
      ? spaces
      : section === 'views'
      ? views
      : section === 'anchors'
      ? anchors
      : interactions;

  const activeId = selectedId && currentRows[selectedId] ? selectedId : currentIds[0] || '';
  const activeRow = currentRows[activeId];

  const clearCreate = () => {
    setNewId('');
    setNewName('');
    setNewViewAssetId('');
    setError('');
  };


  const createRecord = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || currentRows[id]) {
      setError(`Enter a unique ${section.slice(0, -1)} ID.`);
      return;
    }

    try {
      if (section === 'spaces') {
        const placeId = newSpacePlaceId || placeIds[0] || '';
        studio.setRow('spaces', id, buildSpaceRow(newName || id, placeId, placeIds));
      } else if (section === 'views') {
        const spaceId = newViewSpaceId || spaceIds[0] || '';
        studio.setRow('views', id, buildViewRow(newName || id, spaceId, spaceIds, newViewAssetId, assetIds));
      } else if (section === 'anchors') {
        const viewId = newAnchorViewId || viewIds[0] || '';
        studio.setRow('anchors', id, buildAnchorRow(newName || id, viewId, viewIds, 0.5, 0.5));
      } else {
        const anchorId = newInteractionAnchorId || anchorIds[0] || '';
        studio.setRow(
          'interactions',
          id,
          buildInteractionRow(newName || id, anchorId, anchorIds, newInteractionCapability || 'inspect'),
        );
      }
      setSelectedId(id);
      clearCreate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creation failed.');
    }
  };

  const semanticListValue = (cell: string) =>
    parseSemanticList(String(activeRow?.[cell] ?? '[]')).join(', ');

  const setSemanticList = (cell: string, value: string) => {
    studio.setCell(section, activeId, cell, serializeSemanticList(value.split(',')));
  };

  const toggleViewNeighbor = (neighborId: string) => {
    const currentNeighbors = parseSemanticList(String(activeRow?.['neighbors'] ?? '[]'));
    const next = currentNeighbors.includes(neighborId)
      ? currentNeighbors.filter((id) => id !== neighborId)
      : [...currentNeighbors, neighborId];
    studio.setCell('views', activeId, 'neighbors', serializeSemanticList(next));
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      {/* Sidebar navigation */}
      <aside className="w-72 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Scene Hierarchy
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(['spaces', 'views', 'anchors', 'interactions'] as SceneSection[]).map((id) => (
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

        {/* Record list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {currentIds.map((id) => (
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
              <div className="text-xs font-bold truncate">{String(currentRows[id]?.['name'] || id)}</div>
              <div className="text-[10px] font-mono text-purple-400 truncate">@{id}</div>
            </button>
          ))}
        </div>

        {/* Add Record Form */}
        <div className="border-t border-purple-900/50 p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
            Add {section.slice(0, -1)}
          </div>
          <input
            aria-label={`New ${section.slice(0, -1)} ID`}
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <input
            aria-label={`New ${section.slice(0, -1)} name`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />

          {section === 'spaces' && (
            <select
              aria-label="Target place"
              value={newSpacePlaceId || placeIds[0] || ''}
              onChange={(e) => setNewSpacePlaceId(e.target.value)}
              className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
            >
              {placeIds.map((id) => (
                <option key={id} value={id}>
                  Place: {String(places[id]?.['name'] || id)}
                </option>
              ))}
            </select>
          )}

          {section === 'views' && (
            <>
              <select
                aria-label="Target space"
                value={newViewSpaceId || spaceIds[0] || ''}
                onChange={(e) => setNewViewSpaceId(e.target.value)}
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
              >
                {spaceIds.map((id) => (
                  <option key={id} value={id}>
                    Space: {String(spaces[id]?.['name'] || id)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Optional background asset"
                value={newViewAssetId}
                onChange={(e) => setNewViewAssetId(e.target.value)}
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">No background asset</option>
                {assetIds.map((id) => (
                  <option key={id} value={id}>
                    Asset: {String(assets[id]?.['name'] || id)}
                  </option>
                ))}
              </select>
            </>
          )}


          {section === 'anchors' && (
            <select
              aria-label="Target view"
              value={newAnchorViewId || viewIds[0] || ''}
              onChange={(e) => setNewAnchorViewId(e.target.value)}
              className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
            >
              {viewIds.map((id) => (
                <option key={id} value={id}>
                  View: {String(views[id]?.['name'] || id)}
                </option>
              ))}
            </select>
          )}

          {section === 'interactions' && (
            <>
              <select
                aria-label="Target anchor"
                value={newInteractionAnchorId || anchorIds[0] || ''}
                onChange={(e) => setNewInteractionAnchorId(e.target.value)}
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
              >
                {anchorIds.map((id) => (
                  <option key={id} value={id}>
                    Anchor: {String(anchors[id]?.['name'] || id)}
                  </option>
                ))}
              </select>
              <input
                aria-label="Interaction capability"
                value={newInteractionCapability}
                onChange={(e) => setNewInteractionCapability(e.target.value)}
                placeholder="Capability (inspect/talk/take)"
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </>
          )}

          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button
            type="button"
            onClick={createRecord}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow"
          >
            Add {section.slice(0, -1)}
          </button>
        </div>
      </aside>

      {/* Detail Editor */}
      <section className="flex-1 overflow-y-auto p-6">
        {activeRow ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeRow['name'] || activeId)}</h2>
              <div className="text-xs font-mono text-purple-400">
                {section.slice(0, -1)} ID: @{activeId}
              </div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table={section} rowId={activeId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeRow['name'] ?? '')}
                    onChange={(e) => studio.setCell(section, activeId, 'name', e.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table={section} rowId={activeId} field="name" />
              </div>

              {section === 'spaces' && (
                <div>
                  <label className="text-xs font-bold text-purple-300">
                    Place
                    <select
                      value={String(activeRow['placeId'] ?? '')}
                      onChange={(e) => studio.setCell('spaces', activeId, 'placeId', e.target.value)}
                      className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                    >
                      {placeIds.map((id) => (
                        <option key={id} value={id}>
                          {String(places[id]?.['name'] || id)} (@{id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <FieldErrorDisplay allErrors={studio.validationErrors} table="spaces" rowId={activeId} field="placeId" />
                </div>
              )}

              {section === 'views' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Space
                      <select
                        value={String(activeRow['spaceId'] ?? '')}
                        onChange={(e) => studio.setCell('views', activeId, 'spaceId', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        {spaceIds.map((id) => (
                          <option key={id} value={id}>
                            {String(spaces[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="views" rowId={activeId} field="spaceId" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-purple-300">
                      Hero / Background Asset
                      <select
                        value={String(activeRow['assetId'] ?? '')}
                        onChange={(e) => studio.setCell('views', activeId, 'assetId', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        <option value="">None / No background asset</option>
                        {assetIds.map((id) => (
                          <option key={id} value={id}>
                            {String(assets[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="views" rowId={activeId} field="assetId" />
                  </div>

                  {/* Neighboring Views within same space */}
                  <div className="md:col-span-2 space-y-2 rounded-lg border border-purple-900/60 bg-[#140b26] p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Neighboring Views
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Connected views within space @{String(activeRow['spaceId'] ?? '')} reachable by turning or moving.
                    </p>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="views" rowId={activeId} field="neighbors" />

                    <div className="flex flex-wrap gap-2 pt-2">
                      {viewIds
                        .filter(
                          (id) => id !== activeId && String(views[id]?.['spaceId'] ?? '') === String(activeRow['spaceId'] ?? ''),
                        )
                        .map((id) => {
                          const neighbors = parseSemanticList(String(activeRow['neighbors'] ?? '[]'));
                          const isNeighbor = neighbors.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => toggleViewNeighbor(id)}
                              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                isNeighbor
                                  ? 'bg-purple-600 text-white font-bold'
                                  : 'bg-purple-950/60 text-purple-300 hover:bg-purple-900/60'
                              }`}
                            >
                              {String(views[id]?.['name'] || id)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}

              {section === 'anchors' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      View
                      <select
                        value={String(activeRow['viewId'] ?? '')}
                        onChange={(e) => studio.setCell('anchors', activeId, 'viewId', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        {viewIds.map((id) => (
                          <option key={id} value={id}>
                            {String(views[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="anchors" rowId={activeId} field="viewId" />
                  </div>

                  {(['x', 'y'] as const).map((coord) => (
                    <div key={coord}>
                      <label className="text-xs font-bold text-purple-300">
                        {coord.toUpperCase()} Position (0..1 normalized)
                        <input
                          type="number"
                          step="0.05"
                          min={0}
                          max={1}
                          value={Number(activeRow[coord] ?? 0.5)}
                          onChange={(e) => studio.setCell('anchors', activeId, coord, Number(e.target.value))}
                          className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                        />
                      </label>
                      <FieldErrorDisplay allErrors={studio.validationErrors} table="anchors" rowId={activeId} field={coord} />
                    </div>
                  ))}
                </>
              )}

              {section === 'interactions' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Anchor
                      <select
                        value={String(activeRow['anchorId'] ?? '')}
                        onChange={(e) => studio.setCell('interactions', activeId, 'anchorId', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        {anchorIds.map((id) => (
                          <option key={id} value={id}>
                            {String(anchors[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="interactions" rowId={activeId} field="anchorId" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Capability
                      <input
                        value={String(activeRow['capability'] ?? '')}
                        onChange={(e) => studio.setCell('interactions', activeId, 'capability', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                        placeholder="inspect / talk / take / sit"
                      />
                    </label>
                    <div className="flex gap-1 mt-1">
                      {['inspect', 'talk', 'take', 'sit', 'use'].map((cap) => (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => studio.setCell('interactions', activeId, 'capability', cap)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 hover:bg-purple-900/60 font-mono"
                        >
                          {cap}
                        </button>
                      ))}
                    </div>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="interactions" rowId={activeId} field="capability" />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Tags (comma separated)
                  <input
                    value={semanticListValue('tags')}
                    onChange={(e) => setSemanticList('tags', e.target.value)}
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
