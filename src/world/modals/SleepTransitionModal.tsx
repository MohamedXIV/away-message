// src/world/modals/SleepTransitionModal.tsx

import React, { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { Moon, Sun, BedDouble, ArrowRight } from 'lucide-react';

interface SleepTransitionModalProps {
  currentDay: number;
  currentHour: number;
  currentMinute: number;
  onConfirmSleep: () => void;
  onClose: () => void;
}

export const SleepTransitionModal: React.FC<SleepTransitionModalProps> = ({
  currentDay,
  currentHour,
  currentMinute,
  onConfirmSleep,
  onClose,
}) => {
  const [isSleeping, setIsSleeping] = useState(false);

  // Compute sleep hours (to 08:00 next day)
  let sleepHours = 0;
  if (currentHour < 8) {
    sleepHours = (8 - currentHour) - currentMinute / 60;
  } else {
    sleepHours = (24 - currentHour + 8) - currentMinute / 60;
  }
  const formattedHours = sleepHours.toFixed(1);

  const handleSleep = () => {
    soundManager.play('click');
    setIsSleeping(true);

    setTimeout(() => {
      onConfirmSleep();
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
                Advancing background downloads, character schedules, and restoring energy to 100%...
              </p>
              <div className="w-48 h-2 bg-slate-900 rounded-full overflow-hidden border border-indigo-900 mx-auto">
                <div className="h-full bg-indigo-500 animate-[pulse_1s_infinite] w-full" />
              </div>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-indigo-950/60 rounded-full border border-indigo-800 flex items-center justify-center mx-auto text-indigo-400">
                <Moon className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-100 text-base">Go to sleep until 08:00 AM?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Turn off the desk lamp and rest in bed. You will sleep for approx{' '}
                  <span className="text-indigo-300 font-bold">{formattedHours} hours</span> until Morning of Day{' '}
                  <span className="text-indigo-300 font-bold">{currentHour >= 8 ? currentDay + 1 : currentDay}</span>.
                </p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-indigo-950 rounded text-left space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Energy will be fully restored to <strong>100%</strong>.</span>
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
                  Sleep until Morning
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
