import React, { useEffect, useState } from 'react';
import type { ComputerSetupState } from '../../engine/types';
import type { PcBootState } from './resolvePcBootState';

interface PcBootScreenProps {
  bootState: Exclude<PcBootState, 'desktop'>;
  computer: ComputerSetupState;
  onPowerOn: () => void;
  onPowerOff: () => void;
  onBackToRoom: () => void;
}

function totalRamMb(computer: ComputerSetupState): number {
  return computer.ramSticks.reduce((sum, stick) => sum + stick.sizeMb, 0);
}

export const PcBootScreen: React.FC<PcBootScreenProps> = ({
  bootState,
  computer,
  onPowerOn,
  onPowerOff,
  onBackToRoom,
}) => {
  const [postComplete, setPostComplete] = useState(false);

  useEffect(() => {
    if (bootState === 'no_computer' || bootState === 'powered_off') {
      setPostComplete(false);
      return;
    }
    setPostComplete(false);
    const timer = window.setTimeout(() => setPostComplete(true), 700);
    return () => window.clearTimeout(timer);
  }, [bootState, computer.cpu?.id, computer.poweredOn]);

  if (bootState === 'no_computer') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-zinc-300 font-mono p-5">
        <div className="max-w-md text-center space-y-4 border border-zinc-800 bg-zinc-900 p-6">
          <div className="text-4xl">🪵</div>
          <div className="font-bold text-amber-400">No computer is set up on the desk.</div>
          <p className="text-xs text-zinc-500">Bring a computer package back to Room 104 and set it up before trying to use the desk.</p>
          <button onClick={onBackToRoom} className="px-4 py-2 bg-amber-600 text-black text-xs font-bold">Back to Room 104</button>
        </div>
      </div>
    );
  }

  if (bootState === 'powered_off') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-zinc-400 font-mono p-5">
        <div className="text-center space-y-4">
          <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto" title="Monitor Standby" />
          <div className="text-xs text-zinc-500">Monitor in standby — no signal</div>
          <div className="flex justify-center gap-3">
            <button onClick={onPowerOn} className="px-4 py-2 bg-zinc-800 border border-zinc-600 text-zinc-100 text-xs">Power On PC</button>
            <button onClick={onBackToRoom} className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">Back to Room 104</button>
          </div>
        </div>
      </div>
    );
  }

  if (!postComplete) {
    return (
      <div className="w-full h-full bg-black text-zinc-300 font-mono p-7 text-xs leading-6">
        <div>AWARD Modular BIOS v2.6</div>
        <div className="mt-4">CPU: {computer.cpu?.name ?? 'Unknown'} {computer.cpu?.clockMhz ?? 0} MHz</div>
        <div>Memory Test: {totalRamMb(computer)} MB OK</div>
        <div>Primary Storage: {computer.storage[0]?.name ?? 'None'}</div>
        <div>Optical Drive: {computer.opticalDrives[0]?.name ?? 'None'}</div>
        <div className="mt-4 animate-pulse">Detecting boot devices...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black text-zinc-300 font-mono p-6">
      <div className="max-w-lg w-full border border-zinc-700 p-5 space-y-3">
        <div className="text-sm text-emerald-400">POST complete.</div>
        {bootState === 'installer_ready' ? (
          <>
            <div className="text-base font-bold text-white">Bootable setup media detected.</div>
            <p className="text-xs text-zinc-500">The owned operating-system setup disc is ready. Installation is handled by the installer lifecycle.</p>
          </>
        ) : (
          <>
            <div className="text-base font-bold text-white">No bootable operating system found.</div>
            <p className="text-xs text-zinc-500">This computer has no installed OS. Insert owned setup media before attempting installation.</p>
          </>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onPowerOff} className="px-4 py-2 bg-zinc-800 border border-zinc-600 text-zinc-100 text-xs">Power Off</button>
          <button onClick={onBackToRoom} className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">Back to Room 104</button>
        </div>
      </div>
    </div>
  );
};
