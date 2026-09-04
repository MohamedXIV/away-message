import React from 'react';
import type { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { PulseMessengerApp } from '../../apps/pulse/PulseMessengerApp';

/**
 * pulse.local — the official Pulse site. Installed → the full web client
 * (same component, same live session as the desktop window). Not installed →
 * a proper landing page with features and a download route via DownloadHub.
 */
export const PulseWebSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});
  const isInstalled = useSimulationStore((s) =>
    s.state.installedSoftware.some((sw: any) => String(sw.appId).includes('pulse'))
  );

  if (isInstalled) {
    return (
      <div className="w-full min-h-full bg-[#3b1a5e] text-black font-sans text-xs p-4 flex flex-col items-center">
        <div className="max-w-3xl w-full">
          <div className="flex items-center justify-between px-1 pb-2 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ffd400] text-[#4a1a6b] font-black text-xs">P</div>
              <div>
                <span className="font-bold tracking-widest">PULSE</span>
                <span className="opacity-70"> web messenger</span>
              </div>
            </div>
            <span className="font-mono text-[10px] opacity-70">pulse.local • same account, same buddies</span>
          </div>
          <div className="h-[600px] w-full overflow-hidden rounded border-2 border-[#1a1033] shadow-2xl bg-white">
            <PulseMessengerApp />
          </div>
          <p className="mt-2 text-center text-[10px] text-purple-200/70">
            Signed in here = signed in on the desktop. One account, every screen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white text-black font-sans text-xs p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full border-b-2 border-[#4a1a6b] pb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffd400] text-[#4a1a6b] font-black text-lg">P</div>
          <div>
            <h1 className="text-xl font-bold text-[#3b1a5e] leading-none">Pulse Messenger</h1>
            <span className="text-[10px] text-gray-500">The Real-Time Social Network for Orion OS &amp; PC</span>
          </div>
        </div>
        <button
          onClick={() => doNavigate('downloadhub.local')}
          className="px-4 py-1.5 bg-[#4a2390] hover:bg-[#5a2fa8] text-white font-bold rounded text-xs shadow cursor-pointer"
        >
          ⬇ Download Pulse 5.2 — Free
        </button>
      </div>

      <div className="max-w-4xl w-full mt-6 bg-gradient-to-r from-[#3b1a5e] to-[#5b2d8f] text-white rounded p-6 shadow-xl">
        <h2 className="text-xl font-bold text-[#ffd400]">Your friends are only a click away</h2>
        <p className="mt-2 text-xs text-purple-100 leading-relaxed max-w-lg">
          Buddy lists, custom away messages, chatrooms, winking smileys and dial-up-friendly
          everything. Grab the installer from DownloadHub, run it, and sign up for a free
          Pulse ID — right here or in the desktop app.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px]">
          <div className="bg-white/10 rounded p-3">💬<div className="mt-1 font-bold">Instant messaging</div></div>
          <div className="bg-white/10 rounded p-3">😉<div className="mt-1 font-bold">Away messages</div></div>
          <div className="bg-white/10 rounded p-3">🌐<div className="mt-1 font-bold">Works in browser too</div></div>
        </div>
      </div>

      <div className="max-w-4xl w-full mt-4 border border-gray-300 rounded p-3 text-[11px] text-gray-600">
        <b>How to install:</b> 1) Hit Download above → 2) open the file from Downloads →
        3) run the installer → 4) find Pulse on your desktop. Then come back here —
        this very page turns into the messenger.
      </div>
    </div>
  );
};
