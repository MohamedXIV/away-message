// src/world/modals/BeverageModal.tsx

import React, { useState } from 'react';
import { BEVERAGE_OPTIONS } from '../data/roomInteractables';
import { RoomActivityOption } from '../types';
import { soundManager } from '../../audio/SoundManager';
import { Coffee, Flame, X } from 'lucide-react';

interface BeverageModalProps {
  playerCash: number;
  onSelectOption: (option: RoomActivityOption) => void;
  onClose: () => void;
}

export const BeverageModal: React.FC<BeverageModalProps> = ({
  playerCash,
  onSelectOption,
  onClose,
}) => {
  const [brewingItem, setBrewingItem] = useState<RoomActivityOption | null>(null);

  const handleBrew = (option: RoomActivityOption) => {
    soundManager.play('click');
    setBrewingItem(option);

    setTimeout(() => {
      onSelectOption(option);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-2 border-amber-600/60 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans">
        {/* Header */}
        <div className="bg-slate-800 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-slate-100">Motel Kitchenette & Kettle</span>
          </div>
          <button
            onClick={() => {
              soundManager.play('click');
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {brewingItem ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <Flame className="w-8 h-8 text-amber-500 animate-bounce" />
              <h3 className="font-bold text-amber-300 text-sm">Preparing {brewingItem.title}...</h3>
              <p className="text-xs text-slate-400">Boiling kettle water & steeping ({brewingItem.durationMinutes} min)...</p>
              <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-2">
                <div className="h-full bg-amber-500 animate-[pulse_1s_infinite] w-full" />
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Boil water in the electric kettle to restore energy and take a brief break from your computer.
              </p>

              <div className="space-y-2 pt-1">
                {BEVERAGE_OPTIONS.map((opt) => {
                  const canAfford = !opt.cashCost || playerCash >= opt.cashCost;

                  return (
                    <div
                      key={opt.id}
                      className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded flex items-start gap-3 transition-colors"
                    >
                      <div className="text-2xl pt-0.5">{opt.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-slate-100">{opt.title}</h4>
                          <span className="text-[11px] font-mono text-amber-400">
                            +{opt.energyChange} Energy • {opt.durationMinutes}m
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.description}</p>
                        {opt.cashCost && (
                          <div className="mt-1 text-[11px] font-mono text-slate-300">
                            Cost: <span className={canAfford ? 'text-green-400' : 'text-red-400 font-bold'}>${opt.cashCost.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleBrew(opt)}
                        disabled={!canAfford}
                        className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 self-center transition-all cursor-pointer ${
                          canAfford
                            ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Prepare
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
          <span>Available Cash: ${playerCash.toFixed(2)}</span>
          <button
            onClick={() => {
              soundManager.play('click');
              onClose();
            }}
            className="px-3 py-1 text-slate-300 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
