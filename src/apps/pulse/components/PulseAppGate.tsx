import React from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { PulseMessengerApp } from '../PulseMessengerApp';

/**
 * Install gate: Pulse never ships with the OS. Without app.pulse installed,
 * every launch path renders a "not installed" panel that routes the player
 * to the official site — instead of silently opening the app.
 */
export const PulseAppGate: React.FC<{ onOpenSite?: (url: string) => void }> = ({ onOpenSite }) => {
  const isInstalled = useSimulationStore((s) =>
    s.state.installedSoftware.some((sw: any) => String(sw.appId).includes('pulse'))
  );
  const openWindow = useWindowStore((s) => s.openWindow);

  if (isInstalled) return <PulseMessengerApp />;

  const openOfficialSite = () => {
    if (onOpenSite) {
      onOpenSite('http://pulse.local/');
      return;
    }
    openWindow({ appId: 'browser', customState: { initialUrl: 'http://pulse.local/' } });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#f0eef5] p-6 text-center font-sans text-xs text-[#2b2b2b]">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c9c2d8] text-2xl font-black text-[#4a1a6b] shadow-inner">
        P
      </div>
      <div>
        <div className="text-sm font-bold text-[#3b1a5e]">Pulse Messenger is not installed</div>
        <p className="mx-auto mt-1 max-w-[260px] text-[11px] text-[#5b4a7a]">
          This PC shipped without Pulse. Grab the free installer from the official site —
          it only takes a minute on dial-up. Probably.
        </p>
      </div>
      <button
        onClick={openOfficialSite}
        className="rounded bg-gradient-to-b from-[#6a3fb8] to-[#4a2390] px-4 py-2 font-bold text-white shadow-[0_2px_0_#2a1550] hover:from-[#7550c0] hover:to-[#512aa0]"
      >
        ⬇ Get Pulse at pulse.local
      </button>
      <span className="font-mono text-[10px] text-[#9a8ab8]">not installed • v5.2 • 6 MB</span>
    </div>
  );
};
