// src/world/RoomScene.tsx

import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import { RoomCanvasRenderer, getTimeOfDayFromHour } from './RoomCanvas';
import { RoomHotspotId, RoomActivityOption, WeatherType } from './types';
import { getWeatherForDay } from '../engine/WeatherEngine';
import { WindowObservationModal } from './modals/WindowObservationModal';
import { BeverageModal } from './modals/BeverageModal';
import { DoorActionModal } from './modals/DoorActionModal';
import { SleepTransitionModal } from './modals/SleepTransitionModal';
import { getContextualWindowThought } from './data/windowThoughts';
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

  // Simulation Store selectors
  const time = useSimulationStore((s) => s.state.time);
  const player = useSimulationStore((s) => s.state.player);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const downloads = useSimulationStore((s) => s.state.downloads);
  const world = useSimulationStore((s) => s.state.world);

  const switchView = useSimulationStore((s) => s.switchView);
  const interactRoom = useSimulationStore((s) => s.interactRoom);
  const workShift = useSimulationStore((s) => s.workShift);
  const restOrSleep = useSimulationStore((s) => s.restOrSleep);
  const spendCash = useSimulationStore((s) => s.spendCash);
  const cityOuting = useSimulationStore((s) => s.cityOuting);

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
      case 'pc':
        switchView('pc');
        break;
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

  // Initialize and update Canvas Renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    // Set internal resolution
    canvas.width = 960;
    canvas.height = 540;

    const renderer = new RoomCanvasRenderer({
      canvas,
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      weather,
      osVersion: hardware.osVersion,
      hasActiveDownloads,
      onHotspotClick: handleHotspotClick,
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
        osVersion: hardware.osVersion,
        hasActiveDownloads,
      });
    }
  }, [time.day, time.hour, time.minute, weather, hardware.osVersion, hasActiveDownloads]);

  // Handle Beverage Selection (meal/grocery money is charged by the engine — never double-spend here)
  const handleSelectBeverage = (option: RoomActivityOption) => {
    if (option.cashCost && option.cashCost > 0 && option.actionType !== 'meal' && option.actionType !== 'groceries') {
      spendCash(option.cashCost, option.title);
    }
    if (option.actionType === 'tea' || option.actionType === 'coffee' || option.actionType === 'meal' || option.actionType === 'groceries') {
      interactRoom(option.actionType);
    }
  };

  // Handle Door Action Selection (outings resolve fully in the engine and report back)
  const handleSelectDoorAction = (option: RoomActivityOption) => {
    if (option.actionType === 'work') {
      workShift(option.durationMinutes, option.cashReward);
    } else if (option.actionType === 'diner' || option.actionType === 'outing') {
      const res = cityOuting(option.id) as unknown as { success: boolean; error?: string; data?: { summary?: string; rumor?: string } };
      if (res && (res as { success: boolean }).success) {
        const data = (res as { data?: { summary?: string; rumor?: string } }).data;
        flashOutingNotice([data?.summary, data?.rumor].filter(Boolean).join(' — ') || 'You head out and come back.');
        soundManager.play('door_open');
      } else {
        flashOutingNotice((res as { error?: string })?.error || 'You decide to stay in.');
      }
    } else if (option.actionType === 'cafe') {
      if (option.cashCost) spendCash(option.cashCost, 'Bus to Starlight Café');
      switchView('cafe');
    }
  };

  // Handle Bed Sleep
  const handleConfirmSleep = () => {
    restOrSleep(8);
  };

  // Get Window Observation data — sandbox uses world flags
  const windowData = getContextualWindowThought(time.day, timeOfDay, weather, world.flags);

  const formattedTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full bg-slate-950 flex flex-col select-none overflow-hidden font-sans">
      {/* Top Atmospheric HUD Bar */}
      <div className="z-30 h-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-200">
        {/* Left: Location & Time */}
        <div className="flex items-center gap-3">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <span>Motel Room 104</span>
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
            onClick={() => {
              soundManager.play('click');
              switchView('pc');
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded shadow transition-all cursor-pointer"
            title="Sit down at PC Desk"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Sit at PC</span>
          </button>
        </div>
      </div>

      {/* Main 2D Canvas Container */}
      <div className="flex-1 relative flex items-center justify-center p-2 bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full aspect-[16/9] shadow-2xl object-contain border border-slate-800 rounded"
        />
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
          day={time.day}
          playerCash={player.cash}
          playerEnergy={player.energy}
          isCafeScheduled={time.day >= 11 || !!world.flags?.maya_cafe_scheduled || world.triggeredEvents.some((e) => e.id === 'city_canal_festival' && e.isTriggered)}
          onSelectOption={handleSelectDoorAction}
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
