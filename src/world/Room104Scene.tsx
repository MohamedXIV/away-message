import React, { useCallback, useMemo, useRef, useState } from 'react';
import { resolvePcBootState } from '../engine/SimulationEngine';
import {
  getRoom104StorageContents,
  getRoom104StoragePresence,
  getRoom104WorldAnchorPresence,
  type Room104StorageTarget,
} from '../engine/Room104Physical';
import type { CityNodeId, TravelMode } from '../engine/CityMap';
import { buddyWithRole } from '../engine/coreBuddies';
import { getWeatherForDay, isWetWeather } from '../engine/WeatherEngine';
import { soundManager } from '../audio/SoundManager';
import { useSimulationStore } from '../store/useSimulationStore';
import { getRoomDeskPresentation } from './RoomComputerPresentation';
import type { RoomActivityOption, TimeOfDay, WeatherType } from './types';
import { CityPlaceView } from './components/CityPlaceView';
import { WindowObservationModal } from './modals/WindowObservationModal';
import { BeverageModal } from './modals/BeverageModal';
import { DoorActionModal } from './modals/DoorActionModal';
import { SleepTransitionModal } from './modals/SleepTransitionModal';
import { HardwareWorkbenchModal } from './modals/HardwareWorkbenchModal';
import { getContextualWindowThought, getStreetSighting } from './data/windowThoughts';
import { ROOM104_VIEW_IDS } from './data/room104AuthoredContent';
import { createWorldSceneProjection } from './phaser/presentationAdapter';
import type { WorldInteractionIntent } from './phaser/types';
import { routeRoom104Intent } from './room104IntentRouter';
import { buildRoom104StorageMarkers } from './room104StoragePresentation';
import { buildRoom104WorldAnchorMarkers } from './room104WorldAnchorPresentation';

const PhysicalWorldHost = React.lazy(() =>
  import('./phaser/PhysicalWorldHost').then((module) => ({ default: module.PhysicalWorldHost })),
);

type ActiveModal = 'window' | 'beverage' | 'door' | 'sleep' | 'hardware' | null;

function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'evening';
  if (hour >= 21 || hour < 2) return 'night';
  return 'late_night';
}

function roomWeather(day: number): WeatherType {
  const condition = getWeatherForDay(day).condition;
  if (condition === 'rain' || condition === 'drizzle' || condition === 'storm') return 'rain';
  if (condition === 'overcast' || condition === 'fog') return 'cloudy';
  return 'clear';
}

