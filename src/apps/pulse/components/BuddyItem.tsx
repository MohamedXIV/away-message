import React from 'react';
import { BuddyCharacter, BuddyPresence } from '../../../engine/types';

interface BuddyItemProps {
  buddy: BuddyCharacter;
  presence: BuddyPresence;
  unreadCount?: number;
  onOpenChat: (buddyId: string) => void;
  onInspect?: (buddyId: string) => void;
  onContextMenu?: (buddyId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  // P6.5 last footprint for offline buddies (e.g. "last seen Day 2, 21:05")
  lastSeen?: string;
}

/** P6.5 formatter: absolute game minute → "last seen Day D, HH:MM" ('' when never). */
export function formatLastSeen(minute: number): string {
  if (!Number.isFinite(minute) || minute <= 0) return '';
  const day = Math.floor(minute / 1440) + 1;
  const hh = String(Math.floor((minute % 1440) / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `last seen Day ${day}, ${hh}:${mm}`;
}

export const BuddyItem: React.FC<BuddyItemProps> = ({
  buddy,
  presence,
  unreadCount = 0,
  onOpenChat,
  onInspect,
  onContextMenu,
  lastSeen,
}) => {
  const statusDotColor = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-400',
  }[presence.status] || 'bg-gray-400';

  return (
    <div
      onClick={() => onInspect?.(buddy.id)}
      onDoubleClick={() => onOpenChat(buddy.id)}
      onContextMenu={(event) => { event.preventDefault(); onContextMenu?.(buddy.id, event); }}
      className="flex items-center gap-2 p-1.5 hover:bg-blue-100 rounded cursor-pointer select-none transition-colors group"
      title={`Click for profile • double-click to chat with ${buddy.displayName}`}
    >
      <div className="w-6 h-6 rounded bg-gray-200 border border-gray-400 flex items-center justify-center text-xs shrink-0 relative shadow-xs">
        <span>👤</span>
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDotColor} border border-white`}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs text-gray-900 group-hover:text-blue-900 truncate">
            {buddy.displayName}
          </span>
          {unreadCount > 0 && (
            <span className="bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.2 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        <span className="text-[10px] text-gray-500 truncate block italic">
          {presence.status === 'offline' && lastSeen
            ? lastSeen
            : presence.awayMessage ? `"${presence.awayMessage}"` : presence.status}
        </span>
      </div>
    </div>
  );
};
