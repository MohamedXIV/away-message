import React, { useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { AWAY_MESSAGE_PRESETS, AwayPreset } from '../data/awayMessagePresets';

interface AwayMessageEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AwayMessageEditor: React.FC<AwayMessageEditorProps> = ({ isOpen, onClose }) => {
  const presence = useSimulationStore((s) => s.state.social.presence);
  const playerPresence = presence['player'] || { status: 'online', awayMessage: '' };

  const [messageInput, setMessageInput] = useState(playerPresence.awayMessage || '');

  if (!isOpen) return null;

  const handleSelectPreset = (preset: AwayPreset) => {
    setMessageInput(preset.message);
  };

  const handleSetAway = () => {
    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        social: {
          ...prev.state.social,
          presence: {
            ...prev.state.social.presence,
            player: {
              status: 'away',
              awayMessage: messageInput.trim() || 'Away from desk',
              customAwayMessage: messageInput.trim(),
            },
          },
        },
      },
    }));
    onClose();
  };

  const handleClearAway = () => {
    useSimulationStore.setState((prev) => ({
      state: {
        ...prev.state,
        social: {
          ...prev.state.social,
          presence: {
            ...prev.state.social.presence,
            player: {
              status: 'online',
              awayMessage: '',
              customAwayMessage: undefined,
            },
          },
        },
      },
    }));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-[#ece9d8] border-2 border-gray-500 rounded shadow-2xl p-3 w-full max-w-md text-black font-sans text-xs flex flex-col gap-3">
        <div className="flex justify-between items-center bg-blue-900 text-white px-2 py-1 rounded font-bold text-xs">
          <span>Set Custom Away Message</span>
          <button onClick={onClose} className="hover:bg-red-600 px-1.5 rounded">✕</button>
        </div>

        <div>
          <label className="font-bold text-gray-700 block mb-1">Custom Message / Lyrics / Status:</label>
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Type your away message here..."
            className="w-full p-2 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner resize-none font-sans"
          />
          <span className="text-[10px] text-gray-500 block text-right">{messageInput.length}/300 chars</span>
        </div>


        <div>
          <label className="font-bold text-gray-700 block mb-1">Select from Period Presets:</label>
          <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-400 bg-white p-1.5 rounded">
            {AWAY_MESSAGE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className="w-full text-left p-1 rounded hover:bg-blue-100 text-xs flex flex-col truncate"
              >
                <strong className="text-blue-900 text-[11px]">{preset.name}</strong>
                <span className="text-[10px] text-gray-600 truncate">{preset.message}</span>
              </button>
            ))}
          </div>
        </div>


        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
          <button
            onClick={handleClearAway}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded font-bold text-xs cursor-pointer"
          >
            I’m Back (Set Online)
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSetAway}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow cursor-pointer text-xs"
            >
              Set as Away
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
