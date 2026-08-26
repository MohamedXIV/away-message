import React, { useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { UserProfileHeader } from './UserProfileHeader';
import { BuddyGroup } from './BuddyGroup';
import { BuddyCharacter, BuddyPresence } from '../../../engine/types';

interface BuddyListWindowProps {
  onOpenChat: (buddyId: string) => void;
  unreadCounts: Record<string, number>;
}

export const BuddyListWindow: React.FC<BuddyListWindowProps> = ({
  onOpenChat,
  unreadCounts,
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const presenceMap = useSimulationStore((s) => s.state.social.presence);
  const buddies = engine.social.getBuddies();
  const [searchFilter, setSearchFilter] = useState('');

  const filteredBuddies = buddies.filter(
    (b) =>
      b.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      b.handle.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const buddiesWithPresence: Array<{ buddy: BuddyCharacter; presence: BuddyPresence }> = filteredBuddies.map((b) => ({
    buddy: b,
    presence: presenceMap[b.id] || { status: 'offline', awayMessage: '' },
  }));

  const onlineBuddies = buddiesWithPresence.filter((bp) => bp.presence.status === 'online');
  const awayBuddies = buddiesWithPresence.filter((bp) => bp.presence.status === 'away' || bp.presence.status === 'busy');
  const offlineBuddies = buddiesWithPresence.filter((bp) => bp.presence.status === 'offline');

  return (
    <div className="w-full h-full bg-[#f6f6f6] flex flex-col select-none overflow-hidden font-sans text-xs">
      {/* Menu Bar */}
      <div className="flex gap-2 px-2 py-0.5 bg-[#dfdfdf] border-b border-gray-400 text-xs text-gray-800">
        <span className="hover:underline cursor-pointer">Contacts</span>
        <span className="hover:underline cursor-pointer">Actions</span>
        <span className="hover:underline cursor-pointer">Tools</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* User Header */}
      <UserProfileHeader />

      {/* Search Input Bar */}
      <div className="p-1.5 bg-[#ece9d8] border-b border-gray-300">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="🔍 Search buddies..."
          className="w-full px-2 py-0.5 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner"
        />
      </div>

      {/* Buddy Groups Accordion List */}
      <div className="flex-1 overflow-y-auto p-1 space-y-1 bg-white">
        <BuddyGroup
          title="Online"
          buddies={onlineBuddies}
          unreadCounts={unreadCounts}
          onOpenChat={onOpenChat}
        />

        <BuddyGroup
          title="Away & Busy"
          buddies={awayBuddies}
          unreadCounts={unreadCounts}
          onOpenChat={onOpenChat}
        />

        <BuddyGroup
          title="Offline"
          buddies={offlineBuddies}
          unreadCounts={unreadCounts}
          onOpenChat={onOpenChat}
          defaultExpanded={true}
        />
      </div>

      {/* Footer Status */}
      <div className="bg-[#ece9d8] border-t border-gray-400 px-2 py-0.5 text-[10px] text-gray-500 flex justify-between">
        <span>{onlineBuddies.length + awayBuddies.length} buddies active</span>
        <span>Pulse 5.2</span>
      </div>
    </div>
  );
};
