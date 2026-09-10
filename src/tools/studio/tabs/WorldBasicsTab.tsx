import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { buildDistrictRow, buildPlaceRow, normalizeWorldContentId } from '../worldAuthoring';
import { parseTransitAccess, serializeTransitAccess } from '../transitAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';

interface Props {
  studio: StudioStoreContext;
}

type WorldSection = 'districts' | 'places';

type StudioRows = Record<string, Record<string, unknown>>;

export const WorldBasicsTab: React.FC<Props> = ({ studio }) => {
  const [section, setSection] = useState<WorldSection>('districts');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPlaceDistrictId, setNewPlaceDistrictId] = useState('');
  const [error, setError] = useState('');

  // Structured transit-access draft link
  const [draftAccessStopId, setDraftAccessStopId] = useState('');
  const [draftAccessWalkMinutes, setDraftAccessWalkMinutes] = useState(5);

  const districts = (studio.tables['districts'] ?? {}) as StudioRows;
  const places = (studio.tables['places'] ?? {}) as StudioRows;
  const transitStops = (studio.tables['transitStops'] ?? {}) as StudioRows;

  const districtIds = useMemo(() => Object.keys(districts).sort(), [districts]);
  const placeIds = useMemo(() => Object.keys(places).sort(), [places]);
  const stopIds = useMemo(() => Object.keys(transitStops).sort(), [transitStops]);

  const activeDistrictId = selectedDistrictId || districtIds[0] || '';
  const activePlaceId = selectedPlaceId || placeIds[0] || '';
  const activeDistrict = districts[activeDistrictId];
  const activePlace = places[activePlaceId];

  const activeTransitAccess = useMemo(
    () => parseTransitAccess(activePlace?.['transitAccess']),
    [activePlace?.['transitAccess']],
  );

  const resetCreateFields = () => {
    setNewId('');
    setNewName('');
    setError('');
  };

  const createDistrict = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || districts[id]) {
      setError('Enter a unique district ID.');
      return;
    }
    studio.setRow('districts', id, buildDistrictRow(newName || id));
    setSelectedDistrictId(id);
    resetCreateFields();
  };

  const createPlace = () => {
    const id = normalizeWorldContentId(newId);
    const districtId = newPlaceDistrictId || districtIds[0] || '';
    if (!id || places[id]) {
      setError('Enter a unique place ID.');
      return;
    }
    if (!districtId) {
      setError('Create a district before adding a place.');
      return;
    }
    try {
      studio.setRow('places', id, buildPlaceRow(newName || id, districtId, districtIds));
      setSelectedPlaceId(id);
      resetCreateFields();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create place.');
    }
  };

  const handleAddTransitAccess = () => {
    const stopId = draftAccessStopId || stopIds[0] || '';
    if (!stopId) return;
    const next = [...activeTransitAccess, { stopId, walkMinutes: Math.max(1, draftAccessWalkMinutes) }];
    studio.setCell('places', activePlaceId, 'transitAccess', serializeTransitAccess(next));
    setDraftAccessStopId('');
  };

  const handleUpdateWalkMinutes = (index: number, minutes: number) => {
    const next = [...activeTransitAccess];
    if (!next[index]) return;
    next[index] = { ...next[index]!, walkMinutes: Math.max(1, minutes) };
    studio.setCell('places', activePlaceId, 'transitAccess', serializeTransitAccess(next));
  };

  const handleRemoveTransitAccess = (index: number) => {
    const next = activeTransitAccess.filter((_, idx) => idx !== index);
    studio.setCell('places', activePlaceId, 'transitAccess', serializeTransitAccess(next));
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      <aside className="w-72 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Living World
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(['districts', 'places'] as WorldSection[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSection(id);
                  resetCreateFields();
                }}
                className={`rounded px-2 py-1.5 text-xs font-bold capitalize ${
                  section === id
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-950/50 text-purple-300 hover:bg-purple-900/60'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(section === 'districts' ? districtIds : placeIds).map((id) => {
            const row = section === 'districts' ? districts[id] : places[id];
            const selected = section === 'districts' ? id === activeDistrictId : id === activePlaceId;

            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  section === 'districts' ? setSelectedDistrictId(id) : setSelectedPlaceId(id)
                }
                className={`w-full rounded border p-2.5 text-left ${
                  selected
                    ? 'border-purple-500/60 bg-purple-900/50 text-white'
                    : 'border-transparent text-gray-300 hover:bg-purple-950/40'
                }`}
              >
                <div className="text-xs font-bold truncate">{String(row?.['name'] || id)}</div>
                <div className="text-[10px] font-mono text-purple-400 truncate">@{id}</div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-purple-900/50 p-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">
            Add {section === 'districts' ? 'district' : 'place'}
          </div>
          <input
            aria-label="New world record ID"
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          <input
            aria-label="New world record name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          {section === 'places' && (
            <select
              aria-label="Place district"
              value={newPlaceDistrictId || districtIds[0] || ''}
              onChange={(event) => setNewPlaceDistrictId(event.target.value)}
              className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
            >
              {districtIds.map((id) => (
                <option key={id} value={id}>
                  {String(districts[id]?.['name'] || id)}
                </option>
              ))}
            </select>
          )}
          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button
            type="button"
            onClick={section === 'districts' ? createDistrict : createPlace}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            Add {section === 'districts' ? 'District' : 'Place'}
          </button>
        </div>
      </aside>

      <section className="flex-1 overflow-y-auto p-6">
        {section === 'districts' && activeDistrict ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeDistrict['name'] || activeDistrictId)}</h2>
              <div className="text-xs font-mono text-purple-400">District ID: @{activeDistrictId}</div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table="districts" rowId={activeDistrictId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeDistrict['name'] ?? '')}
                    onChange={(event) => studio.setCell('districts', activeDistrictId, 'name', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="districts" rowId={activeDistrictId} field="name" />
              </div>

              {(['mapX', 'mapY'] as const).map((cell) => (
                <div key={cell}>
                  <label className="text-xs font-bold text-purple-300">
                    {cell}
                    <input
                      type="number"
                      value={Number(activeDistrict[cell] ?? 0)}
                      onChange={(event) => studio.setCell('districts', activeDistrictId, cell, Number(event.target.value))}
                      className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <FieldErrorDisplay allErrors={studio.validationErrors} table="districts" rowId={activeDistrictId} field={cell} />
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Tags (JSON)
                  <input
                    value={String(activeDistrict['tags'] ?? '[]')}
                    onChange={(event) => studio.setCell('districts', activeDistrictId, 'tags', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 font-mono text-xs text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="districts" rowId={activeDistrictId} field="tags" />
              </div>
            </div>
          </div>
        ) : section === 'places' && activePlace ? (
          <div className="max-w-3xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activePlace['name'] || activePlaceId)}</h2>
              <div className="text-xs font-mono text-purple-400">Place ID: @{activePlaceId}</div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table="places" rowId={activePlaceId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activePlace['name'] ?? '')}
                    onChange={(event) => studio.setCell('places', activePlaceId, 'name', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="places" rowId={activePlaceId} field="name" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  District
                  <select
                    value={String(activePlace['districtId'] ?? '')}
                    onChange={(event) => studio.setCell('places', activePlaceId, 'districtId', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  >
                    {districtIds.map((id) => (
                      <option key={id} value={id}>
                        {String(districts[id]?.['name'] || id)}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="places" rowId={activePlaceId} field="districtId" />
              </div>

              {/* Transit Access Links */}
              <div className="md:col-span-2 space-y-3 rounded-lg border border-purple-900/60 bg-[#140b26] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Transit Access (Walk Links)
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Nearby transit stops and authored walking time in minutes.
                    </p>
                  </div>
                </div>

                <FieldErrorDisplay allErrors={studio.validationErrors} table="places" rowId={activePlaceId} field="transitAccess" />

                {activeTransitAccess.length > 0 ? (
                  <div className="space-y-2">
                    {activeTransitAccess.map((link, idx) => (
                      <div
                        key={`${link.stopId}-${idx}`}
                        className="flex items-center gap-3 rounded border border-purple-900/40 bg-[#100820] p-2"
                      >
                        <div className="flex-1 text-xs text-white">
                          <span className="font-semibold text-purple-200">
                            {String(transitStops[link.stopId]?.['name'] || link.stopId)}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-purple-400">@{link.stopId}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-purple-300">
                          <input
                            aria-label={`Walk minutes for ${link.stopId}`}
                            type="number"
                            min={1}
                            value={link.walkMinutes}
                            onChange={(e) => handleUpdateWalkMinutes(idx, Number(e.target.value))}
                            className="w-16 rounded bg-[#0d0718] border border-purple-800/60 px-2 py-1 text-xs text-white font-mono"
                          />
                          <span className="text-gray-400">min walk</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTransitAccess(idx)}
                          className="rounded bg-red-950/60 hover:bg-red-900/60 px-2 py-1 text-[11px] font-bold text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">No transit access links authored for this place.</div>
                )}

                {/* Add Link Control */}
                {stopIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-900/40">
                    <select
                      aria-label="Select stop to link"
                      value={draftAccessStopId || stopIds[0] || ''}
                      onChange={(e) => setDraftAccessStopId(e.target.value)}
                      className="rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1 text-xs text-white"
                    >
                      {stopIds.map((id) => (
                        <option key={id} value={id}>
                          {String(transitStops[id]?.['name'] || id)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="New link walk minutes"
                        type="number"
                        min={1}
                        value={draftAccessWalkMinutes}
                        onChange={(e) => setDraftAccessWalkMinutes(Math.max(1, Number(e.target.value)))}
                        className="w-16 rounded bg-[#0d0718] border border-purple-800/60 px-2 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-xs text-gray-400">min walk</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTransitAccess}
                      className="rounded bg-purple-700 hover:bg-purple-600 px-2.5 py-1 text-xs font-bold text-white shadow"
                    >
                      + Link Stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            {section === 'places' && districtIds.length === 0
              ? 'Create a district first, then add places.'
              : `No ${section} authored yet.`}
          </div>
        )}
      </section>
    </div>
  );
};

