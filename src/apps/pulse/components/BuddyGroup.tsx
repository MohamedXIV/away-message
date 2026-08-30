import React, { useState } from 'react';
import { BuddyCharacter, BuddyPresence } from '../../../engine/types';
import { BuddyItem } from './BuddyItem';

interface BuddyGroupProps {
  title: string;
  buddies: Array<{ buddy: BuddyCharacter; presence: BuddyPresence }>;
  unreadCounts: Record<string, number>;
  onOpenChat: (buddyId: string) => void;
  onInspect?: (buddyId: string) => void;
  onContextMenu?: (buddyId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  defaultExpanded?: boolean;
}

export const BuddyGroup: React.FC<BuddyGroupProps> = ({
  title,
  buddies,
  unreadCounts,
  onOpenChat,
  onInspect,
  onContextMenu,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (buddies.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left font-bold text-[11px] text-gray-700 flex items-center gap-1.5 py-1 px-1 hover:bg-gray-200/50 rounded"
      >
        <span className="text-[9px]">{isExpanded ? '▾' : '▰'}</span>
        <span>{title} ({buddies.length})</span>
      </button>

      {isExpanded && (
        <div className="pl-2 space-y-0.5">
          {buddies.map(({ buddy, presence }) => (
            <BuddyItem
              key={buddy.id}
              buddy={buddy}
              presence={presence}
              unreadCount={unreadCounts[buddy.id] || 0}
              onOpenChat={onOpenChat}
              onInspect={onInspect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};
