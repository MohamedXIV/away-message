// src/world/modals/SleepTransitionModal.tsx

import React, { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { Moon, Sun, BedDouble, ArrowRight, AlarmClock } from 'lucide-react';

interface SleepTransitionModalProps {
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  onConfirmSleep: (wakeHour: number, wakeMinute: number) => void;
  onClose: () => void;
}

type SleepMode = 'wake_at' | 'duration';

/** Shared sleep math (also used for the preview): given now + target, hours slept. */
export function computeSleepPlan(
  currentHour: number,
  currentMinute: number,
  mode: SleepMode,
  wakeHour: number,
  durationHours: number
): { hours: number; outHour: number; outMinute: number; outDayOffset: 0 | 1 } {
  const nowTotal = currentHour * 60 + currentMinute;
  if (mode === 'duration') {
    const dur = Math.max(0.5, Math.min(12, durationHours));
    const total = nowTotal + Math.round(dur * 60);
    const outDayOffset = total >= 24 * 60 ? 1 : 0;
    return {
      hours: dur,
      outHour: Math.floor((total % (24 * 60)) / 60),
      outMinute: total % 60,
      outDayOffset: outDayOffset as 0 | 1,
    };
  }
  const cleanHour = Math.max(0, Math.min(23, Math.floor(wakeHour) || 0));
  let delta = cleanHour * 60 - nowTotal;
  let outDayOffset: 0 | 1 = 0;
  if (delta <= 0) {
    delta += 24 * 60;
    outDayOffset = 1;
  }
  return { hours: delta / 60, outHour: cleanHour, outMinute: 0, outDayOffset };
}

export function sleepQualityNote(bedtimeHour: number, hours: number): string | null {
  if (bedtimeHour >= 2 && bedtimeHour < 6) return '⚠️ Crashing after 2am — rough night, half recovery, +sleep debt.';
  if (hours < 5) return 'Short nap — partial recovery, a little debt.';
  if (hours >= 6) return 'Full night — deep recovery, repays sleep debt.';
  return null;
}

export const SleepTransitionModal: React.FC<SleepTransitionModalProps> = ({
  currentDay,
  currentHour,
  currentMinute,
  onConfirmSleep,
  onClose,
}) => {
  const [isSleeping, setIsSleeping] = useState(false);
  const [mode, setMode] = useState<SleepMode>('wake_at');
  const [wakeHour, setWakeHour] = useState(8);
  const [durationHours, setDurationHours] = useState(8);

  const plan = computeSleepPlan(currentHour, currentMinute, mode, wakeHour, durationHours);
  const quality = sleepQualityNote(currentHour, plan.hours);
  const wakeLabel = `${String(plan.outHour).padStart(2, '0')}:${String(plan.outMinute).padStart(2, '0')}`;

  const handleSleep = () => {
    soundManager.play('click');
    setIsSleeping(true);

    setTimeout(() => {
      onConfirmSleep(plan.outHour, plan.outMinute);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-950 border-2 border-indigo-900 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Header */}
        <div className="bg-slate-900 px-4 py-2.5 border-b border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-sm text-slate-100">Rest & Sleep — Room 104</span>
          </div>
          <span className="text-xs text-indigo-300">Day {currentDay}</span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-center">
          {isSleeping ? (
            <div className="py-8 space-y-4">
              <Moon className="w-10 h-10 text-indigo-400 mx-auto animate-pulse" />
              <h3 className="font-bold text-indigo-200 text-lg">Sleeping...</h3>
              <p className="text-xs text-slate-400">
                Alarm set for {wakeLabel}. Advancing background downloads, character schedules, and restoring energy...
              </p>
              <div className="w-48 h-2 bg-slate-900 rounded-full overflow-hidden border border-indigo-900 mx-auto">
                <div className="h-full bg-indigo-500 animate-[pulse_1s_infinite] w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-indigo-950/60 rounded-full border border-indigo-800 flex items-center justify-center mx-auto text-indigo-400">
                <AlarmClock className="w-6 h-6" />
              </div>

              {/* Mode toggle */}
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => { soundManager.play('click'); setMode('wake_at'); }}
                  className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${mode === 'wake_at' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                >
                  Wake at…
                </button>
                <button
                  onClick={() => { soundManager.play('click'); setMode('duration'); }}
                  className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${mode === 'duration' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                >
                  Sleep… hours
                </button>
              </div>

              {mode === 'wake_at' ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-slate-400 text-xs">Alarm:</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={wakeHour}
                    onChange={(e) => setWakeHour(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                    className="w-16 px-2 py-1 bg-slate-900 border border-indigo-800 rounded text-center font-mono text-indigo-200 outline-none"
                  />
                  <span className="text-slate-400 text-xs">:00</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-slate-400 text-xs">Sleep:</span>
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={durationHours}
                    onChange={(e) => setDurationHours(Math.max(0.5, Math.min(12, Number(e.target.value) || 0.5)))}
                    className="w-16 px-2 py-1 bg-slate-900 border border-indigo-800 rounded text-center font-mono text-indigo-200 outline-none"
                  />
                  <span className="text-slate-400 text-xs">hours ⏰</span>
                </div>
              )}

              <div className="space-y-1">
                <h3 className="font-bold text-slate-100 text-base">
                  Sleep {plan.hours.toFixed(1)}h, wake {wakeLabel}{plan.outDayOffset ? ` (Day ${currentDay + 1})` : ' (today)'}?
                </h3>
                {quality && <p className="text-[11px] text-amber-300/90">{quality}</p>}
              </div>

              <div className="p-3 bg-slate-900/80 border border-indigo-950 rounded text-left space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Energy restores by sleep quality (late nights recover half).</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Background downloads and contact schedules will advance.</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Game state will be saved to IndexedDB.</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => {
                    soundManager.play('click');
                    onClose();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  Stay Awake
                </button>
                <button
                  onClick={handleSleep}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow-lg shadow-indigo-950 transition-all cursor-pointer"
                >
                  😴 Sleep
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
