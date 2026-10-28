import React from 'react';
import type { SimulationPulseContact } from '../../../engine/kernel/SimulationPublication';

interface ChatTabHeaderProps {
  openBuddyIds: string[];
  activeBuddyId: string | null;
  buddies: Record<string, Pick<SimulationPulseContact, 'displayName'>>;
  unreadCounts: Record<string, number>;
  onSelectTab: (buddyId: string) => void;
  onCloseTab: (buddyId: string) => void;
  /** The Worker client shares this view without importing legacy simulation. */
  appearance?: 'classic' | 'pulse';
}

/** 2005 messenger window tabs. Switch and close are distinct keyboard controls. */
export const ChatTabHeader: React.FC<ChatTabHeaderProps> = ({
  openBuddyIds, activeBuddyId, buddies, unreadCounts,
  onSelectTab, onCloseTab, appearance = 'classic',
}) => {
  if (openBuddyIds.length === 0) return null;
  const isPulse = appearance === 'pulse';
  return (
    <nav aria-label="Open conversations" data-testid={isPulse ? 'worker-pulse-chat-tabs' : undefined}
      className={isPulse
        ? 'flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[#a38abe] bg-[#e5dbf1] px-1 pt-1 select-none'
        : 'flex shrink-0 items-end gap-1 overflow-x-auto border-b border-gray-400 bg-[#dfdfdf] px-1 pt-1 select-none'}>
      {openBuddyIds.map(id => {
        const name = buddies[id]?.displayName ?? id;
        const active = activeBuddyId === id;
        const unread = unreadCounts[id] ?? 0;
        return (
          <div key={id} className={isPulse
            ? `flex shrink-0 items-center border-x border-t border-[#a38abe] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${
              active ? 'bg-[#fffdf8] text-[#452765]' : 'bg-[#d4c4e6] text-[#5b4770] hover:bg-[#eadff4]'
            }`
            : `flex shrink-0 items-center rounded-t border-x border-t ${
              active ? 'border-gray-400 bg-white text-blue-900' : 'border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-100'
            }`}>
            <button type="button" aria-label={`Switch to ${name}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelectTab(id)}
              className={`flex min-w-0 items-center gap-1 px-2 py-1 text-left text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7549a6] ${active ? 'font-bold' : ''}`}>
              {isPulse && <span aria-hidden="true" className="text-[#74449e]">✉</span>}
              <span className="max-w-[110px] truncate">{name}</span>
              {unread > 0 && (
                <span aria-label={`${unread} unread`}
                  className="shrink-0 rounded-full border border-[#a62d29] bg-[#ca493c] px-1 text-[9px] font-bold leading-3 text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            <button type="button" onClick={() => onCloseTab(id)}
              aria-label={`Close conversation with ${name}`}
              className={`mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7549a6] ${
                isPulse ? 'text-[#795b94] hover:bg-[#bca5d5] hover:text-[#3c2158]' : 'text-gray-500 hover:bg-gray-300 hover:text-red-700'
              }`}>×</button>
          </div>
        );
      })}
    </nav>
  );
};
