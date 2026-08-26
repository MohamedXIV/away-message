import React from 'react';
import { BuddyCharacter } from '../../../engine/types';

interface ChatTabHeaderProps {
  openBuddyIds: string[];
  activeBuddyId: string;
  buddies: Record<string, BuddyCharacter>;
  unreadCounts: Record<string, number>;
  onSelectTab: (buddyId: string) => void;
  onCloseTab: (buddyId: string) => void;
}

export const ChatTabHeader: React.FC<ChatTabHeaderProps> = ({
  openBuddyIds,
  activeBuddyId,
  buddies,
  unreadCounts,
  onSelectTab,
  onCloseTab,
}) => {
  return (
    <div className="flex items-center gap-1 bg-[#dfdfdf] border-b border-gray-400 px-1 pt-1 overflow-x-auto select-none">
      {openBuddyIds.map((id) => {
        const buddy = buddies[id];
        const isActive = id === activeBuddyId;
        const unreads = unreadCounts[id] || 0;

        return (
          <div
            key={id}
            onClick={() => onSelectTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1 border-t border-l border-r rounded-t text-xs cursor-pointer ${
              isActive
                ? 'bg-white font-bold border-gray-400 text-blue-900 -mb-px pb-1.5'
                : 'bg-gray-200 hover:bg-gray-100 border-gray-300 text-gray-700'
            }`}
          >
            <span className="truncate max-w-[90px]">{buddy?.displayName || id}</span>
            {unreads > 0 && (
              <span className="bg-red-600 text-white font-bold text-[9px] px-1 py-0.2 rounded-full">
                {unreads}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(id);
              }}
              className="text-gray-400 hover:text-red-600 font-bold ml-1 text-[10px]"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
