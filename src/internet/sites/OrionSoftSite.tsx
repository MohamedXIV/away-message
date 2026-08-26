import React from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';

export const OrionSoftSite: React.FC<SiteRouteProps> = () => {
  const currentOs = useSimulationStore((s) => s.state.hardware.osVersion);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const handleUpgradeTo60 = () => {
    dispatchAction({
      type: 'HARDWARE_UPGRADE_OS',
      targetOs: 'Orion_6.0',
      cost: 0,
    });
    soundManager.play('im_recv');
    alert('Orion 6.0 Upgrade Installed Successfully! Aero visual styles and 32-bit rasterizer activated.');
  };

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      {/* Header */}
      <div className="max-w-4xl w-full border-b-2 border-blue-600 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🌌</span>
          <div>
            <h1 className="text-xl font-bold text-blue-900 font-serif leading-none">
              OrionSoft Systems Corporation
            </h1>
            <span className="text-[10px] text-gray-500">
              The Architecture of Tomorrow // Operating Systems & Productivity
            </span>
          </div>
        </div>

        <span className="text-xs bg-blue-50 text-blue-900 font-mono font-bold px-2 py-1 rounded border border-blue-200">
          Current OS: {currentOs}
        </span>
      </div>

      {/* Orion 6.0 Feature Showcase */}
      <div className="max-w-4xl w-full mt-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded p-6 shadow-xl flex justify-between items-center">
        <div className="space-y-2 max-w-lg">
          <span className="bg-cyan-500 text-black font-bold text-[10px] px-2 py-0.5 rounded uppercase">
            Now Available
          </span>
          <h2 className="text-2xl font-bold font-serif text-cyan-200">
            Introducing Orion OS 6.0 "Aero Nova"
          </h2>
          <p className="text-xs text-gray-300 leading-relaxed">
            Experience translucent glass window borders, advanced 32-bit ARGB rasterization, support for multi-gigabyte memory configurations, and enhanced Pulse Messenger emoticon avatars.
          </p>

          <div className="pt-2">
            {currentOs === 'Orion_6.0' ? (
              <span className="bg-emerald-500 text-black font-bold px-3 py-1.5 rounded text-xs">
                ✓ Orion 6.0 Already Installed
              </span>
            ) : (
              <button
                onClick={handleUpgradeTo60}
                className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold rounded shadow-lg text-xs cursor-pointer"
              >
                Upgrade to Orion 6.0 Now (Free Online Patch)
              </button>
            )}
          </div>
        </div>

        <div className="text-6xl text-cyan-300 drop-shadow">
          💿
        </div>
      </div>
    </div>
  );
};
