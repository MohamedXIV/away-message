import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildLightProfileRow,
  buildAudioProfileRow,
  buildAmbientProfileRow,
} from '../profileAuthoring';
import { parseSemanticList, serializeSemanticList } from '../physicalDefinitionAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';

interface Props {
  studio: StudioStoreContext;
}

type ProfileSection = 'lightProfiles' | 'audioProfiles' | 'ambientProfiles';
type StudioRows = Record<string, Record<string, unknown>>;

const AUDIO_KINDS = ['ambience', 'sfx', 'music', 'other'] as const;

export const ProfilesTab: React.FC<Props> = ({ studio }) => {
  const [section, setSection] = useState<ProfileSection>('lightProfiles');
  const [selectedId, setSelectedId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const lights = (studio.tables['lightProfiles'] ?? {}) as StudioRows;
  const audios = (studio.tables['audioProfiles'] ?? {}) as StudioRows;
  const ambients = (studio.tables['ambientProfiles'] ?? {}) as StudioRows;
  const assets = (studio.tables['assets'] ?? {}) as StudioRows;

  const lightIds = useMemo(() => Object.keys(lights).sort(), [lights]);
  const audioIds = useMemo(() => Object.keys(audios).sort(), [audios]);
  const ambientIds = useMemo(() => Object.keys(ambients).sort(), [ambients]);
  const assetIds = useMemo(() => Object.keys(assets).sort(), [assets]);

  const currentIds =
    section === 'lightProfiles'
      ? lightIds
      : section === 'audioProfiles'
      ? audioIds
      : ambientIds;

  const currentRows =
    section === 'lightProfiles'
      ? lights
      : section === 'audioProfiles'
      ? audios
      : ambients;

  const activeId = selectedId && currentRows[selectedId] ? selectedId : currentIds[0] || '';
  const activeRow = currentRows[activeId];

  const clearCreate = () => {
    setNewId('');
    setNewName('');
    setError('');
  };


  const createRecord = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || currentRows[id]) {
      setError(`Enter a unique profile ID.`);
      return;
    }

    try {
      if (section === 'lightProfiles') {
        studio.setRow(
          'lightProfiles',
          id,
          buildLightProfileRow(newName || id, 'day', '#ffffff', 1),
        );
      } else if (section === 'audioProfiles') {
        studio.setRow(
          'audioProfiles',
          id,
          buildAudioProfileRow(
            newName || id,
            'ambience',
            '',
            0.6,
            assetIds,
          ),
        );
      } else {
        studio.setRow(
          'ambientProfiles',
          id,
          buildAmbientProfileRow(newName || id, 'clear', 'day', 0.5),
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

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Environmental Profiles
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'lightProfiles', label: 'Light' },
              { id: 'audioProfiles', label: 'Audio' },
              { id: 'ambientProfiles', label: 'Ambient' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSection(tab.id as ProfileSection);
                  setSelectedId('');
                  setError('');
                }}
                className={`rounded px-2 py-1.5 text-xs font-bold capitalize ${
                  section === tab.id
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-950/50 text-purple-300 hover:bg-purple-900/60'
                }`}
              >
                {tab.label}
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
            Add {section === 'lightProfiles' ? 'Light' : section === 'audioProfiles' ? 'Audio' : 'Ambient'} Profile
          </div>
          <input
            aria-label="New profile ID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <input
            aria-label="New profile name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />

          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button
            type="button"
            onClick={createRecord}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow"
          >
            Add Profile
          </button>
        </div>
      </aside>

      {/* Editor Detail */}
      <section className="flex-1 overflow-y-auto p-6">
        {activeRow ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeRow['name'] || activeId)}</h2>
              <div className="text-xs font-mono text-purple-400">Profile ID: @{activeId}</div>
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

              {section === 'lightProfiles' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Time of Day
                      <input
                        value={String(activeRow['timeOfDay'] ?? '')}
                        onChange={(e) => studio.setCell('lightProfiles', activeId, 'timeOfDay', e.target.value)}
                        placeholder="day / night / evening (optional)"
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="lightProfiles" rowId={activeId} field="timeOfDay" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Color Tint (#rrggbb)
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={String(activeRow['colorTint'] || '#ffffff')}
                          onChange={(e) => studio.setCell('lightProfiles', activeId, 'colorTint', e.target.value)}
                          className="h-9 w-12 rounded bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          value={String(activeRow['colorTint'] ?? '')}
                          onChange={(e) => studio.setCell('lightProfiles', activeId, 'colorTint', e.target.value)}
                          placeholder="#ffffff"
                          className="flex-1 rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                        />
                      </div>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="lightProfiles" rowId={activeId} field="colorTint" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Intensity (≥ 0)
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={Number(activeRow['intensity'] ?? 1)}
                        onChange={(e) => studio.setCell('lightProfiles', activeId, 'intensity', Number(e.target.value))}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="lightProfiles" rowId={activeId} field="intensity" />
                  </div>
                </>
              )}

              {section === 'audioProfiles' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Kind
                      <select
                        value={String(activeRow['kind'] ?? 'ambience')}
                        onChange={(e) => studio.setCell('audioProfiles', activeId, 'kind', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        {AUDIO_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="audioProfiles" rowId={activeId} field="kind" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Audio Asset
                      <select
                        value={String(activeRow['assetId'] ?? '')}
                        onChange={(e) => studio.setCell('audioProfiles', activeId, 'assetId', e.target.value)}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      >
                        <option value="">None / Synthesized audio</option>
                        {assetIds.map((id) => (
                          <option key={id} value={id}>
                            {String(assets[id]?.['name'] || id)} (@{id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="audioProfiles" rowId={activeId} field="assetId" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Mix Volume (0..1): {Number(activeRow['volume'] ?? 0.6).toFixed(2)}
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step="0.05"
                        value={Number(activeRow['volume'] ?? 0.6)}
                        onChange={(e) => studio.setCell('audioProfiles', activeId, 'volume', Number(e.target.value))}
                        className="mt-2 w-full accent-purple-500"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="audioProfiles" rowId={activeId} field="volume" />
                  </div>
                </>
              )}

              {section === 'ambientProfiles' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Weather Tag
                      <input
                        value={String(activeRow['weather'] ?? '')}
                        onChange={(e) => studio.setCell('ambientProfiles', activeId, 'weather', e.target.value)}
                        placeholder="clear / rain / overcast (optional)"
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="ambientProfiles" rowId={activeId} field="weather" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Time of Day
                      <input
                        value={String(activeRow['timeOfDay'] ?? '')}
                        onChange={(e) => studio.setCell('ambientProfiles', activeId, 'timeOfDay', e.target.value)}
                        placeholder="day / night / evening (optional)"
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white font-mono"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="ambientProfiles" rowId={activeId} field="timeOfDay" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-300">
                      Density (≥ 0)
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        value={Number(activeRow['density'] ?? 0.5)}
                        onChange={(e) => studio.setCell('ambientProfiles', activeId, 'density', Number(e.target.value))}
                        className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <FieldErrorDisplay allErrors={studio.validationErrors} table="ambientProfiles" rowId={activeId} field="density" />
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
            No profiles authored yet.
          </div>
        )}
      </section>
    </div>
  );
};
