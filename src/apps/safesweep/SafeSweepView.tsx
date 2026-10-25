import React, { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import type { InstalledSoftwareRecord, ActionResult } from '../../engine/types';

interface DetectedThreat {
  id: string;
  name: string;
  category: 'Adware' | 'Spyware' | 'Hijacker' | 'Tracking Cookie';
  severity: 'High' | 'Medium' | 'Low';
  filePath: string;
  description: string;
  selected: boolean;
}


/** Original SafeSweep authored layout, but only owner-reported installed software
 * and confirmed uninstall results can affect the scan or cleanup status.
 */
export const SafeSweepView: React.FC<{
  installedSoftware: InstalledSoftwareRecord[];
  onUninstall: (installedId: string) => Promise<ActionResult>;
}> = ({ installedSoftware, onUninstall }) => {
  const [cleaning, setCleaning] = useState(false);
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [currentScanningPath, setCurrentScanningPath] = useState('C:/Program Files');
  const [threats, setThreats] = useState<DetectedThreat[]>([]);
  const [statusMessage, setStatusMessage] = useState('Definitions database updated (Version 2006.08.22).');

  const startScan = (type: 'quick' | 'full') => {
    setScanState('scanning');
    setScanProgress(0);
    setThreats([]);
    setStatusMessage(`Running ${type} system sweep...`);

    // Scanning is a presentation delay over the bounded installed-software
    // inventory only: no fictitious registry/filesystem inspection.
    const scanPaths = ['C:/Program Files', ...installedSoftware.map(sw => sw.installPath)];

    let p = 0;
    const interval = setInterval(() => {
      p += 15;
      setScanProgress(p);
      const pathIdx = Math.floor((p / 100) * scanPaths.length);
      if (scanPaths[pathIdx]) setCurrentScanningPath(scanPaths[pathIdx]);

      if (p >= 100) {
        clearInterval(interval);
        setScanState('complete');
        soundManager.play('im_recv');

        // Detect if searchmate or adware is present
        const detected: DetectedThreat[] = [];
        installedSoftware.forEach(sw => {
          if (sw.appId === 'searchmate' || sw.isAdware ||
            sw.adwarePayload?.toolbarInjected || sw.adwarePayload?.homepageHijacked ||
            sw.adwarePayload?.startupAutorun) {
            detected.push({
              id: sw.id || sw.appId,
              name: 'Adware.Win32.SearchMateToolbar',
              category: 'Adware',
              severity: 'High',
              filePath: 'C:/Program Files/SearchMate/searchmate.dll',
              description: 'Injects unwanted sponsored search toolbars, redirects search queries, and logs browsing patterns.',
              selected: true,
            });
          }
        });


        setThreats(detected);
        setStatusMessage(`Scan complete: ${detected.length} threat(s) detected.`);
      }
    }, 250);
  };

  const handleCleanSelectedThreats = async () => {
    if (cleaning) return;
    const toRemove = threats.filter(threat => threat.selected);
    if (toRemove.length === 0) return;
    setCleaning(true);
    try {
      const responses = await Promise.all(toRemove.map(async threat => {
        try {
          const result = await onUninstall(threat.id);
          return { id: threat.id, success: result.success, error: result.error };
        } catch (cause) {
          return { id: threat.id, success: false,
            error: cause instanceof Error ? cause.message : String(cause) };
        }
      }));
      const successes = new Set(responses.filter(x => x.success).map(x => x.id));
      const failures = responses.filter(x => !x.success);
      setThreats(previous => previous.filter(x => !successes.has(x.id)));
      setStatusMessage(failures.length
        ? `Removed ${successes.size}; ${failures.length} failed: ${failures[0]!.error ?? 'Owner refused removal'}`
        : `Removed ${successes.size} installed threat(s) from the canonical system.`);
      if (successes.size > 0) soundManager.play('im_send');
    } finally {
      setCleaning(false);
    }
  };

  const toggleThreatSelection = (id: string) => {
    setThreats((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Title Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white p-2.5 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <div>
            <h1 className="font-bold text-xs leading-none">SafeSweep Anti-Spyware 2006</h1>
            <span className="text-[10px] text-teal-200">Installed Software & Adware Scanner</span>
          </div>
        </div>
        <span className="bg-emerald-950 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500">
          DEFINITIONS: ACTIVE
        </span>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="bg-[#dfdfdf] border-b border-gray-400 p-1.5 flex gap-2">
        <button
          onClick={() => startScan('quick')}
          disabled={scanState === 'scanning'}
          className="px-3 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🔍 Quick Scan
        </button>
        <button
          onClick={() => startScan('full')}
          disabled={scanState === 'scanning'}
          className="px-3 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🗂️ Full System Sweep
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto bg-white">
        {/* Scanning State */}
        {scanState === 'scanning' && (
          <div className="bg-blue-50 border border-blue-300 rounded p-3 space-y-2">
            <div className="flex justify-between text-xs font-bold text-blue-900">
              <span>Inspecting installed applications and toolbar indicators...</span>
              <span>{scanProgress}%</span>
            </div>

            <div className="w-full bg-gray-200 h-4 rounded-xs border border-gray-400 overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-200"
                style={{ width: `${scanProgress}%` }}
              />
            </div>

            <span className="text-[10px] text-gray-500 font-mono block truncate">
              Inspecting: {currentScanningPath}
            </span>
          </div>
        )}

        {/* Scan Results / Threats Table */}
        {scanState === 'complete' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-gray-800">
                Detected Threats ({threats.length}):
              </span>
              {threats.length > 0 && (
                <button
                  onClick={() => void handleCleanSelectedThreats()}
                  disabled={cleaning || !threats.some(t => t.selected)}
                  className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow cursor-pointer text-xs"
                >
                  🧹 Remove & Quarantine Selected
                </button>
              )}
            </div>

            {threats.length === 0 ? (
              <div className="bg-green-50 border border-green-300 rounded p-6 text-center text-green-900">
                <span className="text-3xl block mb-1">✅</span>
                <strong>No known unwanted installed software detected.</strong>
                <p className="text-xs text-green-700 mt-1">Installed-program checks are clear. This does not scan unrelated files or registry entries.</p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-[#e4e4e4] border-b border-gray-300 font-bold text-gray-700">
                    <tr>
                      <th className="p-1.5 w-6 text-center">✓</th>
                      <th className="p-1.5 border-r border-gray-300">Threat Name</th>
                      <th className="p-1.5 border-r border-gray-300">Category</th>
                      <th className="p-1.5 border-r border-gray-300">Severity</th>
                      <th className="p-1.5">File Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threats.map((threat) => (
                      <tr
                        key={threat.id}
                        className={`border-b border-gray-100 ${
                          threat.severity === 'High' ? 'bg-red-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={threat.selected}
                            onChange={() => toggleThreatSelection(threat.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-1.5 font-bold text-red-900">{threat.name}</td>
                        <td className="p-1.5 font-semibold text-gray-700">{threat.category}</td>
                        <td className="p-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              threat.severity === 'High'
                                ? 'bg-red-200 text-red-900'
                                : 'bg-yellow-100 text-yellow-900'
                            }`}
                          >
                            {threat.severity}
                          </span>
                        </td>
                        <td className="p-1.5 font-mono text-[10px] text-gray-600 truncate max-w-[180px]">
                          {threat.filePath}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Initial Idle State Advice */}
        {scanState === 'idle' && (
          <div className="bg-[#f7f9fa] border border-gray-200 rounded p-4 text-center space-y-2">
            <span className="text-3xl block">🛡️</span>
            <strong className="text-gray-800 text-xs">SafeSweep is protecting your system</strong>
            <p className="text-gray-600 text-xs leading-relaxed max-w-sm mx-auto">
              Inspect installed applications for known bundled adware and unwanted search toolbars.
            </p>
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="bg-[#dfdfdf] border-t border-gray-400 px-2 py-1 flex justify-between items-center text-[10px] text-gray-700 font-mono">
        <span>{statusMessage}</span>
        <span>SafeSweep Engine v4.2</span>
      </div>
    </div>
  );
};
