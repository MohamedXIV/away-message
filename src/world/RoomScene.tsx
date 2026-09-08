// src/world/RoomScene.tsx

import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { resolvePcBootState } from '../engine/SimulationEngine';
import { soundManager } from '../audio/SoundManager';
import { RoomCanvasRenderer, getTimeOfDayFromHour } from './RoomCanvas';
import { getRoomDeskPresentation } from './RoomComputerPresentation';
import { RoomHotspotId, RoomActivityOption, WeatherType } from './types';
import { getWeatherForDay, isWetWeather } from '../engine/WeatherEngine';
import { CITY_NODES, type CityNodeId, type TravelMode } from '../engine/CityMap';
import { buddyWithRole } from '../engine/coreBuddies';
import { CityPlaceView } from './components/CityPlaceView';

function playerLocationLabel(location: CityNodeId): string {
  return CITY_NODES[location]?.name ?? location;
}
import { WindowObservationModal } from './modals/WindowObservationModal';
import { BeverageModal } from './modals/BeverageModal';
import { DoorActionModal } from './modals/DoorActionModal';
import { SleepTransitionModal } from './modals/SleepTransitionModal';
import { getContextualWindowThought, getStreetSighting } from './data/windowThoughts';
import {
  Monitor,
  CloudRain,
  Sun,
  DollarSign,
  Zap,
  Clock,
  BedDouble,
  DoorOpen,
} from 'lucide-react';

