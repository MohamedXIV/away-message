import React, { useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { AwayMessageEditor } from './AwayMessageEditor';
import type { PulseLoginSession } from './PulseLoginSplash';

interface UserProfileHeaderProps {
  username: string;
  session: PulseLoginSession;
  onSignOut: () => void;
}

export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({ username, session, onSignOut }) => {
  const presence = useSimulationStore((s) => s.state.social.presence);
  const playerPresence = presence['player'] || { status: session.status, awayMessage: session.awayMessage };
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  const currentStatus = playerPresence.status || session.status || 'online';
  const awayMessage = playerPresence.awayMessage || session.awayMessage || 'Available';
  const avatarLetter = username.trim().charAt(0).toUpperCase() || 'P';

  return (
    <div className="border-b border-gray-400 bg-[#ece9d8] p-2 select-none">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded border border-gray-400 bg-gradient-to-br from-[#315b94] to-[#172d50] text-lg font-bold text-white shadow-inner">{avatarLetter}</div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-blue-950">{username}</span>
            <div className={`h-2.5 w-2.5 rounded-full border border-black/20 ${statusColors[currentStatus] || 'bg-gray-400'}`} />
          </div>
          <button onClick={() => setIsEditorOpen(true)} className="block max-w-full truncate text-left text-[11px] italic text-gray-600 hover:text-blue-800 hover:underline" title="Click to change away message">“{awayMessage}”</button>
        </div>
        <button onClick={() => setIsEditorOpen(true)} className="rounded border border-gray-400 bg-white px-1.5 py-0.5 text-[10px] font-bold outline-none hover:bg-gray-50">{currentStatus.toUpperCase()}</button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
        <span>Signed in • {session.status === 'online' ? 'available for IMs' : session.status}</span>
        <button onClick={onSignOut} className="text-blue-800 hover:underline">Sign out</button>
      </div>

      <AwayMessageEditor isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} />
    </div>
  );
};
