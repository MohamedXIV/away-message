import React, { useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { AwayMessageEditor } from './AwayMessageEditor';

export const UserProfileHeader: React.FC = () => {
  const presence = useSimulationStore((s) => s.state.social.presence);
  const playerPresence = presence['player'] || { status: 'online', awayMessage: '' };
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const currentStatus = playerPresence.status || 'online';
  const awayMessage = playerPresence.awayMessage || 'Listening to lo-fi tape hiss';

  return (
    <div className="bg-[#ece9d8] border-b border-gray-400 p-2 flex flex-col gap-1 select-none">
      <div className="flex items-center gap-2">
        {/* User Avatar */}
        <div className="w-9 h-9 bg-blue-800 text-white rounded border border-gray-400 flex items-center justify-center text-lg shadow-inner">
          💻
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-blue-950 truncate">wanderer06</span>
            <div className={`w-2.5 h-2.5 rounded-full ${statusColors[currentStatus] || 'bg-gray-400'} border border-black/20`} />
          </div>

          {/* Status / Away Message */}
          <div
            onClick={() => setIsEditorOpen(true)}
            className="text-[11px] text-gray-600 truncate hover:text-blue-800 hover:underline cursor-pointer italic"
            title="Click to change away message"
          >
            "{awayMessage}"
          </div>
        </div>

        {/* Presence Selector */}
        <button
          onClick={() => setIsEditorOpen(true)}
          className="bg-white border border-gray-400 text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:bg-gray-50 font-bold"
        >
          {currentStatus.toUpperCase()}
        </button>
      </div>

      <AwayMessageEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
};
