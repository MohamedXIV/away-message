import React, { useState, useEffect } from 'react';
import type { SimulationChromeRead } from '../engine/kernel/SimulationPublication';
import { useWindowStore } from '../store/useWindowStore';
import { useAudioStore } from '../store/useAudioStore';
import { soundManager } from '../audio/SoundManager';
import { OsIcon } from './OsIcon';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

export interface SystemTrayChromeProps {
  onOpenDialUp: () => void;
  chrome: SimulationChromeRead;
}

/** Presentation-only OS tray. World event sound subscription lives in the legacy adapter. */
export const SystemTrayChrome: React.FC<SystemTrayChromeProps> = ({ onOpenDialUp, chrome }) => {
  const time = chrome.time;
  const unreadTrays = chrome.unreadPreviews;
  const openWindow = useWindowStore((s) => s.openWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);

  const { masterVolume, isMuted, setMasterVolume, setMute } = useAudioStore();

  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const [isPulsePopupOpen, setIsPulsePopupOpen] = useState(false);
  const [txBlink, setTxBlink] = useState(false);
  const [rxBlink, setRxBlink] = useState(false);

  const openPulseFromTray = (buddyId?: string) => {
    soundManager.play('click');
    setIsPulsePopupOpen(false);
    const id = openWindow('pulse');
    focusWindow(id);
    void buddyId;
  };

  const activeDownloadCount = chrome.activeDownloadCount;
  useEffect(() => {
    if (activeDownloadCount === 0) {
      setTxBlink(false);
      setRxBlink(false);
      return;
    }
    const interval = setInterval(() => {
      setTxBlink((prev) => !prev);
      setRxBlink(Math.random() > 0.3);
    }, 250);
    return () => clearInterval(interval);
  }, [activeDownloadCount]);

  const handleVolumeChange = (newVol: number) => {
    setMasterVolume(newVol);
  };

  const handleMuteToggle = () => {
    setMute(!isMuted);
    soundManager.play('click');
  };

  const formatTime = () => {
    const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
    const ampm = time.hour >= 12 ? 'PM' : 'AM';
    const minuteStr = time.minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${ampm}`;
  };

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const currentWeekday = weekdays[(time.day - 1) % 7];

  return (
    <div className="os-tray" data-testid="worker-system-tray">
      <button
        type="button"
        className="os-tray-button"
        title={`${chrome.connectionType ? chrome.connectionType.toUpperCase() : 'OFFLINE'} (${chrome.connectionSpeedKbps} kbps) - ${activeDownloadCount} active download(s)`}
        aria-label="Network connection"
        onClick={onOpenDialUp}
      >
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span
            className={`h-1.5 w-1.5 rounded-full ${txBlink ? 'bg-[#33ff33] shadow-[0_0_4px_#33ff33]' : 'bg-[#1b5e20]'}`}
            title="TX (Transmit)"
          />
          <span
            className={`h-1.5 w-1.5 rounded-full ${rxBlink ? 'bg-[#ffb000] shadow-[0_0_4px_#ffb000]' : 'bg-[#7f4f00]'}`}
            title="RX (Receive)"
          />
        </span>
        <OsIcon kind="dialup" size={14} />
      </button>

      <div className="relative">
        <button
          type="button"
          className="os-tray-button"
          aria-label="Master Volume"
          onClick={() => setIsVolumePopupOpen((prev) => !prev)}
          title="Master Volume"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5 text-red-600" />
          ) : masterVolume > 0.5 ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <Volume1 className="h-3.5 w-3.5" />
          )}
        </button>

        {isVolumePopupOpen && (
          <div
            className="os-tray-popup flex w-24 flex-col items-center gap-2"
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
              className="h-24 w-16 cursor-pointer accent-blue-700 [writing-mode:bt-lr]"
              aria-label="Master volume"
            />
            <label className="flex cursor-pointer items-center gap-1 text-[10px]">
              <input type="checkbox" checked={isMuted} onChange={handleMuteToggle} />
              <span>Mute</span>
            </label>
          </div>
        )}
      </div>

      {chrome.pulseInstalled && <div className="relative">
        <button
          type="button"
          className="os-tray-button relative"
          aria-label="Pulse Messenger"
          onClick={() => setIsPulsePopupOpen((prev) => !prev)}
          title={chrome.unreadCount > 0 ? `${chrome.unreadCount} unread Pulse message(s)` : 'Pulse Messenger'}
        >
          <OsIcon kind="pulse" size={15} />
          {chrome.unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full bg-red-600 px-1 text-center text-[8px] font-bold text-white">
              {chrome.unreadCount > 9 ? '9+' : chrome.unreadCount}
            </span>
          )}
        </button>
        {isPulsePopupOpen && (
          <div className="os-tray-popup w-56" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-[10px] font-bold">Pulse Messenger</div>
            {chrome.unreadCount === 0 ? (
              <div className="text-[10px] italic opacity-70">No unread messages. suspiciously quiet…</div>
            ) : (
              <div className="max-h-40 space-y-1 overflow-auto">
                {unreadTrays.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => openPulseFromTray(u.buddyId)}
                    className="w-full rounded border border-gray-400 bg-white px-1.5 py-1 text-left text-black hover:bg-blue-50"
                  >
                    <div className="truncate text-[10px] font-bold text-blue-900">{u.buddyName}</div>
                    <div className="truncate text-[10px] text-gray-700">{u.text}</div>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => openPulseFromTray()} className="os-button mt-1.5 w-full font-bold">
              Open Pulse
            </button>
          </div>
        )}
      </div>}

      <div
        className="os-tray-clock cursor-default"
        title={`Day ${time.day} (${currentWeekday}) • ${time.timeOfDay.toUpperCase()}`}
      >
        {formatTime()}
      </div>
    </div>
  );
};
