import React, { useState, useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useAudioStore } from '../store/useAudioStore';
import { soundManager } from '../audio/SoundManager';
import { Volume2, VolumeX, Volume1, Wifi } from 'lucide-react';

interface SystemTrayProps {
  onOpenDialUp: () => void;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ onOpenDialUp }) => {
  const time = useSimulationStore((s) => s.state.time);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const downloads = useSimulationStore((s) => s.state.downloads);

  const { masterVolume, isMuted, setMasterVolume, setMute } = useAudioStore();

  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const [txBlink, setTxBlink] = useState(false);
  const [rxBlink, setRxBlink] = useState(false);

  // Blinking modem LEDs during active downloads
  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  useEffect(() => {
    if (activeDownloads.length === 0) {
      setTxBlink(false);
      setRxBlink(false);
      return;
    }
    const interval = setInterval(() => {
      setTxBlink((prev) => !prev);
      setRxBlink(Math.random() > 0.3);
    }, 250);
    return () => clearInterval(interval);
  }, [activeDownloads.length]);

  const handleVolumeChange = (newVol: number) => {
    setMasterVolume(newVol);
  };

  const handleMuteToggle = () => {
    setMute(!isMuted);
    soundManager.play('click');
  };

  // Format Clock: HH:MM AM/PM
  const formatTime = () => {
    const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    const minuteStr = time.minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentWeekday = weekdays[(time.day - 1) % 7];

  return (
    <div className="relative flex items-center gap-2 px-2 py-0.5 orion-inset bg-[#c0c0c0]/40 text-black text-[11px] h-full select-none">
      {/* 1. Network Activity Monitor */}
      <div
        className="flex items-center gap-1 cursor-pointer px-1 py-0.5 hover:bg-white/20 rounded"
        title={`${hardware.connectionType.toUpperCase()} (${hardware.connectionSpeedKbps} kbps) - ${
          activeDownloads.length
        } active download(s)`}
        onClick={onOpenDialUp}
      >
        <div className="flex items-center gap-0.5">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              txBlink ? 'bg-[#33ff33] shadow-[0_0_4px_#33ff33]' : 'bg-[#1b5e20]'
            }`}
            title="TX (Transmit)"
          />
          <div
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              rxBlink ? 'bg-[#ffb000] shadow-[0_0_4px_#ffb000]' : 'bg-[#7f4f00]'
            }`}
            title="RX (Receive)"
          />
        </div>
        <Wifi className="w-3.5 h-3.5 text-gray-700" />
      </div>

      {/* 2. Volume Popup Trigger */}
      <div className="relative">
        <button
          className="flex items-center cursor-pointer p-0.5 hover:bg-white/20 rounded"
          onClick={() => setIsVolumePopupOpen((prev) => !prev)}
          title="Master Volume"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-red-600" />
          ) : masterVolume > 0.5 ? (
            <Volume2 className="w-3.5 h-3.5 text-gray-800" />
          ) : (
            <Volume1 className="w-3.5 h-3.5 text-gray-800" />
          )}
        </button>

        {/* Vertical Volume Slider Popup */}
        {isVolumePopupOpen && (
          <div
            className="absolute bottom-8 right-0 z-50 orion-outset bg-[#c0c0c0] p-2 flex flex-col items-center gap-2 shadow-xl w-24 text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-bold">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : masterVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 [writing-mode:bt-lr] h-24 accent-blue-700 cursor-pointer"
            />
            <label className="flex items-center gap-1 text-[10px] cursor-pointer">
              <input type="checkbox" checked={isMuted} onChange={handleMuteToggle} />
              <span>Mute</span>
            </label>
          </div>
        )}
      </div>

      {/* 3. Live Simulation Clock */}
      <div
        className="font-mono text-[11px] px-1 cursor-default text-black drop-shadow-xs"
        title={`Day ${time.day} (${currentWeekday}) • ${time.timeOfDay.toUpperCase()}`}
      >
        {formatTime()}
      </div>
    </div>
  );
};
