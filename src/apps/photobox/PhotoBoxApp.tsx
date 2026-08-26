import React, { useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { soundManager } from '../../audio/SoundManager';

interface ImageFilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  invert: number;
  blur: number;
}

const DEFAULT_FILTER: ImageFilterState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
  invert: 0,
  blur: 0,
};

export const PhotoBoxApp: React.FC = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);
  const isOrion60 = hardware.osVersion === 'Orion_6.0';
  const hasSufficientRam = hardware.ramMB >= 768;
  const isGatingPassed = isOrion60 && hasSufficientRam;

  const [activePhoto, setActivePhoto] = useState<'motel' | 'diner' | 'canal'>('motel');
  const [filters, setFilters] = useState<ImageFilterState>(DEFAULT_FILTER);
  const [history, setHistory] = useState<ImageFilterState[]>([DEFAULT_FILTER]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('PhotoBox Pro 2.0 Engine Active.');

  // If system requirements fail, render diagnostic blocking modal
  if (!isGatingPassed) {
    return (
      <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs p-6 flex items-center justify-center select-none">
        <div className="bg-white border-2 border-red-600 rounded shadow-2xl p-4 max-w-md w-full flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-red-300 pb-2 text-red-700 font-bold text-sm">
            <span className="text-2xl">🚫</span>
            <span>PhotoBox Pro 2.0 - System Requirement Error</span>
          </div>

          {/* Description */}
          <p className="text-gray-700 leading-relaxed">
            PhotoBox Pro 2.0 requires advanced GPU rasterization and memory caching features not supported on your current system configuration.
          </p>

          {/* Specs comparison */}
          <div className="bg-red-50 border border-red-200 rounded p-2.5 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-600">Operating System:</span>
              <span className={isOrion60 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                {hardware.osVersion} {isOrion60 ? '✓' : '(Requires Orion 6.0)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Installed RAM:</span>
              <span className={hasSufficientRam ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                {hardware.ramMB} MB {hasSufficientRam ? '✓' : '(Requires 768 MB+)'}
              </span>
            </div>
          </div>

          {/* Guidance */}
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-900 text-xs">
            <strong>Upgrade Instructions:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
              <li>Visit <strong>TechMart</strong> (<code className="bg-white px-1">techmart.local</code>) to purchase high-density 512MB/1024MB RAM modules.</li>
              <li>Visit <strong>OrionSoft</strong> (<code className="bg-white px-1">orionsoft.local</code>) or DownloadHub to upgrade to <strong>Orion 6.0</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // If system requirements pass, render full professional photo editor
  const applyPreset = (presetName: string) => {
    let next: ImageFilterState = { ...DEFAULT_FILTER };
    if (presetName === 'vintage') {
      next = { brightness: 110, contrast: 120, saturation: 70, sepia: 40, invert: 0, blur: 0 };
    } else if (presetName === 'noir') {
      next = { brightness: 90, contrast: 150, saturation: 0, sepia: 0, invert: 0, blur: 0 };
    } else if (presetName === 'neon') {
      next = { brightness: 105, contrast: 140, saturation: 180, sepia: 10, invert: 0, blur: 0 };
    } else if (presetName === 'sunset') {
      next = { brightness: 100, contrast: 110, saturation: 140, sepia: 50, invert: 0, blur: 0 };
    }

    setFilters(next);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), next]);
    setHistoryIndex((prev) => prev + 1);
    setStatusMessage(`Applied preset: ${presetName}`);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevFilter = history[historyIndex - 1];
      if (prevFilter) {
        setHistoryIndex(historyIndex - 1);
        setFilters(prevFilter);
        setStatusMessage('Undo last adjustment.');
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextFilter = history[historyIndex + 1];
      if (nextFilter) {
        setHistoryIndex(historyIndex + 1);
        setFilters(nextFilter);
        setStatusMessage('Redo adjustment.');
      }
    }
  };

  const handleSave = () => {
    soundManager.play('im_send');
    setStatusMessage(`Saved image to C:/Pictures/edited_${activePhoto}.png`);
  };

  const filterStyle = {
    filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.sepia}%) invert(${filters.invert}%) blur(${filters.blur}px)`,
  };

  return (
    <div className="w-full h-full bg-[#33373b] text-gray-200 font-sans text-xs select-none flex flex-col overflow-hidden">
      {/* Menu Bar */}
      <div className="flex gap-3 px-2 py-1 bg-[#25282c] border-b border-gray-700 text-xs">
        <span className="hover:text-white cursor-pointer">File</span>
        <span className="hover:text-white cursor-pointer">Edit</span>
        <span className="hover:text-white cursor-pointer">Image</span>
        <span className="hover:text-white cursor-pointer">Filters</span>
        <span className="hover:text-white cursor-pointer">View</span>
        <span className="hover:text-white cursor-pointer">Help</span>
      </div>

      {/* Toolbar */}
      <div className="bg-[#2a2d32] border-b border-gray-700 p-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs"
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs"
          >
            ↪ Redo
          </button>
          <div className="h-4 w-px bg-gray-600 mx-1" />
          <button
            onClick={() => applyPreset('vintage')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            🎞️ Vintage 2006
          </button>
          <button
            onClick={() => applyPreset('neon')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            ✨ Neon Noir
          </button>
          <button
            onClick={() => applyPreset('noir')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            📷 B&W High Contrast
          </button>
          <button
            onClick={() => applyPreset('sunset')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            🌅 Warm Sunset
          </button>
        </div>

        <button
          onClick={handleSave}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow text-xs cursor-pointer"
        >
          💾 Save Image
        </button>
      </div>

      {/* Main Workspace (Canvas + Tools) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Photo Selector & Tool Palette */}
        <div className="w-48 bg-[#25282c] border-r border-gray-700 p-2 flex flex-col gap-3 overflow-y-auto">
          <div>
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide block mb-1">
              Sample Photos:
            </span>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActivePhoto('motel');
                  setFilters(DEFAULT_FILTER);
                }}
                className={`w-full text-left p-1.5 rounded text-xs ${
                  activePhoto === 'motel' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                🏨 Motel Neon Blinds
              </button>
              <button
                onClick={() => {
                  setActivePhoto('diner');
                  setFilters(DEFAULT_FILTER);
                }}
                className={`w-full text-left p-1.5 rounded text-xs ${
                  activePhoto === 'diner' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                🍳 4th St Diner Night
              </button>
              <button
                onClick={() => {
                  setActivePhoto('canal');
                  setFilters(DEFAULT_FILTER);
                }}
                className={`w-full text-left p-1.5 rounded text-xs ${
                  activePhoto === 'canal' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                🌊 Industrial Canal Rain
              </button>
            </div>
          </div>

          {/* Manual Adjustments */}
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wide block">
              Adjustments:
            </span>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Brightness</span>
                <span>{filters.brightness}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={200}
                value={filters.brightness}
                onChange={(e) => setFilters({ ...filters, brightness: Number(e.target.value) })}
                className="w-full h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Contrast</span>
                <span>{filters.contrast}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={200}
                value={filters.contrast}
                onChange={(e) => setFilters({ ...filters, contrast: Number(e.target.value) })}
                className="w-full h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Saturation</span>
                <span>{filters.saturation}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={250}
                value={filters.saturation}
                onChange={(e) => setFilters({ ...filters, saturation: Number(e.target.value) })}
                className="w-full h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Sepia Tone</span>
                <span>{filters.sepia}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={filters.sepia}
                onChange={(e) => setFilters({ ...filters, sepia: Number(e.target.value) })}
                className="w-full h-1 bg-gray-700 rounded cursor-pointer"
              />
            </div>

            <button
              onClick={() => setFilters(DEFAULT_FILTER)}
              className="w-full py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs mt-2"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Center: Canvas Viewport */}
        <div className="flex-1 bg-[#1a1c1e] p-4 flex items-center justify-center overflow-auto">
          <div className="border-2 border-gray-700 bg-black rounded shadow-2xl p-2 relative max-w-xl w-full">
            {/* Simulated Photo Content Canvas */}
            <div
              style={filterStyle}
              className="w-full h-72 rounded bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center text-center p-6 transition-all duration-150 overflow-hidden relative shadow-inner"
            >
              {activePhoto === 'motel' && (
                <div className="space-y-2">
                  <div className="text-4xl">🏨</div>
                  <h3 className="text-xl font-bold text-pink-400 font-mono tracking-widest uppercase drop-shadow">
                    STARLITE MOTEL
                  </h3>
                  <p className="text-xs text-blue-300 italic">
                    "Rain dripping across neon tube letters. Room 104 blinds half-drawn."
                  </p>
                </div>
              )}

              {activePhoto === 'diner' && (
                <div className="space-y-2">
                  <div className="text-4xl">🍳</div>
                  <h3 className="text-xl font-bold text-yellow-400 font-mono tracking-widest uppercase drop-shadow">
                    4TH STREET DINER
                  </h3>
                  <p className="text-xs text-yellow-200 italic">
                    "Steam on plate glass. Maya wiping counters at 11:45 PM."
                  </p>
                </div>
              )}

              {activePhoto === 'canal' && (
                <div className="space-y-2">
                  <div className="text-4xl">🌊</div>
                  <h3 className="text-xl font-bold text-cyan-400 font-mono tracking-widest uppercase drop-shadow">
                    CANAL PUMPING STATION
                  </h3>
                  <p className="text-xs text-cyan-200 italic">
                    "Low frequency hum beneath the rusted sluice gates."
                  </p>
                </div>
              )}

              <span className="absolute bottom-2 right-2 text-[9px] font-mono text-gray-500 bg-black/60 px-1.5 py-0.5 rounded">
                1024 x 768 (32-bit ARGB)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="bg-[#25282c] border-t border-gray-700 px-2 py-1 flex justify-between items-center text-[10px] text-gray-400 font-mono">
        <span>{statusMessage}</span>
        <span>Orion 6.0 GPU Rasterizer | RAM: {hardware.ramMB} MB</span>
      </div>
    </div>
  );
};
