import React, { useState } from 'react';
import { BuddyCharacter, BuddyPresence } from '../../../engine/types';
import { BuddyItem } from './BuddyItem';

interface BuddyGroupProps {
  title: string;
  groupId?: string;
  buddies: Array<{ buddy: BuddyCharacter; presence: BuddyPresence; lastSeen?: string }>;
  unreadCounts: Record<string, number>;
  onOpenChat: (buddyId: string) => void;
  onInspect?: (buddyId: string) => void;
  onContextMenu?: (buddyId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  defaultExpanded?: boolean;
  onRename?: (groupId: string, newLabel: string) => void;
  onMoveUp?: (groupId: string) => void;
  onMoveDown?: (groupId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const BuddyGroup: React.FC<BuddyGroupProps> = ({
  title,
  groupId,
  buddies,
  unreadCounts,
  onOpenChat,
  onInspect,
  onContextMenu,
  defaultExpanded = true,
  onRename,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(title);

  if (buddies.length === 0) return null;

  const handleRenameSubmit = () => {
    const clean = draftLabel.trim().slice(0, 32);
    if (clean && clean !== title && groupId && onRename) onRename(groupId, clean);
    setIsEditing(false);
  };

  return (
    <div className="mb-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 text-left font-bold text-[11px] text-gray-700 flex items-center gap-1.5 py-1 px-1 hover:bg-gray-200/50 rounded"
        >
          <span className="text-[9px]">{isExpanded ? '▾' : '▰'}</span>
          {isEditing && groupId ? (
            <input
              autoFocus
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleRenameSubmit();
                if (event.key === 'Escape') { setDraftLabel(title); setIsEditing(false); }
              }}
              onClick={(event) => event.stopPropagation()}
              className="min-w-0 flex-1 border border-blue-400 bg-white px-1 py-0.5 text-[11px] font-bold outline-none"
            />
          ) : (
            <span className="truncate">{title} ({buddies.length})</span>
          )}
        </button>
        {groupId && onRename && !isEditing && (
          <button
            onClick={() => { setDraftLabel(title); setIsEditing(true); }}
            className="shrink-0 rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Rename group"
          >
            ✎
          </button>
        )}
        {groupId && (onMoveUp || onMoveDown) && (
          <span className="flex shrink-0 gap-0.5">
            <button
              disabled={isFirst}
              onClick={() => onMoveUp?.(groupId!)}
              className="rounded px-1 text-[10px] text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Move up"
            >
              ▲
            </button>
            <button
              disabled={isLast}
              onClick={() => onMoveDown?.(groupId!)}
              className="rounded px-1 text-[10px] text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Move down"
            >
              ▼
            </button>
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="pl-2 space-y-0.5">
          {buddies.map(({ buddy, presence, lastSeen }) => (
            <BuddyItem
              key={buddy.id}
              buddy={buddy}
              presence={presence}
              unreadCount={unreadCounts[buddy.id] || 0}
              onOpenChat={onOpenChat}
              onInspect={onInspect}
              onContextMenu={onContextMenu}
              lastSeen={lastSeen}
            />
          ))}
        </div>
      )}
    </div>
  );
};
