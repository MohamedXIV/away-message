import React from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';

export const MotelLinkSite: React.FC<SiteRouteProps> = () => {
  const hardware = useSimulationStore((s) => s.state.hardware);

  return (
    <div className="w-full min-h-full bg-[#1e293b] text-white font-sans text-xs p-4 flex flex-col items-center">
      {/* Motel Portal Header */}
      <div className="max-w-4xl w-full bg-[#0f172a] border border-cyan-500 rounded-t p-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-cyan-400">🏨</span>
          <div>
            <h1 className="text-base font-bold font-serif text-cyan-300">
              Starlite Motel Guest Network Portal
            </h1>
            <span className="text-[10px] text-cyan-200">Room 104 // High-Speed Ethernet & Dialup Gateway</span>
          </div>
        </div>

        <span className="bg-cyan-950 px-2 py-0.5 rounded text-[10px] border border-cyan-600 font-mono text-cyan-400">
          GATEWAY: ACTIVE
        </span>
      </div>

      {/* Main Connection Status Card */}
      <div className="max-w-4xl w-full bg-[#334155] border border-slate-600 p-4 space-y-4 shadow-xl">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-cyan-200">Your Room Connection Diagnostics:</h3>
          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-3 rounded border border-slate-700 font-mono text-xs">
            <div>
              <span className="text-gray-400">Assigned IP: </span>
              <span className="text-emerald-400">192.168.1.104</span>
            </div>
            <div>
              <span className="text-gray-400">Active Modem/Link: </span>
              <span className="text-emerald-400">{hardware.connectionType.toUpperCase()}</span>
            </div>
            <div>
              <span className="text-gray-400">Default Gateway: </span>
              <span className="text-emerald-400">192.168.1.1 (Front Desk Switch)</span>
            </div>
            <div>
              <span className="text-gray-400">DNS Server: </span>
              <span className="text-emerald-400">10.0.0.1 (Oakhaven Telecom)</span>
            </div>
          </div>
        </div>

        {/* Motel Services & Front Desk Message */}
        <div className="bg-slate-800 p-3 rounded border border-slate-700 space-y-2">
          <h4 className="font-bold text-xs text-yellow-300">Notice from Front Desk (Mr. Henderson):</h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            Welcome to the Starlite Motel. Ice machine is located next to Room 101. Weekly lodging rent is due Sunday evening at the counter. Please do not tamper with the copper telephony bridge box behind the stairwell.
          </p>
        </div>
      </div>
    </div>
  );
};