export const RoomScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RoomCanvasRenderer | null>(null);
  const hotspotClickRef = useRef<(id: RoomHotspotId) => void>(() => undefined);

  // Simulation Store selectors
  const time = useSimulationStore((s) => s.state.time);
  const player = useSimulationStore((s) => s.state.player);
  const computer = useSimulationStore((s) => s.state.computer);
  const inventory = useSimulationStore((s) => s.state.inventory);
  const os = useSimulationStore((s) => s.state.os);
  const osVersion = os.currentOsId;
  const downloads = useSimulationStore((s) => s.state.downloads);
  const world = useSimulationStore((s) => s.state.world);

  const switchView = useSimulationStore((s) => s.switchView);
  const interactRoom = useSimulationStore((s) => s.interactRoom);
  const restOrSleep = useSimulationStore((s) => s.restOrSleep);
  const spendCash = useSimulationStore((s) => s.spendCash);
  const applyGig = useSimulationStore((s) => s.applyGig);
  const setupComputerAtHome = useSimulationStore((s) => s.setupComputerAtHome);

  const pcBootState = resolvePcBootState({ computer, inventory, os });
  const deskPresentation = getRoomDeskPresentation(pcBootState);
  const assembledComputer = deskPresentation === 'assembled_off' || deskPresentation === 'assembled_on';

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    'window' | 'beverage' | 'door' | 'sleep' | null
  >(null);

  // Weather: live engine forecast mapped to the canvas vocabulary (was a hardcoded 3-day hack)
  const liveCondition = getWeatherForDay(time.day).condition;
  const weather: WeatherType =
    liveCondition === 'rain' || liveCondition === 'drizzle' || liveCondition === 'storm' ? 'rain'
    : liveCondition === 'overcast' || liveCondition === 'fog' ? 'cloudy'
    : 'clear';
  const timeOfDay = getTimeOfDayFromHour(time.hour);
  const hasActiveDownloads = downloads.some((d) => d.status === 'downloading');

  // Outing result notice (city outings report back: encounters, rumors, failures)
  const [outingNotice, setOutingNotice] = useState<string | null>(null);
  const outingNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashOutingNotice = (text: string) => {
    setOutingNotice(text);
    if (outingNoticeTimer.current) clearTimeout(outingNoticeTimer.current);
    outingNoticeTimer.current = setTimeout(() => setOutingNotice(null), 5200);
  };

  // Hotspot Click Handling
  const handleHotspotClick = (id: RoomHotspotId) => {
    soundManager.play('click');
    switch (id) {
      case 'pc': {
        if (pcBootState === 'no_computer') {
          flashOutingNotice("Empty desk. You don't have a computer yet! Check Silicon & Spares downtown (Door -> Tech Mart).");
          break;
        }
        if (pcBootState === 'awaiting_setup') {
          const result = setupComputerAtHome();
          flashOutingNotice(
            result.success
              ? 'Computer assembled and monitor connected. Setup took 15 minutes; the machine is still powered off.'
              : result.error ?? 'Could not set up the computer.',
          );
          break;
        }
        // Sitting down never powers the machine implicitly. The physical power
        // action lives in DesktopShell and routes through the synchronized store.
        switchView('pc');
        break;
      }
      case 'kettle':
        setActiveModal('beverage');
        break;
      case 'shower':
        interactRoom('shower');
        break;
      case 'window':
        interactRoom('window');
        setActiveModal('window');
        break;
      case 'bed':
        setActiveModal('sleep');
        break;
      case 'door':
        setActiveModal('door');
        break;
    }
  };
  hotspotClickRef.current = handleHotspotClick;

  // Initialize and update Canvas Renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    // Hi-DPI backing store: the renderer draws in relative 0..1 space, so a
    // bigger buffer only sharpens — CSS aspect-contain guarantees no stretching.
    canvas.width = 1600;
    canvas.height = 900;

    const renderer = new RoomCanvasRenderer({
      canvas,
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      weather,
      osVersion: deskPresentation === 'assembled_on' ? osVersion : null,
      hasActiveDownloads,
      hasComputer: assembledComputer,
      onHotspotClick: (id) => hotspotClickRef.current(id),
    });
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Sync simulation state to canvas renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateState({
        day: time.day,
        hour: time.hour,
        minute: time.minute,
        weather,
        osVersion: deskPresentation === 'assembled_on' ? osVersion : null,
        hasActiveDownloads,
        hasComputer: assembledComputer,
      });
    }
  }, [time.day, time.hour, time.minute, weather, osVersion, hasActiveDownloads, assembledComputer, deskPresentation]);

  // Handle Beverage Selection (meal/grocery money is charged by the engine — never double-spend here)
  const handleSelectBeverage = (option: RoomActivityOption) => {
    if (option.cashCost && option.cashCost > 0 && option.actionType !== 'meal' && option.actionType !== 'groceries') {
      spendCash(option.cashCost, option.title);
    }
    if (option.actionType === 'tea' || option.actionType === 'coffee' || option.actionType === 'meal' || option.actionType === 'groceries') {
      interactRoom(option.actionType);
    }
  };

  // P6 Job Board data (gigs + pending state, straight from the engine)
  const jobBoardEntries = (() => {
    try {
      const engine = useSimulationStore.getState().engine;
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
    } catch { return []; }
  })();

  const handleApplyGig = (gigId: string): string | null => {
    const res = applyGig(gigId) as unknown as { success: boolean; error?: string };
    if (res && res.success) {
      flashOutingNotice('Application sent — you will hear back on Pulse in a few hours.');
      return null;
    }
    const err = (res as { error?: string })?.error || 'Could not apply.';
    flashOutingNotice(err);
    return err;
  };

  // Handle Door Action Selection (outings resolve fully in the engine and report back)
  const dispatchTravel = (to: CityNodeId, mode: TravelMode): void => {
    try {
      const res = useSimulationStore.getState().dispatchAction({ type: 'TRAVEL_TO', to, mode }) as unknown as {
        success: boolean; error?: string; data?: { summary?: string; encounter?: string };
      };
      if (res && res.success) {
        const data = res.data ?? {};
        flashOutingNotice([data.summary, data.encounter].filter(Boolean).join(' — ') || 'You head out.');
        soundManager.play('door_open');
      } else {
        flashOutingNotice(res?.error || 'You decide to stay in.');
      }
    } catch {
      flashOutingNotice('You decide to stay in.');
    }
  };

  // P7 location chip for the HUD
  const playerLocation: CityNodeId = player.location ?? 'home';

  // Handle Bed Sleep (alarm: wake hour + minute from the modal)
  const handleConfirmSleep = (wakeHour: number, wakeMinute: number) => {
    restOrSleep(wakeHour, wakeMinute);
  };

  // Get Window Observation data — sandbox uses world flags
  const windowData = getContextualWindowThought(time.day, timeOfDay, weather, world.flags);
  // P6.5 live street sighting: who is visible out there right now (schedules made visible)
  const streetSighting = (() => {
    try {
      const engine = useSimulationStore.getState().engine;
      const sightBuddies = engine.social.getBuddies().map((b) => ({
        id: b.id,
        displayName: b.displayName,
        presenceStatus: engine.social.getPresence(b.id)?.status ?? 'offline',
        lifecycleStatus: b.status,
      }));
      return getStreetSighting(sightBuddies, timeOfDay, time.day);
    } catch { return null; }
  })();

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;

  // P7 away from home: the place screen replaces the room canvas
  if (playerLocation !== 'home') {
    return (
      <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
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

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Atmospheric HUD Bar */}
      <div className="z-30 h-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-200">
        {/* Left: Location & Time */}
        <div className="flex items-center gap-3">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <span>{playerLocation === 'home' ? 'Motel Room 104' : `📍 ${playerLocationLabel(playerLocation)}`}</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Day {time.day} • {formattedTime}</span>
            <span className="text-[11px] text-slate-400 capitalize">({timeOfDay.replace('_', ' ')})</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-700" />
          <div className="flex items-center gap-1 text-slate-400">
            {weather === 'rain' ? (
              <span className="flex items-center gap-1 text-sky-400">
                <CloudRain className="w-3.5 h-3.5" /> Rain
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300">
                <Sun className="w-3.5 h-3.5" /> Clear
              </span>
            )}
          </div>
        </div>

        {/* Center: Vitals (Cash & Energy) */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 font-mono font-bold text-green-400">
            <DollarSign className="w-3.5 h-3.5" />
            <span>${player.cash.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-300 font-mono text-[11px]">
              <Zap className="w-3 h-3" />
              <span>{player.energy}%</span>
            </div>
            <div className="w-16 h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-green-500 transition-all duration-300"
                style={{ width: `${player.energy}%` }}
              />
            </div>
            {/* P6.6 hunger at a glance (fills as hunger rises — eat something!) */}
            <div className="flex items-center gap-1 font-mono text-[11px]" title={`Hunger ${Math.round(player.hunger ?? 0)}%`}>
              <span>🍜</span>
              <div className="w-12 h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${(player.hunger ?? 0) >= 80 ? 'bg-red-500' : (player.hunger ?? 0) >= 55 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                  style={{ width: `${Math.min(100, Math.round(player.hunger ?? 0))}%` }}
                />
              </div>
            </div>
            {/* Social battery at a glance (introvert meter — talking spends it, solitude repays it) */}
            <div className="flex items-center gap-1 font-mono text-[11px]" title={`Social battery ${Math.round(player.socialBattery ?? 100)}% — bold talk costs extra`}>
              <span>💬</span>
              <div className="w-12 h-2 bg-slate-800 rounded-full border border-slate-700 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${(player.socialBattery ?? 100) <= 0 ? 'bg-red-500' : (player.socialBattery ?? 100) < 25 ? 'bg-amber-500' : 'bg-purple-500'}`}
                  style={{ width: `${Math.min(100, Math.round(player.socialBattery ?? 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundManager.play('click');
              setActiveModal('sleep');
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 rounded text-indigo-200 text-xs font-bold transition-colors cursor-pointer"
            title="Sleep until Morning (08:00)"
          >
            <BedDouble className="w-3.5 h-3.5" />
            <span>Sleep</span>
          </button>
          <button
            onClick={() => {
              soundManager.play('door_open');
              setActiveModal('door');
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            title="Go to Food Cart Work / Café"
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
          <button
            onClick={() => handleHotspotClick('pc')}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded shadow transition-all cursor-pointer"
            title={pcBootState === 'awaiting_setup' ? 'Set up the computer package' : 'Sit down at PC Desk'}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{pcBootState === 'awaiting_setup' ? 'Set Up PC' : 'Sit at PC'}</span>
          </button>
        </div>
      </div>

      {/* Main 2D Canvas Container */}
      <div className="flex-1 relative flex items-center justify-center p-2 bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full aspect-[16/9] shadow-2xl object-contain border border-slate-800 rounded"
        />
        <div className="absolute top-4 left-4 max-w-xs bg-slate-950/90 border border-slate-700 rounded px-3 py-2 text-[11px] text-slate-200 shadow-xl">
          {deskPresentation === 'empty' && <span>🪵 Desk: empty — no computer owned.</span>}
          {deskPresentation === 'package' && (
            <div className="flex items-center gap-2">
              <span>📦 Computer package waiting.</span>
              <button
                onClick={() => handleHotspotClick('pc')}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded cursor-pointer"
              >
                Set Up Computer · 15 min
              </button>
            </div>
          )}
          {deskPresentation === 'assembled_off' && <span>🖥️ Computer assembled — power off.</span>}
          {deskPresentation === 'assembled_on' && <span>🟢 Computer assembled — power on.</span>}
        </div>
        {outingNotice && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[90%] bg-slate-900/95 border border-amber-500/60 rounded px-3 py-1.5 text-[11px] text-amber-100 shadow-xl text-center">
            {outingNotice}
          </div>
        )}
      </div>

      {/* Modals */}
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
          playerLocation={player.location ?? 'home'}
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
          onConfirmSleep={handleConfirmSleep}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};