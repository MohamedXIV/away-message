import React, { useMemo, useState } from 'react';
import type { StudioStoreContext } from '../hooks/useStudioStore';
import { minuteToTimeStr } from '../types';
import { normalizeWorldContentId } from '../worldAuthoring';
import {
  buildBusLineRow,
  buildTransitStopRow,
  parseNumberList,
  parseStringList,
  resizeSegmentMinutes,
  reorderBusLineStops,
} from '../transitAuthoring';
import { FieldErrorDisplay, RowErrorBanner } from '../components/FieldErrorDisplay';


interface Props {
  studio: StudioStoreContext;
}

type Rows = Record<string, Record<string, unknown>>;
type Section = 'stops' | 'lines';

export const TransitTab: React.FC<Props> = ({ studio }) => {
  const [section, setSection] = useState<Section>('stops');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [selectedLineId, setSelectedLineId] = useState('');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDistrictId, setNewDistrictId] = useState('');
  const [newPlaceId, setNewPlaceId] = useState('');
  const [lineDraftStops, setLineDraftStops] = useState<string[]>([]);
  const [error, setError] = useState('');

  const districts = (studio.tables['districts'] ?? {}) as Rows;
  const places = (studio.tables['places'] ?? {}) as Rows;
  const stops = (studio.tables['transitStops'] ?? {}) as Rows;
  const lines = (studio.tables['busLines'] ?? {}) as Rows;

  const districtIds = useMemo(() => Object.keys(districts).sort(), [districts]);
  const stopIds = useMemo(() => Object.keys(stops).sort(), [stops]);
  const lineIds = useMemo(() => Object.keys(lines).sort(), [lines]);
  const activeStopId = selectedStopId || stopIds[0] || '';
  const activeLineId = selectedLineId || lineIds[0] || '';
  const activeStop = stops[activeStopId];
  const activeLine = lines[activeLineId];

  const placesForDistrict = (districtId: string) =>
    Object.keys(places)
      .filter((id) => String(places[id]?.['districtId'] ?? '') === districtId)
      .sort();

  const clearCreate = () => {
    setNewId('');
    setNewName('');
    setNewPlaceId('');
    setLineDraftStops([]);
    setError('');
  };

  const createStop = () => {
    const id = normalizeWorldContentId(newId);
    const districtId = newDistrictId || districtIds[0] || '';
    if (!id || stops[id]) {
      setError('Enter a unique transit-stop ID.');
      return;
    }
    try {
      studio.setRow(
        'transitStops',
        id,
        buildTransitStopRow(newName || id, districtId, newPlaceId, districtIds, places),
      );
      setSelectedStopId(id);
      clearCreate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create stop.');
    }
  };

  const createLine = () => {
    const id = normalizeWorldContentId(newId);
    if (!id || lines[id]) {
      setError('Enter a unique bus-line ID.');
      return;
    }
    try {
      studio.setRow('busLines', id, buildBusLineRow(newName || id, lineDraftStops, stopIds));
      setSelectedLineId(id);
      clearCreate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create bus line.');
    }
  };

  const setLineStops = (nextStops: string[]) => {
    if (!activeLineId) return;
    const currentSegments = parseNumberList(activeLine?.['segmentMinutes']);
    studio.setCell('busLines', activeLineId, 'stopIds', JSON.stringify(nextStops));
    studio.setCell(
      'busLines',
      activeLineId,
      'segmentMinutes',
      JSON.stringify(resizeSegmentMinutes(currentSegments, nextStops.length)),
    );
  };

  const activeLineStops = parseStringList(activeLine?.['stopIds']);
  const activeSegments = resizeSegmentMinutes(
    parseNumberList(activeLine?.['segmentMinutes']),
    activeLineStops.length,
  );

  return (
    <div className="flex h-full overflow-hidden bg-[#0d0718]">
      <aside className="w-80 shrink-0 border-r border-purple-900/60 bg-[#140b26] flex flex-col">
        <div className="p-3 border-b border-purple-900/50 bg-[#100820]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-purple-400 font-bold mb-2">
            Transit Network
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(['stops', 'lines'] as Section[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSection(id);
                  clearCreate();
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
          {(section === 'stops' ? stopIds : lineIds).map((id) => {
            const row = section === 'stops' ? stops[id] : lines[id];
            const selected = section === 'stops' ? id === activeStopId : id === activeLineId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => (section === 'stops' ? setSelectedStopId(id) : setSelectedLineId(id))}
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
            Add {section === 'stops' ? 'stop' : 'line'}
          </div>
          <input
            value={newId}
            onChange={(event) => setNewId(event.target.value)}
            placeholder="stable_id"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Display name"
            className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
          />

          {section === 'stops' ? (
            <>
              <select
                value={newDistrictId || districtIds[0] || ''}
                onChange={(event) => {
                  setNewDistrictId(event.target.value);
                  setNewPlaceId('');
                }}
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
              >
                {districtIds.map((id) => (
                  <option key={id} value={id}>{String(districts[id]?.['name'] || id)}</option>
                ))}
              </select>
              <select
                value={newPlaceId}
                onChange={(event) => setNewPlaceId(event.target.value)}
                className="w-full rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">No linked place</option>
                {placesForDistrict(newDistrictId || districtIds[0] || '').map((id) => (
                  <option key={id} value={id}>{String(places[id]?.['name'] || id)}</option>
                ))}
              </select>
            </>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] text-purple-400">Choose at least two stops in service order.</div>
              {stopIds.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="checkbox"
                    checked={lineDraftStops.includes(id)}
                    onChange={(event) =>
                      setLineDraftStops((current) =>
                        event.target.checked ? [...current, id] : current.filter((value) => value !== id),
                      )
                    }
                  />
                  {String(stops[id]?.['name'] || id)}
                </label>
              ))}
            </div>
          )}

          {error && <div className="text-[11px] text-red-300">{error}</div>}
          <button
            type="button"
            onClick={section === 'stops' ? createStop : createLine}
            className="w-full rounded bg-purple-700 hover:bg-purple-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            Add {section === 'stops' ? 'Stop' : 'Line'}
          </button>
        </div>
      </aside>

      <section className="flex-1 overflow-y-auto p-6">
        {section === 'stops' && activeStop ? (
          <div className="max-w-4xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeStop['name'] || activeStopId)}</h2>
              <div className="text-xs font-mono text-purple-400">Transit stop: @{activeStopId}</div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table="transitStops" rowId={activeStopId} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeStop['name'] ?? '')}
                    onChange={(event) => studio.setCell('transitStops', activeStopId, 'name', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="transitStops" rowId={activeStopId} field="name" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  District
                  <select
                    value={String(activeStop['districtId'] ?? '')}
                    onChange={(event) => {
                      studio.setCell('transitStops', activeStopId, 'districtId', event.target.value);
                      studio.setCell('transitStops', activeStopId, 'placeId', '');
                    }}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  >
                    {districtIds.map((id) => (
                      <option key={id} value={id}>
                        {String(districts[id]?.['name'] || id)}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="transitStops" rowId={activeStopId} field="districtId" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  Linked place
                  <select
                    value={String(activeStop['placeId'] ?? '')}
                    onChange={(event) => studio.setCell('transitStops', activeStopId, 'placeId', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  >
                    <option value="">No linked place</option>
                    {placesForDistrict(String(activeStop['districtId'] ?? '')).map((id) => (
                      <option key={id} value={id}>
                        {String(places[id]?.['name'] || id)}
                      </option>
                    ))}
                  </select>
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="transitStops" rowId={activeStopId} field="placeId" />
              </div>

              {(['mapX', 'mapY'] as const).map((cell) => (
                <div key={cell}>
                  <label className="text-xs font-bold text-purple-300">
                    {cell}
                    <input
                      type="number"
                      value={Number(activeStop[cell] ?? 0)}
                      onChange={(event) => studio.setCell('transitStops', activeStopId, cell, Number(event.target.value))}
                      className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <FieldErrorDisplay allErrors={studio.validationErrors} table="transitStops" rowId={activeStopId} field={cell} />
                </div>
              ))}
            </div>
          </div>
        ) : section === 'lines' && activeLine ? (
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">{String(activeLine['name'] || activeLineId)}</h2>
              <div className="text-xs font-mono text-purple-400">Bus line: @{activeLineId}</div>
            </div>

            <RowErrorBanner allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-2">
                <label className="text-xs font-bold text-purple-300">
                  Name
                  <input
                    value={String(activeLine['name'] ?? '')}
                    onChange={(event) => studio.setCell('busLines', activeLineId, 'name', event.target.value)}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field="name" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  Headway (minutes)
                  <input
                    type="number"
                    min={1}
                    value={Number(activeLine['headwayMinutes'] ?? 20)}
                    onChange={(event) => studio.setCell('busLines', activeLineId, 'headwayMinutes', Number(event.target.value))}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field="headwayMinutes" />
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300">
                  Fare
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={Number(activeLine['fare'] ?? 2)}
                    onChange={(event) => studio.setCell('busLines', activeLineId, 'fare', Number(event.target.value))}
                    className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field="fare" />
              </div>

              {(['serviceStartMinute', 'serviceEndMinute'] as const).map((cell) => (
                <div key={cell}>
                  <label className="text-xs font-bold text-purple-300">
                    {cell === 'serviceStartMinute' ? 'Service starts' : 'Service ends'}
                    <input
                      type="number"
                      min={0}
                      max={1439}
                      value={Number(activeLine[cell] ?? 0)}
                      onChange={(event) => studio.setCell('busLines', activeLineId, cell, Number(event.target.value))}
                      className="mt-1 w-full rounded bg-[#130d24] border border-purple-800/60 px-3 py-2 text-sm text-white"
                    />
                    <div className="mt-1 text-[10px] text-gray-400 font-mono">{minuteToTimeStr(Number(activeLine[cell] ?? 0))}</div>
                  </label>
                  <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field={cell} />
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-purple-900/50 bg-[#140b26] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">Ordered stop sequence</h3>
                  <p className="text-[11px] text-gray-400">
                    {activeLineStops.length} stops &middot; {Math.max(0, activeLineStops.length - 1)} segments. Reordering preserves adjacent segment mapping.
                  </p>
                </div>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value && !activeLineStops.includes(event.target.value)) {
                      setLineStops([...activeLineStops, event.target.value]);
                    }
                  }}
                  className="rounded bg-[#0d0718] border border-purple-800/60 px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">+ Add stop</option>
                  {stopIds.filter((id) => !activeLineStops.includes(id)).map((id) => (
                    <option key={id} value={id}>
                      {String(stops[id]?.['name'] || id)}
                    </option>
                  ))}
                </select>
              </div>

              <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field="stopIds" />
              <FieldErrorDisplay allErrors={studio.validationErrors} table="busLines" rowId={activeLineId} field="segmentMinutes" />

              <div className="space-y-1">
                {activeLineStops.map((stopId, index) => (
                  <React.Fragment key={`${stopId}-${index}`}>
                    <div className="flex items-center gap-2 rounded border border-purple-900/60 bg-[#100820] p-2">
                      <span className="w-6 text-center text-xs font-mono text-purple-400 font-bold">{index + 1}</span>
                      <span className="flex-1 text-xs text-white font-semibold">
                        {String(stops[stopId]?.['name'] || stopId)}
                      </span>
                      <span className="text-[10px] font-mono text-purple-400 mr-2">@{stopId}</span>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          const result = reorderBusLineStops(activeLineStops, activeSegments, index, index - 1);
                          studio.setCell('busLines', activeLineId, 'stopIds', JSON.stringify(result.stops));
                          studio.setCell('busLines', activeLineId, 'segmentMinutes', JSON.stringify(result.segments));
                        }}
                        className="px-2 py-1 text-xs rounded bg-purple-950 disabled:opacity-30 hover:bg-purple-900 text-purple-200"
                      >
                        ▲ Up
                      </button>
                      <button
                        type="button"
                        disabled={index === activeLineStops.length - 1}
                        onClick={() => {
                          const result = reorderBusLineStops(activeLineStops, activeSegments, index, index + 1);
                          studio.setCell('busLines', activeLineId, 'stopIds', JSON.stringify(result.stops));
                          studio.setCell('busLines', activeLineId, 'segmentMinutes', JSON.stringify(result.segments));
                        }}
                        className="px-2 py-1 text-xs rounded bg-purple-950 disabled:opacity-30 hover:bg-purple-900 text-purple-200"
                      >
                        ▼ Down
                      </button>
                      <button
                        type="button"
                        onClick={() => setLineStops(activeLineStops.filter((_, stopIndex) => stopIndex !== index))}
                        className="px-2 py-1 text-xs rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 font-bold"
                      >
                        Remove
                      </button>
                    </div>

                    {index < activeLineStops.length - 1 && (
                      <div className="flex items-center gap-2 pl-8 py-1">
                        <div className="w-0.5 h-6 bg-purple-600/60 ml-2.5" />
                        <div className="flex items-center gap-2 rounded bg-[#0b0514] border border-purple-800/40 px-3 py-1 text-xs text-purple-300">
                          <span className="text-purple-400 font-mono text-[11px]">↓ Segment ride:</span>
                          <input
                            aria-label={`Segment duration between stop ${index + 1} and stop ${index + 2}`}
                            type="number"
                            min={1}
                            value={activeSegments[index] ?? 10}
                            onChange={(event) => {
                              const next = [...activeSegments];
                              next[index] = Math.max(1, Number(event.target.value));
                              studio.setCell('busLines', activeLineId, 'segmentMinutes', JSON.stringify(next));
                            }}
                            className="w-16 rounded bg-[#130d24] border border-purple-700/60 px-2 py-0.5 text-xs text-white font-mono text-center"
                          />
                          <span className="text-gray-400 font-mono">min</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            {section === 'lines' && stopIds.length < 2
              ? 'Create at least two transit stops before adding a bus line.'
              : `No ${section} authored yet.`}
          </div>
        )}
      </section>
    </div>
  );
};