export const Room104Scene: React.FC = () => {
  const engine = useSimulationStore((state) => state.engine);
  const syncStateFromEngine = useSimulationStore((state) => state.syncStateFromEngine);
  const time = useSimulationStore((state) => state.state.time);
  const player = useSimulationStore((state) => state.state.player);
  const computer = useSimulationStore((state) => state.state.computer);
  const inventory = useSimulationStore((state) => state.state.inventory);
  const os = useSimulationStore((state) => state.state.os);
  const world = useSimulationStore((state) => state.state.world);

  const switchView = useSimulationStore((state) => state.switchView);
  const interactRoom = useSimulationStore((state) => state.interactRoom);
  const restOrSleep = useSimulationStore((state) => state.restOrSleep);
  const spendCash = useSimulationStore((state) => state.spendCash);
  const applyGig = useSimulationStore((state) => state.applyGig);
  const setupComputerAtHome = useSimulationStore((state) => state.setupComputerAtHome);

  const [currentViewId, setCurrentViewId] = useState<string>(ROOM104_VIEW_IDS.deskWindow);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pcBootState = resolvePcBootState({ computer, inventory, os });
  const deskPresentation = getRoomDeskPresentation(pcBootState);
  const weather = roomWeather(time.day);
  const timeOfDay = timeOfDayFromHour(time.hour);
  const playerLocation: CityNodeId = player.location ?? 'home';

  const flashNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5200);
  }, []);

  const projection = useMemo(() => createWorldSceneProjection({
    placeId: 'room_104',
    viewId: currentViewId,
    timeOfDay,
    minuteOfDay: time.hour * 60 + time.minute,
    weather,
    isInterior: true,
    windIntensity: weather === 'rain' ? 0.15 : 0.05,
  }), [currentViewId, timeOfDay, time.hour, time.minute, weather]);

  const physicalWorld = engine.getPhysicalWorldState();
  const storagePresence = getRoom104StoragePresence(physicalWorld);
  const storageMarkers = buildRoom104StorageMarkers(projection, storagePresence);
  const worldAnchorPresence = getRoom104WorldAnchorPresence(physicalWorld);
  const worldAnchorMarkers = buildRoom104WorldAnchorMarkers(projection, worldAnchorPresence);

  const handleComputer = useCallback(() => {
    soundManager.play('click');
    if (pcBootState === 'no_computer') {
      flashNotice("Empty desk. You don't own a computer yet; Silicon & Spares sells physical systems and parts.");
      return;
    }
    if (pcBootState === 'awaiting_setup') {
      const result = setupComputerAtHome();
      flashNotice(
        result.success
          ? 'Computer assembled and monitor connected. Setup took 15 minutes; power remains off.'
          : result.error ?? 'Could not set up the computer.',
      );
      return;
    }
    switchView('pc');
  }, [flashNotice, pcBootState, setupComputerAtHome, switchView]);

  const inspectStorage = useCallback((storage: Room104StorageTarget) => {
    const labels = {
      desk: 'Desk storage',
      wardrobe: 'Wardrobe',
      bedside: 'Bedside storage',
      kitchen: 'Kitchen storage',
    } as const;

    try {
      const items = getRoom104StorageContents(engine.getPhysicalWorldState(), storage);
      if (items.length === 0) {
        flashNotice(`${labels[storage]} is empty.`);
        return;
      }

      const identities = items.map((item) => item.definitionId).join(', ');
      flashNotice(
        `${labels[storage]}: ${items.length} item${items.length === 1 ? '' : 's'} — ${identities}`,
      );
    } catch {
      flashNotice(`${labels[storage]} could not be inspected.`);
    }
  }, [engine, flashNotice]);

  const inspectDeliveryAnchor = useCallback(() => {
    try {
      const physical = engine.getPhysicalWorldState();
      const parcels = Object.values(physical.items).filter((item) =>
        item.location.kind === 'worldAnchor'
        && item.location.anchorId === 'room104:delivery'
      );
      flashNotice(
        parcels.length > 0
          ? `${parcels.length} delivered parcel${parcels.length === 1 ? '' : 's'} waiting by the entrance.`
          : 'Nothing has been delivered to Room 104 right now.',
      );
    } catch {
      flashNotice('Delivery spot is empty.');
    }
  }, [engine, flashNotice]);

  const handleWorldIntent = useCallback((intent: WorldInteractionIntent) => {
    const route = routeRoom104Intent(intent);
    switch (route.kind) {
      case 'view':
        if (projection.availableViews.some((view) => view.id === route.targetViewId)) {
          setCurrentViewId(route.targetViewId);
        }
        return;
      case 'computer':
        handleComputer();
        return;
      case 'room-action':
        interactRoom(route.activity);
        if (route.modal) setActiveModal(route.modal);
        return;
      case 'modal':
        setActiveModal(route.modal);
        return;
      case 'inspect-storage':
        inspectStorage(route.storage);
        return;
      case 'inspect-delivery':
        inspectDeliveryAnchor();
        return;
      case 'none':
      default:
        return;
    }
  }, [handleComputer, inspectDeliveryAnchor, inspectStorage, interactRoom, projection.availableViews]);

  const handleSelectBeverage = (option: RoomActivityOption) => {
    if (
      option.cashCost
      && option.cashCost > 0
      && option.actionType !== 'meal'
      && option.actionType !== 'groceries'
    ) {
      spendCash(option.cashCost, option.title);
    }
    if (
      option.actionType === 'tea'
      || option.actionType === 'coffee'
      || option.actionType === 'meal'
      || option.actionType === 'groceries'
    ) {
      interactRoom(option.actionType);
    }
  };

  const jobBoardEntries = (() => {
    try {
      return engine.getJobBoard().map(({ gig, pending }) => {
        const holder = buddyWithRole(gig.contactRole);
        const contact = holder ? engine.social.getBuddy(holder.id) : undefined;
        return {
          gigId: gig.id,
          title: gig.title,
          blurb: gig.blurb,
          pay: gig.pay,
          durationMin: gig.durationMin,
          minEnergy: gig.minEnergy,
          contactName: contact?.displayName ?? gig.contactRole,
          pending,
        };
      });
    } catch {
      return [];
    }
  })();

  const handleApplyGig = (gigId: string): string | null => {
    const result = applyGig(gigId) as unknown as { success: boolean; error?: string };
    if (result?.success) {
      flashNotice('Application sent — you will hear back on Pulse in a few hours.');
      return null;
    }
    const error = result?.error ?? 'Could not apply.';
    flashNotice(error);
    return error;
  };

  const dispatchTravel = (to: CityNodeId, mode: TravelMode): void => {
    try {
      const result = useSimulationStore.getState().dispatchAction({ type: 'TRAVEL_TO', to, mode }) as unknown as {
        success: boolean;
        error?: string;
        data?: { summary?: string; encounter?: string };
      };
      if (result?.success) {
        const message = [result.data?.summary, result.data?.encounter].filter(Boolean).join(' — ');
        flashNotice(message || 'You head out.');
        soundManager.play('door_open');
        setActiveModal(null);
      } else {
        flashNotice(result?.error ?? 'You decide to stay in.');
      }
    } catch {
      flashNotice('You decide to stay in.');
    }
  };

  const windowData = getContextualWindowThought(time.day, timeOfDay, weather, world.flags);
  const streetSighting = (() => {
    try {
      const buddies = engine.social.getBuddies().map((buddy) => ({
        id: buddy.id,
        displayName: buddy.displayName,
        presenceStatus: engine.social.getPresence(buddy.id)?.status ?? 'offline',
        lifecycleStatus: buddy.status,
      }));
      return getStreetSighting(buddies, timeOfDay, time.day);
    } catch {
      return null;
    }
  })();

  if (playerLocation !== 'home') {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-950 font-sans">
        <CityPlaceView location={playerLocation} onOpenMap={() => setActiveModal('door')} />
        {activeModal === 'door' && (
          <DoorActionModal
            hour={time.hour}
            playerCash={player.cash}
            playerEnergy={player.energy}
            playerLocation={playerLocation}
            raining={isWetWeather(getWeatherForDay(time.day).condition)}
            storming={getWeatherForDay(time.day).condition === 'storm'}
            jobs={jobBoardEntries}
            onApplyGig={handleApplyGig}
            onTravel={dispatchTravel}
            onClose={() => setActiveModal(null)}
          />
        )}
      </div>
    );
  }

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
  const currentView = projection.availableViews.find((view) => view.id === currentViewId);
  const neighborIds = currentView?.neighbors ?? [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-black font-sans text-slate-100">
      <React.Suspense
        fallback={(
          <div className="flex h-full w-full items-center justify-center bg-black text-sm font-bold tracking-widest text-amber-300">
            INITIALIZING ROOM 104…
          </div>
        )}
      >
        <PhysicalWorldHost
          projection={projection}
          debug={false}
          onIntent={handleWorldIntent}
          overlaySlot={(
            <div className="pointer-events-none absolute inset-0">
              <div className="pointer-events-auto absolute left-3 top-3 rounded border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm">
                <div className="font-bold text-amber-300">Motel Room 104 · {projection.viewName}</div>
                <div className="mt-1 text-slate-300">Day {time.day} · {formattedTime} · {weather}</div>
                <div className="mt-1 text-slate-400">${player.cash.toFixed(2)} · Energy {player.energy}%</div>
              </div>

              <div className="pointer-events-auto absolute right-3 top-3 max-w-xs rounded border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm">
                {deskPresentation === 'empty' && 'Desk: empty — no computer owned.'}
                {deskPresentation === 'package' && (
                  <button
                    type="button"
                    onClick={handleComputer}
                    className="rounded bg-amber-500 px-2 py-1 font-bold text-slate-950"
                  >
                    Set up computer · 15 min
                  </button>
                )}
                {deskPresentation === 'assembled_off' && 'Computer assembled — power off.'}
                {deskPresentation === 'assembled_on' && 'Computer assembled — power on.'}
              </div>

              {storageMarkers.map((marker) => (
                <button
                  key={marker.anchorId}
                  type="button"
                  onClick={() => inspectStorage(marker.target)}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/60 bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-amber-100 shadow-lg backdrop-blur-sm hover:border-amber-300 hover:bg-slate-900"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                  }}
                  title={marker.itemDefinitionIds.length > 0 ? marker.itemDefinitionIds.join(', ') : 'Empty storage'}
                >
                  {marker.itemCount}
                </button>
              ))}

              {worldAnchorMarkers.map((marker) => (
                <button
                  key={marker.physicalAnchorId}
                  type="button"
                  onClick={inspectDeliveryAnchor}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded border border-sky-400/70 bg-slate-950/90 px-2 py-1 text-[10px] font-semibold text-sky-100 shadow-lg backdrop-blur-sm hover:border-sky-300 hover:bg-slate-900"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                  }}
                  title={marker.itemDefinitionIds.join(', ')}
                >
                  Parcel {marker.itemCount > 1 ? `×${marker.itemCount}` : ''}
                </button>
              ))}

              <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded border border-slate-700/80 bg-slate-950/90 p-1.5 shadow-xl backdrop-blur-sm">
                {neighborIds.map((viewId) => {
                  const view = projection.availableViews.find((candidate) => candidate.id === viewId);
                  if (!view) return null;
                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setCurrentViewId(view.id)}
                      className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:border-amber-500/70 hover:text-amber-200"
                    >
                      {view.name}
                    </button>
                  );
                })}
                {(deskPresentation === 'assembled_off' || deskPresentation === 'assembled_on') && (
                  <button
                    type="button"
                    onClick={() => setActiveModal('hardware')}
                    className="rounded border border-amber-800/80 bg-stone-900 px-3 py-1.5 text-[11px] font-bold text-amber-100"
                  >
                    Hardware
                  </button>
                )}
              </div>

              {notice && (
                <div className="absolute bottom-16 left-1/2 max-w-[90%] -translate-x-1/2 rounded border border-amber-500/60 bg-slate-950/95 px-3 py-2 text-center text-[11px] text-amber-100 shadow-xl">
                  {notice}
                </div>
              )}
            </div>
          )}
        />
      </React.Suspense>

      {activeModal === 'window' && (
        <WindowObservationModal
          day={time.day}
          timeOfDay={timeOfDay}
          weather={weather}
          thoughtText={windowData.thought}
          entity={windowData.entity}
          mood={windowData.mood}
          sighting={streetSighting}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'beverage' && (
        <BeverageModal
          playerCash={player.cash}
          onSelectOption={handleSelectBeverage}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'door' && (
        <DoorActionModal
          hour={time.hour}
          playerCash={player.cash}
          playerEnergy={player.energy}
          playerLocation={playerLocation}
          raining={isWetWeather(getWeatherForDay(time.day).condition)}
          storming={getWeatherForDay(time.day).condition === 'storm'}
          jobs={jobBoardEntries}
          onApplyGig={handleApplyGig}
          onTravel={dispatchTravel}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'sleep' && (
        <SleepTransitionModal
          currentDay={time.day}
          currentHour={time.hour}
          currentMinute={time.minute}
          onConfirmSleep={(wakeHour, wakeMinute) => restOrSleep(wakeHour, wakeMinute)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'hardware' && (
        <HardwareWorkbenchModal
          engine={engine}
          onStateChanged={syncStateFromEngine}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};

export default Room104Scene;
