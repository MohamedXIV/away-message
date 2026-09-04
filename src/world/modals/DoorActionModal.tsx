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

function formatDuration(totalMin: number): string {
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h${m}m` : `${h}h`;
  }
  return `${totalMin}m`;
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
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-600 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 font-sans max-h-[88vh]">
        {/* Sticky header */}
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

        {/* Single scroll area: outings + job board */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-400">
            Step out into the motel corridor and head into the city for work, fresh air,
            or social appointments.
          </p>

          {/* Outings */}
          <div className="space-y-2">
            {DOOR_OPTIONS.map((opt) => {
              const isCafe = opt.actionType === 'cafe';
              const isAvailable = !isCafe || isCafeScheduled || day >= 11;
              const hasEnoughEnergy = opt.actionType !== 'work' || playerEnergy >= 25;
              const canAfford = !opt.cashCost || playerCash >= opt.cashCost;
              const openNow = isOptionOpen(opt, hour);
              const isEnabled = isAvailable && hasEnoughEnergy && canAfford && openNow;
              const closedReason = !openNow && opt.openHours
                ? `Closed — opens ${openHoursLabel(opt.openHours).split('–')[0]}`
                : !canAfford ? 'Not enough cash'
                : !hasEnoughEnergy ? 'Too tired'
                : !isAvailable ? 'Not scheduled'
                : null;
              return (
                <div
                  key={opt.id}
                  className={`p-3 border rounded transition-colors ${
                    isCafe && isAvailable
                      ? 'bg-amber-950/30 border-amber-500/60'
                      : 'bg-slate-800/80 border-slate-700'
                  } ${isEnabled ? 'hover:border-slate-500' : 'opacity-75'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl pt-0.5">{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-bold text-xs text-slate-100 truncate">{opt.title}</h4>
                          {isCafe && isAvailable && (
                            <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> Scheduled
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-amber-400 shrink-0">{formatDuration(opt.durationMinutes)}</span>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.description}</p>

                      <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 text-[11px] font-mono flex-wrap">
                        {opt.cashReward ? (
                          <span className="text-green-400 font-bold">+${opt.cashReward.toFixed(2)} Wages</span>
                        ) : null}
                        {opt.cashCost ? (
                          <span>Cost: <span className={canAfford ? 'text-slate-200' : 'text-red-400 font-bold'}>${opt.cashCost.toFixed(2)}</span></span>
                        ) : null}
                        <span className={opt.energyChange < 0 ? 'text-amber-400' : 'text-cyan-400'}>
                          {opt.energyChange > 0 ? `+${opt.energyChange}` : opt.energyChange} Energy
                        </span>
                        {opt.openHours ? (
                          <span className={`inline-flex items-center gap-1 ${openNow ? 'text-emerald-400' : 'text-red-400 font-bold'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${openNow ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {openNow ? `Open ${openHoursLabel(opt.openHours)}` : `Closed · ${openHoursLabel(opt.openHours)}`}
                          </span>
                        ) : null}
                      </div>
                      {closedReason && !isEnabled ? (
                        <div className="mt-1 text-[10px] text-red-300/90 italic">{closedReason}</div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => handleSelect(opt)}
                      disabled={!isEnabled}
                      className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 self-center transition-all ${
                        isEnabled
                          ? isCafe
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow cursor-pointer'
                            : 'bg-slate-200 hover:bg-white text-slate-950 shadow cursor-pointer'
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Go
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Job Board */}
          <div className="border-t border-slate-700 pt-3">
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
                  <div key={job.gigId} className="p-3 border rounded bg-slate-800/80 border-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl pt-0.5">📌</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-100 truncate">{job.title}</h4>
                          <span className="text-[11px] font-mono text-slate-300 shrink-0">{formatDuration(job.durationMin)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{job.blurb} <span className="text-slate-500">via {job.contactName}</span></p>
                        <div className="mt-1.5 flex items-center gap-x-3 gap-y-1 text-[11px] font-mono flex-wrap">
                          <span className="text-green-400 font-bold">+${job.pay.toFixed(2)}</span>
                          <span className={tooTired && !job.pending ? 'text-red-400 font-bold' : ''}>Needs {job.minEnergy}% energy</span>
                          {job.pending ? <span className="text-amber-300 font-bold">⏳ Applied — check Pulse…</span> : null}
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky footer: wallet + energy at a glance */}
        <div className="p-3 bg-slate-800/95 border-t border-slate-700 flex justify-between items-center text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-3 font-mono">
            <span>💵 <b className="text-green-400">${playerCash.toFixed(2)}</b></span>
            <span>⚡ <b className={playerEnergy < 25 ? 'text-red-400' : 'text-amber-300'}>{playerEnergy}%</b></span>
          </div>
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
      </div>
    </div>
  );
};
