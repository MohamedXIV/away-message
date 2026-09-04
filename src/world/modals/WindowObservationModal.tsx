// src/world/modals/WindowObservationModal.tsx

import React from 'react';
import { TimeOfDay, WeatherType, PersistentStreetEntity } from '../types';
import { soundManager } from '../../audio/SoundManager';
import { Eye, CloudRain, Sun, Moon, ArrowLeft } from 'lucide-react';

interface WindowObservationModalProps {
  day: number;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  thoughtText: string;
  entity: PersistentStreetEntity | null;
  mood: string;
  onClose: () => void;
  // P6.5 live street sighting (who is visible out there right now)
  sighting?: string | null;
}

export const WindowObservationModal: React.FC<WindowObservationModalProps> = ({
  day,
  timeOfDay,
  weather,
  thoughtText,
  entity,
  mood,
  onClose,
  sighting = null,
}) => {
  const getWeatherIcon = () => {
    if (weather === 'rain') return <CloudRain className="w-4 h-4 text-blue-400" />;
    if (timeOfDay === 'night' || timeOfDay === 'late_night') return <Moon className="w-4 h-4 text-indigo-300" />;
    return <Sun className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border-2 border-slate-600 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Header */}
        <div className="bg-slate-800 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-slate-100">Window Observation — Room 104</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {getWeatherIcon()}
            <span className="capitalize">{timeOfDay.replace('_', ' ')} • Day {day}</span>
          </div>
        </div>

        {/* Cinematic Panoramic View Frame */}
        <div className="relative h-44 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-slate-700 flex items-center justify-center overflow-hidden">
          {/* Subtle animated rain/light streaks */}
          {weather === 'rain' && (
            <div className="absolute inset-0 bg-[radial-gradient(#60a5fa_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
          )}

          <div className="text-center px-8 z-10">
            <p className="text-amber-200/90 font-serif italic text-base leading-relaxed tracking-wide drop-shadow-md">
              "{thoughtText}"
            </p>
            {sighting && (
              <p className="mt-2 text-[11px] text-sky-300/90 italic">
                👀 {sighting}
              </p>
            )}
            <div className="mt-2 text-xs font-mono text-slate-400 uppercase tracking-widest">
              — Mood: {mood}
            </div>
          </div>
        </div>

        {/* Persistent Entity Detail Card */}
        {entity && (
          <div className="p-4 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-800 rounded border border-slate-700 text-amber-400 text-lg">
                📍
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">{entity.name}</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{entity.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer / Actions */}
        <div className="p-3 bg-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Observation consumed 4 minutes.</span>
          <button
            onClick={() => {
              soundManager.play('click');
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded shadow transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Step Back from Window</span>
          </button>
        </div>
      </div>
    </div>
  );
};
