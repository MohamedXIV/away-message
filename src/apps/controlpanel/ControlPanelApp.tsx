import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useAudioStore } from '../../store/useAudioStore';
import { useDesktopStore, type WallpaperPreset } from '../../store/useDesktopStore';
import { OsVersion } from '../../engine/types';
import { getAllReleases, getReleaseById } from '../../engine/OsCatalog';

export const ControlPanelApp: React.FC = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const osState = useSimulationStore((s) => s.state.os);
  const time = useSimulationStore((s) => s.state.time);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const engine = useSimulationStore((s) => s.engine);

  const { masterVolume, isMuted, setMasterVolume, setMute } = useAudioStore();

  const [activeTab, setActiveTab] = useState<'system' | 'display' | 'sound'>('system');
  const wallpaper = useDesktopStore((s) => s.wallpaper);
  const setWallpaper = useDesktopStore((s) => s.setWallpaper);
  const crtEnabled = useDesktopStore((s) => s.crtEnabled);
  const setCrtEnabled = useDesktopStore((s) => s.setCrtEnabled);

  const WALLPAPER_OPTIONS: Array<{ id: WallpaperPreset; label: string }> = [
    { id: 'classic_teal', label: 'Classic Teal' },
    { id: 'bliss_green', label: 'Bliss Green' },
    { id: 'starry_night', label: 'Starry Night' },
    { id: 'matrix_rain', label: 'Matrix Code' },
    { id: 'solid_navy', label: 'Solid Navy' },
  ];

  // Storage Calculations
  const totalGB = hardware.hddTotalGB;
  const freeGB = hardware.hddFreeGB;
  const usedGB = Math.max(0, totalGB - freeGB);
  const usedPercent = Math.min(100, Math.max(0, (usedGB / totalGB) * 100));

  const handleOsSwitch = (targetOs: OsVersion) => {
    if (osState.currentOsId !== targetOs) {
      const rel = getReleaseById(targetOs);
      dispatchAction({ type: 'HARDWARE_UPGRADE_OS', targetOs, cost: rel?.price ?? 0 });
    }
  };
  const currentRel = getReleaseById(osState.currentOsId as any) ?? getReleaseById('Orion_4.8' as any)!;
  const allReleases = getAllReleases().filter((r) => r.releaseDay <= time.day);
  const availableForInstall = (() => {
    try { return (engine as unknown as { os: { getAvailableReleases: (day:number, hw:any)=>typeof allReleases } }).os.getAvailableReleases(time.day, hardware as any); } catch { return []; }
  })();

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
            {/* System Info Box — Orion OS core */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">System Overview — Orion OS</legend>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-gray-500">Operating System:</div>
                <div className="col-span-2 font-semibold">
                  {currentRel.displayName} <span className="font-mono text-[10px] text-gray-500">Build {currentRel.build} • {currentRel.codename} • {currentRel.theme}</span>
                </div>
                <div className="text-gray-500">Channel / Kind:</div>
                <div className="col-span-2"><span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase border ${currentRel.channel === 'beta' ? 'bg-purple-50 text-purple-700 border-purple-300' : currentRel.channel === 'hotfix' ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}`}>{currentRel.channel} • {currentRel.kind}</span> <span className="text-[10px] text-gray-500">Day {currentRel.releaseDay} • {currentRel.installSizeGB}GB • {currentRel.ramOverheadMB}MB overhead</span></div>
                <div className="text-gray-500">Boot Time:</div>
                <div className="col-span-2 font-mono">{currentRel.bootTimeSeconds}s {osState.pendingReboot ? '(reboot pending)' : ''}</div>
                <div className="text-gray-500">Computer Owner:</div>
                <div className="col-span-2">Player / Room 104</div>
                <div className="text-gray-500">Processor:</div>
                <div className="col-span-2 font-mono">{hardware.cpuName} (Tier {hardware.cpuTier})</div>
                <div className="text-gray-500">Installed RAM:</div>
                <div className="col-span-2 font-mono font-semibold">{hardware.ramMB} MB SDRAM <span className="text-[10px] text-gray-500">• OS overhead {currentRel.ramOverheadMB}MB</span></div>
                <div className="text-gray-500">Patches:</div>
                <div className="col-span-2 font-mono text-[11px]">{osState.installedPatchIds.length ? osState.installedPatchIds.join(', ') : '— none —'}</div>
                <div className="text-gray-500">Connection:</div>
                <div className="col-span-2 uppercase font-semibold text-blue-900">
                  {hardware.connectionType} ({hardware.connectionSpeedKbps} kbps)
                </div>
              </div>
              {currentRel.changelog.length > 0 && (
                <div className="mt-2 border-t border-gray-300 pt-2">
                  <div className="text-[10px] font-bold text-gray-600 uppercase">Changelog — {currentRel.displayName}</div>
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-700 space-y-0.5">
                    {currentRel.changelog.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {osState.lastInstallLog && osState.lastInstallLog.length > 0 && (
                <div className="mt-2 bg-black text-green-400 font-mono text-[10px] p-2 max-h-20 overflow-y-auto">
                  {osState.lastInstallLog.slice(-6).map((l, i) => <div key={i}>› {l}</div>)}
                </div>
              )}
            </fieldset>
            {/* Available OS Updates */}
            {availableForInstall.length > 0 && (
              <fieldset className="border border-gray-400 p-3 rounded bg-amber-50/60">
                <legend className="font-bold px-1 text-gray-700">Available Orion Releases</legend>
                <div className="space-y-2">
                  {availableForInstall.slice(0, 4).map((r) => (
                    <div key={r.id} className="flex items-center justify-between border border-gray-300 bg-white px-2 py-1.5">
                      <div>
                        <div className="font-bold text-xs">{r.displayName} <span className="text-[9px] font-mono text-gray-500">Build {r.build}</span></div>
                        <div className="text-[10px] text-gray-600">{r.blurb} • {r.installSizeGB}GB • {r.requirements.minRamMB}MB min</div>
                      </div>
                      <button onClick={() => handleOsSwitch(r.id as OsVersion)} className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded text-xs">Install{r.price ? ` ($${r.price})` : ' (Free)'}</button>
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

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
              <div className="grid grid-cols-2 gap-2">
                {allReleases.slice(0, 8).map((r) => (
                  <label key={r.id} className={`flex items-center gap-2 cursor-pointer font-semibold px-2 py-1 border rounded ${osState.currentOsId === r.id ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="osVersion"
                      checked={osState.currentOsId === r.id}
                      onChange={() => handleOsSwitch(r.id as OsVersion)}
                      disabled={r.releaseDay > time.day}
                    />
                    <span className="text-[11px]">{r.displayName} <span className="font-mono text-[9px] text-gray-500">{r.theme} • Day {r.releaseDay}</span></span>
                  </label>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-gray-500">Switching triggers install: disk check → copy {currentRel.installSizeGB}GB → {currentRel.kind === 'patch' ? '1' : '2'} reboots → finalizing. Procedural AI releases appear here when generated via WorldEvents.</div>
            </fieldset>

            {/* Wallpaper Selection */}
            <fieldset className="border border-gray-400 p-3 rounded bg-white/60">
              <legend className="font-bold px-1 text-gray-700">Desktop Wallpaper</legend>
              <div className="grid grid-cols-2 gap-2">
                {WALLPAPER_OPTIONS.map((wp) => (
                  <label key={wp.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="wallpaper"
                      checked={wallpaper === wp.id}
                      onChange={() => setWallpaper(wp.id)}
                    />
                    <span>{wp.label}</span>
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Applies instantly to Desktop. Saved in browser storage.</div>
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
