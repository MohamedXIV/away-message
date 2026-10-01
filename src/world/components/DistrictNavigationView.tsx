// src/world/components/DistrictNavigationView.tsx
// Scalable Town -> District -> Place/Stop navigation UI (#36).
// Presents one simulated town through authored districts without a flat icon cloud.
// Consumes pure TransitNetwork, TownKnowledge, and TravelChoicePresenter truth.

import React, { useState } from 'react';
import type { TransitNetwork } from '../../engine/transit/TransitNetwork';
import {
  type TownKnowledgeState,
  projectTownNavigation,
} from '../../engine/transit/TownKnowledge';
import {
  presentTravelChoices,
  type TravelChoicesPresentation,
} from '../../engine/transit/TravelChoicePresenter';
import type {
  DistrictId,
  PlaceId,
  TransitServiceState,
  TransitStopId,
  TravelPlan,
} from '../../engine/transit/types';
import { soundManager } from '../../audio/SoundManager';
import { MapPin, Bus, Footprints, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';

export interface DistrictNavigationViewProps {
  network: TransitNetwork;
  knowledge: TownKnowledgeState;
  currentPlaceId: PlaceId;
  departAtMinute: number;
  playerCash: number;
  playerEnergy: number;
  raining?: boolean;
  storming?: boolean;
  service?: TransitServiceState;
  onSelectDistrict?: (districtId: DistrictId) => void;
  onTravel?: (destinationPlaceId: PlaceId, mode: 'walk' | 'bus', plan?: TravelPlan) => void;
  onInspectStop?: (stopId: TransitStopId) => void;
  className?: string;
}

export const DistrictNavigationView: React.FC<DistrictNavigationViewProps> = ({
  network,
  knowledge,
  currentPlaceId,
  departAtMinute,
  playerCash,
  playerEnergy,
  raining = false,
  storming = false,
  service,
  onSelectDistrict,
  onTravel,
  onInspectStop,
  className = '',
}) => {
  const projection = projectTownNavigation(network, knowledge, currentPlaceId);
  const [selectedDistrictId, setSelectedDistrictId] = useState<DistrictId | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<PlaceId | null>(null);

  const selectedDistrict = selectedDistrictId
    ? projection.districts.find((d) => d.districtId === selectedDistrictId)
    : null;

  // Travel choices calculation when a destination place is picked
  const travelChoices: TravelChoicesPresentation | null =
    selectedPlaceId && selectedPlaceId !== currentPlaceId
      ? presentTravelChoices(network, {
          originPlaceId: currentPlaceId,
          destinationPlaceId: selectedPlaceId,
          departAtMinute,
          raining,
          service,
        })
      : null;

  const handleSelectDistrict = (districtId: DistrictId) => {
    soundManager.play('click');
    setSelectedDistrictId(districtId);
    setSelectedPlaceId(null);
    onSelectDistrict?.(districtId);
  };

  const handleBackToTown = () => {
    soundManager.play('click');
    setSelectedDistrictId(null);
    setSelectedPlaceId(null);
  };

  const handleSelectPlace = (placeId: PlaceId) => {
    soundManager.play('click');
    setSelectedPlaceId((prev) => (prev === placeId ? null : placeId));
  };

  return (
    <div className={`flex flex-col bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-sans select-none overflow-hidden ${className}`}>
      {/* Navigation Header / Breadcrumbs */}
      <div className="bg-slate-800/90 px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold">
          <span
            onClick={selectedDistrict ? handleBackToTown : undefined}
            className={`flex items-center gap-1 ${selectedDistrict ? 'text-amber-400 cursor-pointer hover:underline' : 'text-slate-100'}`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Town Directory
          </span>
          {selectedDistrict && (
            <>
              <span className="text-slate-500">/</span>
              <span className="text-slate-100">{selectedDistrict.name}</span>
            </>
          )}
        </div>
        {selectedDistrict && (
          <button
            onClick={handleBackToTown}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-700/60 hover:bg-slate-700 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Town Map
          </button>
        )}
      </div>

      <div className="p-3 space-y-3 overflow-y-auto max-h-[75vh]">
        {/* LEVEL 1: Town Map Overview */}
        {!selectedDistrict && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-snug">
              Known districts and transit connections in Oakhaven. Select a district to view local places and bus stops.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {projection.districts.map((district) => (
                <div
                  key={district.districtId}
                  onClick={() => handleSelectDistrict(district.districtId)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    district.isCurrent
                      ? 'border-amber-500/80 bg-slate-800/90 shadow-md ring-1 ring-amber-500/30'
                      : 'border-slate-700/80 bg-slate-800/40 hover:bg-slate-800/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-100">{district.name}</span>
                      {district.isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Current Area
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1">
                      {district.tags.map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {district.places.length} {district.places.length === 1 ? 'place' : 'places'} • {district.stops.length} {district.stops.length === 1 ? 'stop' : 'stops'}
                    </span>
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      Explore <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEVEL 2: District Detail View */}
        {selectedDistrict && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100">{selectedDistrict.name}</h3>
                {selectedDistrict.isCurrent && (
                  <span className="text-[10px] font-bold text-amber-300">● You are here</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {selectedDistrict.tags.map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Places in District */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Known Places
              </h4>
              <div className="space-y-1.5">
                {selectedDistrict.places.map((place) => {
                  const isSelected = selectedPlaceId === place.placeId;
                  const isHere = place.placeId === currentPlaceId;

                  return (
                    <div
                      key={place.placeId}
                      onClick={() => handleSelectPlace(place.placeId)}
                      className={`p-2 rounded border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 text-slate-100'
                          : isHere
                            ? 'border-slate-600 bg-slate-800/80 text-amber-200'
                            : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className={`w-3.5 h-3.5 ${isHere ? 'text-amber-400' : 'text-slate-400'}`} />
                        <span className="font-bold text-xs">{place.name}</span>
                        {isHere && (
                          <span className="text-[10px] text-amber-400 font-semibold">(here)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {place.hasTransitAccess ? '🚌 bus accessible' : '🚶 walking only'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transit Stops in District */}
            {selectedDistrict.stops.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Transit Stops
                </h4>
                <div className="space-y-1.5">
                  {selectedDistrict.stops.map((stop) => (
                    <div
                      key={stop.stopId}
                      className="p-2 rounded border border-slate-700/60 bg-slate-800/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Bus className="w-3.5 h-3.5 text-sky-400" />
                        <div>
                          <span className="font-bold text-xs text-slate-200">{stop.name}</span>
                          <div className="text-[10px] text-slate-400">
                            Lines: {stop.lineIds.join(', ')}
                          </div>
                        </div>
                      </div>
                      {onInspectStop && (
                        <button
                          onClick={() => {
                            soundManager.play('click');
                            onInspectStop(stop.stopId);
                          }}
                          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-bold text-slate-200 cursor-pointer"
                        >
                          View Stop
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LEVEL 3: Travel Choices UX */}
            {travelChoices && (
              <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-slate-800/90 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="font-bold text-slate-100 text-xs">
                    Travel to: {travelChoices.destinationPlaceName}
                  </span>
                  <button
                    onClick={() => setSelectedPlaceId(null)}
                    className="text-slate-400 hover:text-white text-[10px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Walk Option */}
                  <div className={`p-2.5 rounded border flex flex-col justify-between ${
                    travelChoices.walk.available
                      ? 'border-slate-600 bg-slate-700/40'
                      : 'border-slate-800 bg-slate-800/20 opacity-50'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
                        <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Walk</span>
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-emerald-400">
                        {travelChoices.walk.available ? travelChoices.walk.summary : 'Not walkable'}
                      </div>
                      {raining && travelChoices.walk.available && (
                        <div className="text-[10px] text-sky-300 mt-0.5">🌧️ rain slows walking ×1.25</div>
                      )}
                      {storming && (
                        <div className="text-[10px] text-red-300 mt-0.5">⛈️ storm warning in effect</div>
                      )}
                      {playerEnergy < 10 && travelChoices.walk.available && (
                        <div className="text-[10px] text-amber-300 mt-0.5">Too tired to walk (need 10% energy)</div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        soundManager.play('click');
                        onTravel?.(selectedPlaceId!, 'walk', travelChoices.walk.plan ?? undefined);
                      }}
                      disabled={!travelChoices.walk.available || playerEnergy < 10}
                      className={`mt-2 w-full py-1 rounded text-[11px] font-bold transition-all ${
                        travelChoices.walk.available && playerEnergy >= 10
                          ? 'bg-slate-200 hover:bg-white text-slate-900 cursor-pointer'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Walk There
                    </button>
                  </div>

                  {/* Bus Option */}
                  <div className={`p-2.5 rounded border flex flex-col justify-between ${
                    travelChoices.bus.available
                      ? 'border-slate-600 bg-slate-700/40'
                      : 'border-slate-800 bg-slate-800/20'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
                        <Bus className="w-3.5 h-3.5 text-sky-400" />
                        <span>Bus</span>
                      </div>

                      <div className={`mt-1 text-[11px] font-bold ${travelChoices.bus.available ? 'text-sky-300' : 'text-red-400'}`}>
                        {travelChoices.bus.summary}
                      </div>

                      {/* Conditions */}
                      {travelChoices.bus.conditions.note && (
                        <div className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{travelChoices.bus.conditions.note}</span>
                        </div>
                      )}

                      {/* Transfer summary */}
                      {travelChoices.bus.transferCount > 0 && (
                        <div className="text-[10px] text-slate-300 mt-1 italic leading-tight">
                          {travelChoices.bus.transferSummary}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        soundManager.play('click');
                        onTravel?.(selectedPlaceId!, 'bus', travelChoices.bus.plan ?? undefined);
                      }}
                      disabled={!travelChoices.bus.available || playerCash < travelChoices.bus.fare}
                      className={`mt-2 w-full py-1 rounded text-[11px] font-bold transition-all ${
                        travelChoices.bus.available && playerCash >= travelChoices.bus.fare
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Take Bus (${travelChoices.bus.fare.toFixed(2)})
                    </button>
                  </div>
                </div>

                {/* Itinerary steps breakdown for bus */}
                {travelChoices.bus.available && travelChoices.bus.itinerarySteps.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-400 space-y-0.5">
                    <span className="font-bold text-slate-300">Route itinerary:</span>
                    {travelChoices.bus.itinerarySteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-slate-500">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
