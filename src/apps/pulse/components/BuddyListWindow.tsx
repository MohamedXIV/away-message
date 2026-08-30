import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { UserProfileHeader } from './UserProfileHeader';
import { BuddyGroup } from './BuddyGroup';
import { PULSE_GROUPS, PULSE_ROOMS } from '../data/pulseRooms';
import type { PulseLoginSession } from './PulseLoginSplash';
import type { PulseActivityEntry } from '../types';

export type PulseListView = 'contacts' | 'rooms';

interface BuddyListWindowProps {
  username: string;
  session: PulseLoginSession;
  view: PulseListView;
  activeRoomId: string | null;
  joinedRoomIds: string[];
  roomUnreadCounts: Record<string, number>;
  friendRequestStatus: 'pending' | 'accepted' | 'ignored';
  onOpenChat: (buddyId: string) => void;
  onInspect: (buddyId: string) => void;
  onOpenRoom: (roomId: string) => void;
  onViewChange: (view: PulseListView) => void;
  onOpenRequests: () => void;
  onSignOut: () => void;
  onBuzz: (buddyId: string) => void;
  unreadCounts: Record<string, number>;
  activityFeed: PulseActivityEntry[];
}

const presenceRank: Record<string, number> = { online: 0, away: 1, busy: 2, offline: 3 };

