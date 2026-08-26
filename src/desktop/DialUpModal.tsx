import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { soundManager } from '../audio/SoundManager';
import { Phone, Wifi, Check } from 'lucide-react';

interface DialUpModalProps {
  onClose: () => void;
}

type HandshakeStage =
  | 'idle'
  | 'dialing'
  | 'ringback'
  | 'answering'
  | 'probing'
  | 'scrambling'
  | 'trellis'
  | 'authenticating'
  | 'connected'
  | 'error';

export const DialUpModal: React.FC<DialUpModalProps> = ({ onClose }) => {
  const hardware = useSimulationStore((s) => s.state.hardware);

  const [stage, setStage] = useState<HandshakeStage>('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to connect.');
  const [progressPercent, setProgressPercent] = useState(0);

  const cancelAudioRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup audio & timer on unmount
  useEffect(() => {
    return () => {
      if (cancelAudioRef.current) {
        cancelAudioRef.current();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleConnect = () => {
    soundManager.play('click');
    setStage('dialing');
    setStatusMessage('Dialing 555-0199 (OrionNet FastDial ISP)...');
    setProgressPercent(10);

    const stages: { stage: HandshakeStage; msg: string; pct: number; delay: number }[] = [
      { stage: 'ringback', msg: 'Waiting for ringback carrier...', pct: 25, delay: 1500 },
      { stage: 'answering', msg: 'Remote modem answered (V.90 56k Carrier detected)...', pct: 40, delay: 3000 },
      { stage: 'probing', msg: 'Probing line quality & frequency response...', pct: 55, delay: 4500 },
      { stage: 'scrambling', msg: 'Equalizing line noise and baud parameters...', pct: 70, delay: 6500 },
      { stage: 'trellis', msg: 'Negotiating Trellis V.34 modulation & rate...', pct: 85, delay: 8500 },
      { stage: 'authenticating', msg: 'Authenticating credentials (player@orion.net)...', pct: 95, delay: 10000 },
    ];

    stages.forEach(({ stage: stg, msg, pct, delay }) => {
      setTimeout(() => {
        setStage((current) => {
          if (current === 'idle' || current === 'connected') return current;
          setStatusMessage(msg);
          setProgressPercent(pct);
          return stg;
        });
      }, delay);
    });

    // Trigger procedural Web Audio handshake
    const audioHandle = soundManager.playDialup(() => {
      setStage('connected');
      setStatusMessage(`Connected at ${hardware.connectionSpeedKbps} kbps.`);
      setProgressPercent(100);
      cancelAudioRef.current = null;
    });

    cancelAudioRef.current = audioHandle.cancel;
  };

  const handleDisconnect = () => {
    soundManager.play('click');
    if (cancelAudioRef.current) {
      cancelAudioRef.current();
      cancelAudioRef.current = null;
    }
    setStage('idle');
    setStatusMessage('Disconnected.');
    setProgressPercent(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="orion-outset bg-[#c0c0c0] w-[420px] p-2.5 shadow-2xl text-black select-none font-sans text-xs">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#000080] via-[#1084d0] to-[#000040] text-white px-2 py-1 font-bold flex justify-between items-center mb-3">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>Connect OrionNet Dial-Up</span>
          </div>
          <button
            className="orion-button h-4 w-4 text-[10px] font-bold p-0 leading-none bg-[#c0c0c0] text-black"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Connection Form Details */}
        <div className="flex gap-3 mb-3 p-2 bg-white/60 orion-inset">
          <div className="w-12 h-12 flex items-center justify-center bg-blue-100 border border-blue-400 rounded shrink-0">
            {stage === 'connected' ? (
              <Wifi className="w-8 h-8 text-green-600 animate-pulse" />
            ) : stage !== 'idle' ? (
              <Phone className="w-8 h-8 text-amber-600 animate-bounce" />
            ) : (
              <Phone className="w-8 h-8 text-blue-600" />
            )}
          </div>

          <div className="flex-1 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">User Name:</span>
              <span className="font-mono font-semibold">player@orion.net</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Password:</span>
              <span className="font-mono font-semibold">••••••••••</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone number:</span>
              <span className="font-mono font-semibold">555-0199</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Connection Tier:</span>
              <span className="font-semibold uppercase text-blue-800">
                {hardware.connectionType} ({hardware.connectionSpeedKbps} kbps)
              </span>
            </div>
          </div>
        </div>

        {/* Handshake Progress Bar */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-[11px] text-gray-700">
            <span className="truncate pr-2 font-medium">{statusMessage}</span>
            <span className="font-mono font-semibold">{progressPercent}%</span>
          </div>
          <div className="w-full h-4 bg-white orion-inset p-0.5 relative overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-700 to-cyan-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-400">
          <div className="text-[11px] text-gray-600 flex items-center gap-1">
            {stage === 'connected' ? (
              <span className="text-green-700 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span>Modem: V.90 Standard 56k FaxModem</span>
            )}
          </div>

          <div className="flex gap-2">
            {stage === 'connected' ? (
              <button onClick={handleDisconnect} className="orion-button min-w-[80px] font-bold">
                Disconnect
              </button>
            ) : stage !== 'idle' ? (
              <button onClick={handleDisconnect} className="orion-button min-w-[80px] font-bold">
                Cancel
              </button>
            ) : (
              <button onClick={handleConnect} className="orion-button min-w-[80px] font-bold">
                Dial
              </button>
            )}
            <button onClick={onClose} className="orion-button min-w-[70px]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
