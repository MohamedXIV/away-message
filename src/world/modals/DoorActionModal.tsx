// src/world/modals/DoorActionModal.tsx

import React from 'react';
import { DOOR_OPTIONS, isOptionOpen, openHoursLabel } from '../data/roomInteractables';
import { RoomActivityOption } from '../types';
import { soundManager } from '../../audio/SoundManager';
import { DoorOpen, X, Sparkles, Briefcase } from 'lucide-react';

export interface JobBoardEntry {
  gigId: string;
  title: string;
  blurb: string;
  pay: number;
  durationMin: number;
  minEnergy: number;
  contactName: string;
  pending: boolean;
}

interface DoorActionModalProps {
  day: number;
  hour: number;
  playerCash: number;
  playerEnergy: number;
  isCafeScheduled: boolean;
  jobs: JobBoardEntry[];
  onApplyGig: (gigId: string) => string | null;
  onSelectOption: (option: RoomActivityOption) => void;
  onClose: () => void;
}

export const DoorActionModal: React.FC<DoorActionModalProps> = ({
  day,
  hour,
  playerCash,
  playerEnergy,
  isCafeScheduled,
  jobs,
  onApplyGig,
  onSelectOption,
  onClose,
}) => {
  const handleSelect = (option: RoomActivityOption) => {
    soundManager.play('door_open');
    onSelectOption(option);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-600 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-800 px-4 py-2.5 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-slate-100">Leave Room 104</span>
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
        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-400">
            Step out into the motel corridor and head into the city for work, fresh air, or social appointments.
          </p>

          <div className="space-y-2 pt-1">
            {DOOR_OPTIONS.map((opt) => {
              // Special check for cafe option
              const isCafe = opt.actionType === 'cafe';
              const isAvailable = !isCafe || isCafeScheduled || day >= 11;
              const hasEnoughEnergy = opt.actionType !== 'work' || playerEnergy >= 25;
              const canAfford = !opt.cashCost || playerCash >= opt.cashCost;
              // P6 the city keeps time — closed places show their hours
              const openNow = isOptionOpen(opt, hour);
              const isEnabled = isAvailable && hasEnoughEnergy && canAfford && openNow;

              return (
                <div
                  key={opt.id}
                  className={`p-3 border rounded flex items-start gap-3 transition-colors ${
                    isCafe && isAvailable
                      ? 'bg-amber-950/30 border-amber-500/60 hover:bg-amber-950/50'
                      : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="text-2xl pt-0.5">{opt.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-slate-100">{opt.title}</h4>
                        {isCafe && isAvailable && (
                          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Scheduled
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-amber-400">
                        {opt.durationMinutes >= 60 ? `${opt.durationMinutes / 60}h` : `${opt.durationMinutes}m`}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.description}</p>

                    <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono text-slate-300">
                      {opt.cashReward && (
                        <span className="text-green-400 font-bold">+${opt.cashReward.toFixed(2)} Wages</span>
                      )}
                      {opt.cashCost && (
                        <span>Cost: <span className={canAfford ? 'text-slate-200' : 'text-red-400'}>${opt.cashCost.toFixed(2)}</span></span>
                      )}
                      <span className={opt.energyChange < 0 ? 'text-amber-400' : 'text-cyan-400'}>
                        {opt.energyChange > 0 ? `+${opt.energyChange}` : opt.energyChange} Energy
                      </span>
                      {opt.openHours && (
                        <span className={openNow ? 'text-slate-400' : 'text-red-400 font-bold'}>
                          {openNow ? `Open ${openHoursLabel(opt.openHours)}` : `Closed — opens ${openHoursLabel(opt.openHours).split('–')[0]}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelect(opt)}
                    disabled={!isEnabled}
                    className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 self-center transition-all cursor-pointer ${
                      isEnabled
                        ? isCafe
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                          : 'bg-slate-200 hover:bg-white text-slate-950 shadow'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Go
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
          <span>Current Energy: {playerEnergy}%</span>
          <button
            onClick={() => {
              soundManager.play('click');
              onClose();
            }}
            className="px-3 py-1 text-slate-300 hover:text-white cursor-pointer"
          >
            Stay in Room
          </button>
        </div>

        {/* P6 Job Board — apply now, hear back in a few hours (never instant) */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-sm text-slate-100">Job Board</span>
            <span className="text-[10px] text-slate-400">apply today • reply in 4–10h on Pulse</span>
          </div>
          <div className="space-y-2 pt-1">
            {jobs.map((job) => {
              const tooTired = playerEnergy < job.minEnergy;
              const disabled = job.pending || tooTired;
              return (
                <div key={job.gigId} className="p-3 border rounded flex items-start gap-3 bg-slate-800/80 border-slate-700">
                  <div className="text-2xl pt-0.5">📌</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-100">{job.title}</h4>
                      <span className="text-[11px] font-mono text-slate-300">{Math.floor(job.durationMin / 60)}h{job.durationMin % 60 ? `${job.durationMin % 60}m` : ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{job.blurb} <span className="text-slate-500">via {job.contactName}</span></p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono text-slate-300">
                      <span className="text-green-400 font-bold">+${job.pay.toFixed(2)}</span>
                      <span className={tooTired ? 'text-red-400 font-bold' : ''}>Needs {job.minEnergy}% energy</span>
                      {job.pending && <span className="text-amber-300 font-bold">⏳ Applied — waiting to hear back…</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const err = onApplyGig(job.gigId);
                      soundManager.play(err ? 'click' : 'door_open');
                    }}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 self-center transition-all ${disabled ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow cursor-pointer'}`}
                  >
                    {job.pending ? 'Applied' : 'Apply'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
