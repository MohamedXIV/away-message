import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { useWindowStore } from '../store/useWindowStore';
import { useAudioStore } from '../store/useAudioStore';
import { soundManager } from '../audio/SoundManager';
import { Volume2, VolumeX, Volume1, Wifi } from 'lucide-react';

interface SystemTrayProps {
  onOpenDialUp: () => void;
}

interface TrayUnread {
  id: string;
  buddyId: string;
  buddyName: string;
  text: string;
}

export const SystemTray: React.FC<SystemTrayProps> = ({ onOpenDialUp }) => {
  const time = useSimulationStore((s) => s.state.time);
  const hardware = useSimulationStore((s) => s.state.hardware);
  const downloads = useSimulationStore((s) => s.state.downloads);
  const conversations = useSimulationStore((s) => s.state.social.conversations);
  const engine = useSimulationStore((s) => s.engine);
  const openWindow = useWindowStore((s) => s.openWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const windows = useWindowStore((s) => s.windows);
  const activeWindowId = useWindowStore((s) => s.activeWindowId);

  const { masterVolume, isMuted, setMasterVolume, setMute } = useAudioStore();

  const [isVolumePopupOpen, setIsVolumePopupOpen] = useState(false);
  const [isPulsePopupOpen, setIsPulsePopupOpen] = useState(false);
  const [txBlink, setTxBlink] = useState(false);
  const [rxBlink, setRxBlink] = useState(false);
  const seenTrayMessageIds = useRef<Set<string>>(new Set());
  const trayPrimed = useRef(false);

  // Pulse tray watcher: new buddy messages while Pulse is hidden → sound + badge.
  // (The in-app toasts keep working when the window is open and focused.)
  const unreadTrays: TrayUnread[] = [];
  Object.entries(conversations).forEach(([buddyId, msgs]) => {
    msgs.forEach((m) => {
      if (m.senderId !== 'player' && !m.isRead) {
        const buddy = engine.social.getBuddy(buddyId);
        unreadTrays.push({
          id: m.id,
          buddyId,
          buddyName: buddy?.displayName || buddyId,
          text: m.text,
        });
      }
    });
  });
  useEffect(() => {
    if (!trayPrimed.current) {
      Object.values(conversations).forEach((msgs) => msgs.forEach((m) => seenTrayMessageIds.current.add(m.id)));
      trayPrimed.current = true;
      return;
    }
    const pulseWin = Object.values(windows).find((w) => !!w && String(w.appId).includes('pulse'));
    const pulseHidden = !pulseWin || !pulseWin.isOpen || pulseWin.isMinimized || pulseWin.id !== activeWindowId;
    let fresh = 0;
    Object.values(conversations).forEach((msgs) => msgs.forEach((m) => {
      if (!seenTrayMessageIds.current.has(m.id)) {
        seenTrayMessageIds.current.add(m.id);
        if (m.senderId !== 'player' && pulseHidden) fresh++;
      }
    }));
    if (fresh > 0) soundManager.play('im_recv');
  }, [conversations, windows, activeWindowId]);

  const openPulseFromTray = (buddyId?: string) => {
    soundManager.play('click');
    setIsPulsePopupOpen(false);
    const id = openWindow('pulse');
    focusWindow(id);
    void buddyId;
  };

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

      {/* 3. Pulse tray icon (unread badge + quick preview) */}
      <div className="relative">
        <button
          className="relative flex items-center cursor-pointer p-0.5 hover:bg-white/20 rounded"
          onClick={() => setIsPulsePopupOpen((prev) => !prev)}
          title={unreadTrays.length > 0 ? `${unreadTrays.length} unread Pulse message(s)` : 'Pulse Messenger'}
        >
          <span className="text-[13px] leading-none">💬</span>
          {unreadTrays.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold px-1 rounded-full min-w-[14px] text-center">
              {unreadTrays.length > 9 ? '9+' : unreadTrays.length}
            </span>
          )}
        </button>
        {isPulsePopupOpen && (
          <div
            className="absolute bottom-8 right-0 z-50 orion-outset bg-[#c0c0c0] p-2 shadow-xl w-56 text-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold mb-1">Pulse Messenger</div>
            {unreadTrays.length === 0 ? (
              <div className="text-[10px] text-gray-700 italic">No unread messages. suspiciously quiet…</div>
            ) : (
              <div className="space-y-1 max-h-40 overflow-auto">
                {unreadTrays.slice(-4).reverse().map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openPulseFromTray(u.buddyId)}
                    className="w-full text-left bg-white border border-gray-400 rounded px-1.5 py-1 hover:bg-blue-50"
                  >
                    <div className="text-[10px] font-bold text-blue-900 truncate">{u.buddyName}</div>
                    <div className="text-[10px] text-gray-700 truncate">{u.text}</div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => openPulseFromTray()}
              className="mt-1.5 w-full bg-[#dfdfdf] hover:bg-white border border-gray-500 rounded text-[10px] font-bold py-1"
            >
              Open Pulse
            </button>
          </div>
        )}
      </div>

      {/* 4. Live Simulation Clock */}
      <div
        className="font-mono text-[11px] px-1 cursor-default text-black drop-shadow-xs"
        title={`Day ${time.day} (${currentWeekday}) • ${time.timeOfDay.toUpperCase()}`}
      >
        {formatTime()}
      </div>
    </div>
  );
};
