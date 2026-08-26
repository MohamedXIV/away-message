import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useAudioStore } from '../../store/useAudioStore';
import { OsVersion } from '../../engine/types';

export const ControlPanelApp: React.FC = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);

  const { masterVolume, isMuted, setMasterVolume, setMute } = useAudioStore();

  const [activeTab, setActiveTab] = useState<'system' | 'display' | 'sound'>('system');
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('Classic Teal');
  const [crtEnabled, setCrtEnabled] = useState<boolean>(true);

  // Storage Calculations
  const totalGB = hardware.hddTotalGB;
  const freeGB = hardware.hddFreeGB;
  const usedGB = Math.max(0, totalGB - freeGB);
  const usedPercent = Math.min(100, Math.max(0, (usedGB / totalGB) * 100));

  const handleOsSwitch = (targetOs: OsVersion) => {
    if (hardware.osVersion !== targetOs) {
      dispatchAction({ type: 'HARDWARE_UPGRADE_OS', targetOs, cost: 0 });
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#c0c0c0] text-black font-sans text-xs select-none">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-500 px-2 pt-2 gap-1 bg-[#dfdfdf]">
        {(['system', 'display', 'sound'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs font-semibold capitalize rounded-t border-t border-l border-r ${
              activeTab === tab
                ? 'bg-[#c0c0c0] border-gray-400 border-b-transparent -mb-px'
                : 'bg-gray-300 border-gray-400 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'system' && (
          <div className="space-y-4">
            {/* System Info Box */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">System Overview</legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-gray-500">Operating System:</div>
                <div className="col-span-2 font-semibold">
                  {hardware.osVersion === 'Orion_4.8' ? 'Orion OS 4.8 (Edition 1998)' : 'Orion OS 6.0 Professional'}
                </div>
                <div className="text-gray-500">Computer Owner:</div>
                <div className="col-span-2">Player / Room 104</div>
                <div className="text-gray-500">Processor:</div>
                <div className="col-span-2 font-mono">{hardware.cpuName} (Tier {hardware.cpuTier})</div>
                <div className="text-gray-500">Installed RAM:</div>
                <div className="col-span-2 font-mono font-semibold">{hardware.ramMB} MB SDRAM</div>
                <div className="text-gray-500">Connection:</div>
                <div className="col-span-2 uppercase font-semibold text-blue-900">
                  {hardware.connectionType} ({hardware.connectionSpeedKbps} kbps)
                </div>
              </div>
            </fieldset>

            {/* Storage Drive Space Pie Chart */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">Local Disk (C:) Storage</legend>
              <div className="flex items-center gap-6">
                {/* SVG Pie Chart */}
                <svg className="w-24 h-24 transform -rotate-90 shrink-0" viewBox="0 0 32 32">
                  <circle r="16" cx="16" cy="16" fill="#3b82f6" />
                  <circle
                    r="8"
                    cx="16"
                    cy="16"
                    fill="transparent"
                    stroke="#e11d48"
                    strokeWidth="16"
                    strokeDasharray={`${usedPercent} 100`}
                  />
                </svg>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-[#e11d48] inline-block rounded-xs" />
                    <span>
                      Used Space: <strong className="font-mono">{usedGB.toFixed(2)} GB</strong> ({usedPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-[#3b82f6] inline-block rounded-xs" />
                    <span>
                      Free Space: <strong className="font-mono">{freeGB.toFixed(2)} GB</strong>
                    </span>
                  </div>
                  <div className="pt-1 text-gray-500 font-mono">
                    Total Capacity: {totalGB.toFixed(2)} GB
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'display' && (
          <div className="space-y-4">
            {/* OS Generation Switcher */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">OS Theme & Generation</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="radio"
                    name="osVersion"
                    checked={hardware.osVersion === 'Orion_4.8'}
                    onChange={() => handleOsSwitch('Orion_4.8')}
                  />
                  <span>Orion OS 4.8 (Classic Bevel 95/98)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="radio"
                    name="osVersion"
                    checked={hardware.osVersion === 'Orion_6.0'}
                    onChange={() => handleOsSwitch('Orion_6.0')}
                  />
                  <span>Orion OS 6.0 (XP Royale Blue)</span>
                </label>
              </div>
            </fieldset>

            {/* Wallpaper Selection */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">Desktop Wallpaper</legend>
              <div className="grid grid-cols-2 gap-2">
                {['Classic Teal', 'Bliss Green', 'Starry Night', 'Matrix Code', 'Solid Navy'].map((wp) => (
                  <label key={wp} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="wallpaper"
                      checked={selectedWallpaper === wp}
                      onChange={() => setSelectedWallpaper(wp)}
                    />
                    <span>{wp}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* CRT Monitor Shader */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">CRT Monitor Shader & Visual Effects</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crtEnabled}
                    onChange={(e) => setCrtEnabled(e.target.checked)}
                  />
                  <span>Enable Retro CRT Scanlines & Glass Curvature</span>
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'sound' && (
          <div className="space-y-4">
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">Audio Output & Effects</legend>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!isMuted}
                    onChange={(e) => setMute(!e.target.checked)}
                  />
                  <span>Enable Retro Sound Effects & Chimes</span>
                </label>

                <div>
                  <div className="flex justify-between mb-1">
                    <span>Master Volume:</span>
                    <span className="font-mono">{Math.round(masterVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : masterVolume}
                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                    className="w-full cursor-pointer"
                  />
                </div>
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="p-2 border-t border-gray-400 bg-[#dfdfdf] flex justify-end gap-2">
        <button className="orion-button min-w-[70px] font-semibold">OK</button>
        <button className="orion-button min-w-[70px]">Cancel</button>
      </div>
    </div>
  );
};
