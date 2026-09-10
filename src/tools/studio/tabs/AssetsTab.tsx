import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import { buildAssetRow } from '../assetAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';
import { TagListEditor } from '../components/TagListEditor';

interface Props {
  studio: StudioStoreContext;
}

type StudioRows = Record<string, Record<string, unknown>>;
const ASSET_KINDS = ['image', 'model', 'audio', 'other'] as const;

export const AssetsTab: React.FC<Props> = ({ studio }) => {
  const [selectedId, setSelectedId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<(typeof ASSET_KINDS)[number]>('image');
  const [newUri, setNewUri] = useState('');
  const [newNormalMapId, setNewNormalMapId] = useState('');
  const [error, setError] = useState('');

  const assets = (studio.tables['assets'] ?? {}) as StudioRows;
  const assetIds = useMemo(() => Object.keys(assets).sort(), [assets]);

  const activeId = selectedId && assets[selectedId] ? selectedId : assetIds[0] || '';
  const activeAsset = assets[activeId];

  // Candidates for normal-maps (must be other image assets)
  const normalMapCandidates = useMemo(
    () =>
      assetIds.filter(
        (id) => id !== activeId && String(assets[id]?.['kind'] ?? '') === 'image',
      ),
    [assetIds, activeId, assets],
  );

  const clearCreate = () => {
    setNewId('');
    setNewName('');
    setNewUri('');
    setNewNormalMapId('');
    setError('');
  };

  const createAsset = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || assets[id]) {
      setError('Enter a unique asset ID.');
      return;
    }
    try {
      studio.setRow(
        'assets',
        id,
        buildAssetRow(
          newName || id,
          newKind,
          newUri || `assets/world/${id}.png`,
          newNormalMapId,
          assetIds,
        ),
      );
      setSelectedId(id);
      clearCreate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create asset.');
    }
  };


  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      {/* Sidebar list */}
      <aside className="w-72 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820] flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold">
            World Assets ({assetIds.length})
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {assetIds.map((id) => {
            const row = assets[id];
            const kind = String(row?.['kind'] ?? 'image');
            return (
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
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">{String(row?.['name'] || id)}</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-950 font-mono text-purple-300 border border-purple-800/40">
                    {kind}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-purple-400 truncate">@{id}</div>
              </button>
            );
          })}
        </div>

        {/* Add Asset Form */}
        <div className="border-t border-purple-900/50 p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
            Add Asset
          </div>
          <input
            aria-label="New asset ID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <input
            aria-label="New asset name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Asset kind"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as (typeof ASSET_KINDS)[number])}
              className="rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
            >
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              aria-label="Asset URI"
              value={newUri}
              onChange={(e) => setNewUri(e.target.value)}
              placeholder="URI"
              className="rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white font-mono"
            />
          </div>

          {newKind === 'image' && assetIds.length > 0 && (
            <select
              aria-label="Optional normal-map asset"
              value={newNormalMapId}
              onChange={(e) => setNewNormalMapId(e.target.value)}
              className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="">No normal map</option>
              {normalMapCandidates.map((id) => (
                <option key={id} value={id}>
                  Normal: {String(assets[id]?.['name'] || id)}
                </option>
              ))}
            </select>
          )}

          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button
            type="button"
            onClick={createAsset}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow"
          >
            Add Asset
          </button>
        </div>
      </aside>

      {/* Editor Detail */}
      <section className="flex-1 overflow-y-auto p-6">
        {activeAsset ? (
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{String(activeAsset['name'] || activeId)}</h2>
                <div className="text-xs font-mono text-purple-400">Asset ID: @{activeId}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  studio.deleteRow('assets', activeId);
                  setSelectedId('');
                }}
                className="rounded bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 px-3 py-1 text-xs font-bold text-red-300"
              >
                Delete Asset
              </button>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table="assets" rowId={activeId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeAsset['name'] ?? '')}
                    onChange={(e) => studio.setCell('assets', activeId, 'name', e.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="assets" rowId={activeId} field="name" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  Kind
                  <select
                    value={String(activeAsset['kind'] ?? 'image')}
                    onChange={(e) => studio.setCell('assets', activeId, 'kind', e.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  >
                    {ASSET_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="assets" rowId={activeId} field="kind" />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Source URI
                  <input
                    value={String(activeAsset['uri'] ?? '')}
                    onChange={(e) => studio.setCell('assets', activeId, 'uri', e.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                    placeholder="assets/world/..."
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="assets" rowId={activeId} field="uri" />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Normal-Map Asset Reference (optional)
                  <select
                    value={String(activeAsset['normalMapAssetId'] ?? '')}
                    onChange={(e) => studio.setCell('assets', activeId, 'normalMapAssetId', e.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  >
                    <option value="">None / Standalone base asset</option>
                    {normalMapCandidates.map((id) => (
                      <option key={id} value={id}>
                        {String(assets[id]?.['name'] || id)} (@{id})
                      </option>
                    ))}
                  </select>
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="assets" rowId={activeId} field="normalMapAssetId" />
              </div>

              <div className="md:col-span-2">
                <TagListEditor
                  label="Tags"
                  tagsJson={activeAsset['tags']}
                  onChange={(nextJson) => studio.setCell('assets', activeId, 'tags', nextJson)}
                  placeholder="e.g. background, prop, night..."
                  fieldErrorDisplay={
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="assets" rowId={activeId} field="tags" />
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            No assets authored yet.
          </div>
        )}
      </section>
    </div>
  );
};