export const BuddyListWindow: React.FC<BuddyListWindowProps> = ({
  username,
  session,
  view,
  activeRoomId,
  joinedRoomIds,
  roomUnreadCounts,
  friendRequestStatus,
  onOpenChat,
  onInspect,
  onOpenRoom,
  onViewChange,
  onOpenRequests,
  onSignOut,
  onBuzz,
  unreadCounts,
  activityFeed,
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const presenceMap = useSimulationStore((s) => s.state.social.presence);
  const buddies = engine.social.getBuddies();
  const [searchFilter, setSearchFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ buddyId: string; x: number; y: number } | null>(null);

  const buddiesWithPresence = useMemo(() => buddies
    .filter((buddy) => buddy.displayName.toLowerCase().includes(searchFilter.toLowerCase()) || buddy.handle.toLowerCase().includes(searchFilter.toLowerCase()))
    .map((buddy) => ({ buddy, presence: presenceMap[buddy.id] || { status: 'offline', awayMessage: '' } }))
    .sort((a, b) => (presenceRank[a.presence.status] ?? 9) - (presenceRank[b.presence.status] ?? 9)), [buddies, presenceMap, searchFilter]);

  const groupedBuddies = Object.entries(PULSE_GROUPS).map(([groupId, group]) => ({
    id: groupId,
    label: group.label,
    buddies: buddiesWithPresence.filter(({ buddy }) => group.memberIds.includes(buddy.id)),
  }));

  const activeCount = buddiesWithPresence.filter(({ presence }) => presence.status !== 'offline').length;
  const contextBuddy = contextMenu ? buddies.find((buddy) => buddy.id === contextMenu.buddyId) : undefined;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#f6f6f6] font-sans text-xs select-none" onClick={() => setContextMenu(null)}>
      {contextMenu && contextBuddy && <div className="fixed z-50 w-44 border-2 border-[#38516e] bg-white p-1 font-sans text-[11px] shadow-[3px_3px_0_rgba(15,35,60,0.3)]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-[#b8c3ce] px-2 py-1 font-bold text-[#274e78]">{contextBuddy.displayName}</div>
        <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => { onOpenChat(contextBuddy.id); setContextMenu(null); }}>Send IM</button>
        <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => { onInspect(contextBuddy.id); setContextMenu(null); }}>View Profile</button>
        <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => { onBuzz(contextBuddy.id); setContextMenu(null); }}>Buzz / Nudge</button>
        <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => { onInspect(contextBuddy.id); setContextMenu(null); }}>Away Message History</button>
      </div>}
      <div className="flex gap-3 border-b border-gray-400 bg-[#dfdfdf] px-2 py-0.5 text-[11px] text-gray-800">
        <span className="cursor-pointer font-bold hover:underline">Contacts</span>
        <span className="cursor-pointer hover:underline">Actions</span>
        <span className="cursor-pointer hover:underline">Tools</span>
        <span className="cursor-pointer hover:underline">Help</span>
      </div>

      <UserProfileHeader username={username} session={session} onSignOut={onSignOut} />

      <div className="flex border-b border-gray-400 bg-[#ece9d8] p-1">
        <button onClick={() => onViewChange('contacts')} className={`flex-1 border px-2 py-1 text-[11px] font-bold ${view === 'contacts' ? 'border-gray-500 bg-white' : 'border-transparent text-gray-600'}`}>Contacts</button>
        <button onClick={() => onViewChange('rooms')} className={`flex-1 border px-2 py-1 text-[11px] font-bold ${view === 'rooms' ? 'border-gray-500 bg-white' : 'border-transparent text-gray-600'}`}>Chat Rooms</button>
      </div>

      {view === 'contacts' ? (
        <>
          <div className="border-b border-gray-300 bg-[#ece9d8] p-1.5">
            <input type="text" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Search contacts..." className="w-full rounded border border-gray-400 bg-white px-2 py-1 text-xs outline-none shadow-inner" />
          </div>
          {activityFeed.length > 0 && <div className="mx-1 mt-1 border border-[#b8c3ce] bg-[#f3f6f8] px-2 py-1">
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-[#456990]"><span>Pulse activity</span><span className="font-normal text-gray-500">last {Math.min(activityFeed.length, 3)}</span></div>
            <div className="space-y-0.5">
              {activityFeed.slice(-3).reverse().map((entry) => <button key={entry.id} onClick={() => onOpenChat(entry.buddyId)} className="block w-full truncate text-left text-[10px] text-gray-700 hover:text-blue-800 hover:underline">{entry.text}</button>)}
            </div>
          </div>}
          {friendRequestStatus === 'pending' ? <button onClick={onOpenRequests} className="mx-1 mt-1 flex items-center gap-2 border border-[#c39a35] bg-[#fff4bd] px-2 py-1 text-left text-[10px] font-bold text-[#6d5000] hover:bg-[#ffed8e]">
            <span className="rounded-full bg-[#d96c3b] px-1.5 py-0.5 text-white">1</span>
            <span>New friend request</span>
          </button> : <div className="mx-1 mt-1 border border-[#b8c3ce] bg-[#f3f6f8] px-2 py-1 text-[10px] text-gray-600">Friend request {friendRequestStatus}.</div>}
          <div className="flex-1 space-y-1 overflow-y-auto bg-white p-1">
            {groupedBuddies.map((group, index) => <BuddyGroup key={group.id} title={group.label} buddies={group.buddies} unreadCounts={unreadCounts} onOpenChat={onOpenChat} onInspect={onInspect} onContextMenu={(buddyId, event) => setContextMenu({ buddyId, x: event.clientX, y: event.clientY })} defaultExpanded={index === 0} />)}
            {groupedBuddies.every((group) => group.buddies.length === 0) && <div className="p-4 text-center text-[11px] italic text-gray-500">No contacts match this search.</div>}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto bg-white p-1">
          <div className="mb-2 px-1 text-[10px] text-gray-500">Join a room to see live public conversations.</div>
          <div className="space-y-1">
            {PULSE_ROOMS.map((room) => (
              <button key={room.id} onClick={() => onOpenRoom(room.id)} className={`w-full border p-2 text-left transition-colors ${activeRoomId === room.id ? 'border-[#456990] bg-[#dceafa]' : 'border-transparent hover:border-gray-300 hover:bg-[#f5f7fa]'}`}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border border-black/20" style={{ backgroundColor: room.color }} />
                  <span className="font-bold text-[#1c4167]">{room.name}</span>
                  {(roomUnreadCounts[room.id] ?? 0) > 0 && <span className="rounded-full bg-[#d96c3b] px-1.5 py-0.5 text-[9px] font-bold text-white">{roomUnreadCounts[room.id] ?? 0}</span>}
                  <span className="ml-auto text-[10px] text-gray-500">{room.participantIds.length + 1}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-[10px] text-gray-600">{room.topic}</span><span className="text-[9px] font-bold uppercase text-gray-400">{joinedRoomIds.includes(room.id) ? 'joined' : 'join'}</span></div>
              </button>
            ))}
          </div>
          <div className="mt-3 border-t border-dashed border-gray-300 pt-2 text-[10px] text-gray-500">Room list updated a moment ago.</div>
        </div>
      )}

      <div className="flex justify-between border-t border-gray-400 bg-[#ece9d8] px-2 py-1 text-[10px] text-gray-500">
        <span>{activeCount} contacts active</span>
        <button onClick={onSignOut} className="text-blue-800 hover:underline">Sign out</button>
      </div>
    </div>
  );
};
