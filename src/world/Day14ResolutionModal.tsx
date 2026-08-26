// src/world/Day14ResolutionModal.tsx

import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import {
  Award,
  Download,
  Play,
  RotateCcw,
  Monitor,
  Users,
  DollarSign,
  Coffee,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

interface Day14ResolutionModalProps {
  onContinueFreePlay: () => void;
  onRestartGame?: () => void;
}

export const Day14ResolutionModal: React.FC<Day14ResolutionModalProps> = ({
  onContinueFreePlay,
  onRestartGame,
}) => {
  const simState = useSimulationStore((s) => s.state);
  const time = simState.time;
  const player = simState.player;
  const hardware = simState.hardware;
  const installedSoftware = simState.installedSoftware;
  const social = simState.social;
  const narrative = simState.narrative;
  const telemetry = simState.telemetry;

  // Extract metrics
  const cashEarned = telemetry.stats?.totalMoneyEarned ?? 0;
  const foodCartShifts = telemetry.stats?.workShiftsCompleted ?? 0;
  const windowObservations = telemetry.stats?.windowObservationsCount ?? 0;
  const isMayaMetInPerson = !!narrative.flags?.maya_met_in_person;
  const mayaRel = social.relationships?.starlight_maya;
  const ryanRel = social.relationships?.ryan_foodcart;
  const noraRel = social.relationships?.NightOwl87;

  const isOs6 = hardware.osVersion === 'Orion_6.0';
  const hasMaxRam = hardware.ramMB >= 1024;
  const hasFastNet = hardware.connectionType === 'dsl_1m' || hardware.connectionType === 'dsl_512k';

  // Export Telemetry to JSON
  const handleExportTelemetry = () => {
    soundManager.play('click');
    const telemetryData = {
      game: 'Away Message',
      evaluationPeriod: '14 Days (336 in-game hours)',
      completedAt: new Date().toISOString(),
      finalGameTime: time,
      playerSummary: {
        finalCash: player.cash,
        totalCashEarned: cashEarned,
        shiftsWorked: foodCartShifts,
        rentDueDay: player.rentDueDay,
      },
      computerSpecs: {
        osVersion: hardware.osVersion,
        ramMB: hardware.ramMB,
        connectionType: hardware.connectionType,
        installedAppsCount: installedSoftware.length,
        installedApps: installedSoftware.map((a) => a.appId),
      },
      socialMilestones: {
        mayaMetInPerson: isMayaMetInPerson,
        buddies: {
          maya: mayaRel,
          ryan: ryanRel,
          nora: noraRel,
        },
      },
      narrativeFlags: narrative.flags,
      rawTelemetryStats: telemetry.stats,
    };

    const blob = new Blob([JSON.stringify(telemetryData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `away_message_14day_evaluation_day${time.day}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none overflow-y-auto animate-in fade-in duration-300 font-sans">
      <div className="w-full max-w-3xl bg-slate-900 border-2 border-amber-500/80 rounded-lg shadow-2xl overflow-hidden flex flex-col text-slate-200 my-auto">
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 px-6 py-4 border-b-2 border-amber-500/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 rounded-full border border-amber-400/50 text-amber-400">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                ★ CERTIFICATE OF COMPLETION ★
              </div>
              <h2 className="text-xl font-bold text-slate-100 tracking-wide">
                AWAY MESSAGE — 14-DAY EVALUATION COMPLETE
              </h2>
            </div>
          </div>
          <div className="text-right text-xs font-mono text-slate-400">
            <div className="text-amber-300 font-bold">DAY {time.day} REACHED</div>
            <div>336 In-Game Hours</div>
          </div>
        </div>

        {/* Evaluation Summary Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Narrative Verdict Banner */}
          <div className="p-4 bg-slate-950/80 border border-amber-500/40 rounded-lg text-center space-y-1">
            <p className="font-serif italic text-amber-200/90 text-sm leading-relaxed">
              "You arrived at Room 104 with two suitcases, a hand-me-down beige computer, and $38.00 in your wallet.
              Over fourteen days of dial-up tones, food cart shifts, late-night chats, and quiet window thoughts,
              you built a meaningful life connecting both sides of the screen."
            </p>
          </div>

          {/* 4 Core Diagnostic Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Computer & Hardware Evolution */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <Monitor className="w-4 h-4" />
                <span>Computer & Software Portfolio</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Operating System:</span>
                  <span className={`font-bold ${isOs6 ? 'text-amber-400' : 'text-slate-200'}`}>
                    {hardware.osVersion === 'Orion_6.0' ? 'Orion OS 6.0 (Upgraded)' : 'Orion OS 4.8'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">System Memory:</span>
                  <span className={`font-bold ${hasMaxRam ? 'text-green-400' : 'text-slate-200'}`}>
                    {hardware.ramMB} MB RAM {hasMaxRam && '★ Max'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Internet Tier:</span>
                  <span className={`font-bold ${hasFastNet ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {hardware.connectionType.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Installed Software:</span>
                  <span className="font-bold text-slate-200">
                    {installedSoftware.length} Applications
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Economy & Survival */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Financial & Living Stability</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Final Cash Balance:</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    ${player.cash.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Food Cart Shifts Worked:</span>
                  <span className="font-bold text-slate-200">
                    {foodCartShifts} shifts (${(foodCartShifts * 62).toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Motel Rent Obligations:</span>
                  <span className="font-bold text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Satisfied
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Total Money Earned:</span>
                  <span className="font-bold text-slate-200 font-mono">
                    ${cashEarned.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Social Arcs & Relationships */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>Social Bonds & Companions</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-slate-900/60 rounded border border-slate-700/40">
                  <div className="flex justify-between font-bold">
                    <span className="text-amber-300">Maya (starlight_maya)</span>
                    <span className={isMayaMetInPerson ? 'text-green-400' : 'text-slate-400'}>
                      {isMayaMetInPerson ? '★ Met at Café' : 'Online Friend'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isMayaMetInPerson
                      ? 'Shared warm coffee and personal stories at Starlight Café.'
                      : 'Regular late-night Pulse chat companion.'}
                  </p>
                </div>

                <div className="p-2 bg-slate-900/60 rounded border border-slate-700/40">
                  <div className="flex justify-between font-bold">
                    <span className="text-sky-300">Ryan (ryan_foodcart)</span>
                    <span className="text-emerald-400">Trusted Coworker</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Shared food cart rushes, software tips, and honest advice.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Physical Atmosphere & Habits */}
            <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Coffee className="w-4 h-4" />
                <span>Physical World Routine</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Window Observations:</span>
                  <span className="font-bold text-amber-300">
                    {windowObservations} Moments Reflected
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/60">
                  <span className="text-slate-400">Motel Room Clutter:</span>
                  <span className="font-bold text-slate-200">
                    Level 4 (Lived-in & Personal)
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Evaluation Status:</span>
                  <span className="font-bold text-green-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> 100% Complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportTelemetry}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold border border-slate-600 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>Export Telemetry (.JSON)</span>
            </button>
            {onRestartGame && (
              <button
                onClick={() => {
                  soundManager.play('click');
                  onRestartGame();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-red-950/60 text-red-300 rounded text-xs font-bold border border-slate-700 hover:border-red-600/60 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Start New Save</span>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              soundManager.play('click');
              onContinueFreePlay();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-md shadow-lg shadow-amber-950/50 transition-all transform hover:scale-[1.02] cursor-pointer text-xs"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Continue in Free-Play Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
};
