import React, { useMemo, useState } from 'react';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { UserProfileHeader } from './UserProfileHeader';
import { BuddyGroup } from './BuddyGroup';
import { PULSE_GROUPS, PULSE_ROOMS } from '../data/pulseRooms';
import type { PulseLoginSession } from './PulseLoginSplash';
import type { PulseActivityEntry } from '../types';
import type { PulseSkin } from '../persistence';

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
  blockedBuddyIds?: string[];
  groupLabels?: Record<string, string>;
  groupOrder?: string[];
  onBlockBuddy?: (buddyId: string) => void;
  onUnblockBuddy?: (buddyId: string) => void;
  onRemoveBuddy?: (buddyId: string) => void;
  onInviteBuddyToRoom?: (buddyId: string, roomId: string) => void;
  onRenameGroup?: (groupId: string, newLabel: string) => void;
  onReorderGroup?: (groupId: string, direction: 'up' | 'down') => void;
  currentSlotId?: string;
  onSwitchSlot?: (slotId: string) => void;
  pulseSkin?: PulseSkin;
  onChangeSkin?: (skin: PulseSkin) => void;
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
  blockedBuddyIds = [],
  groupLabels = {},
  groupOrder,
  onBlockBuddy,
  onUnblockBuddy,
  onRemoveBuddy,
  onInviteBuddyToRoom,
  onRenameGroup,
  onReorderGroup,
  currentSlotId = 'slot_1',
  onSwitchSlot,
  pulseSkin = 'blue',
  onChangeSkin,
}) => {
  const engine = useSimulationStore((s) => s.engine);
  const presenceMap = useSimulationStore((s) => s.state.social.presence);
  const buddies = engine.social.getBuddies();
  const [searchFilter, setSearchFilter] = useState('');
  const [contextMenu, setContextMenu] = useState<{ buddyId: string; x: number; y: number } | null>(null);
  const [showInviteSubmenu, setShowInviteSubmenu] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const buddiesWithPresence = useMemo(() => buddies
    .filter((buddy) => buddy.displayName.toLowerCase().includes(searchFilter.toLowerCase()) || buddy.handle.toLowerCase().includes(searchFilter.toLowerCase()))
    .map((buddy) => ({ buddy, presence: presenceMap[buddy.id] || { status: 'offline', awayMessage: '' } }))
    .sort((a, b) => (presenceRank[a.presence.status] ?? 9) - (presenceRank[b.presence.status] ?? 9)), [buddies, presenceMap, searchFilter]);

  const visibleBuddies = useMemo(() => buddiesWithPresence.filter(({ buddy }) => !blockedBuddyIds.includes(buddy.id)), [buddiesWithPresence, blockedBuddyIds]);
  const blockedBuddies = useMemo(() => buddiesWithPresence.filter(({ buddy }) => blockedBuddyIds.includes(buddy.id)), [buddiesWithPresence, blockedBuddyIds]);

  const effectiveGroupOrder = useMemo(() => {
    const knownIds = Object.keys(PULSE_GROUPS);
    if (groupOrder && groupOrder.length > 0) {
      const filtered = groupOrder.filter((id) => knownIds.includes(id));
      knownIds.forEach((id) => { if (!filtered.includes(id)) filtered.push(id); });
      return filtered;
    }
    return knownIds;
  }, [groupOrder]);

  const groupedBuddies = effectiveGroupOrder.map((groupId) => {
    const group = PULSE_GROUPS[groupId];
    if (!group) return null;
    const label = groupLabels[groupId] || group.label;
    return {
      id: groupId,
      label,
      buddies: visibleBuddies.filter(({ buddy }) => group.memberIds.includes(buddy.id)),
    };
  }).filter(Boolean) as Array<{ id: string; label: string; buddies: typeof visibleBuddies }>;

  const activeCount = visibleBuddies.filter(({ presence }) => presence.status !== 'offline').length;
  const contextBuddy = contextMenu ? buddies.find((buddy) => buddy.id === contextMenu.buddyId) : undefined;
  const isBlocked = contextBuddy ? blockedBuddyIds.includes(contextBuddy.id) : false;

  const handleContextAction = (action: () => void) => {
    action();
    setContextMenu(null);
    setShowInviteSubmenu(false);
  };

  const isDark = pulseSkin === 'dark';
  const rootBg = isDark ? 'bg-[#0f1419] text-gray-200' : pulseSkin === 'silver' ? 'bg-[#e8e8e8] text-black' : 'bg-[#f6f6f6] text-black';

  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden font-sans text-xs select-none ${rootBg}`} onClick={() => { setContextMenu(null); setShowInviteSubmenu(false); }}>
      {contextMenu && contextBuddy && (
        <div
          className="fixed z-50 w-48 border-2 border-[#38516e] bg-white p-1 font-sans text-[11px] shadow-[3px_3px_0_rgba(15,35,60,0.3)]"
          style={{ left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : contextMenu.x), top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 260 : contextMenu.y) }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-[#b8c3ce] px-2 py-1 font-bold text-[#274e78] flex items-center justify-between">
            <span className="truncate">{contextBuddy.displayName}</span>
            <span className={`ml-1 h-2 w-2 rounded-full shrink-0 ${presenceMap[contextBuddy.id]?.status === 'online' ? 'bg-green-500' : presenceMap[contextBuddy.id]?.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
          </div>
          <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => handleContextAction(() => onOpenChat(contextBuddy.id))}>Send IM</button>
          <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => handleContextAction(() => onInspect(contextBuddy.id))}>View Profile</button>
          <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => handleContextAction(() => onInspect(contextBuddy.id))}>View Away Message History</button>
          <button className="block w-full px-2 py-1 text-left hover:bg-[#dceafa]" onClick={() => handleContextAction(() => onBuzz(contextBuddy.id))}>Buzz / Nudge</button>

          <div className="relative">
            <button
              className="flex w-full items-center justify-between px-2 py-1 text-left hover:bg-[#dceafa]"
              onMouseEnter={() => setShowInviteSubmenu(true)}
              onClick={() => setShowInviteSubmenu((prev) => !prev)}
            >
              <span>Invite to Room</span>
              <span className="text-[9px]">▸</span>
            </button>
            {showInviteSubmenu && (
              <div className="absolute left-full top-0 z-10 ml-0.5 w-40 border border-[#38516e] bg-white p-1 shadow-[2px_2px_0_rgba(0,0,0,0.2)]">
                {PULSE_ROOMS.map((room) => (
                  <button
                    key={room.id}
                    className="block w-full truncate px-2 py-1 text-left hover:bg-[#dceafa]"
                    onClick={() => handleContextAction(() => onInviteBuddyToRoom?.(contextBuddy.id, room.id))}
                  >
                    {room.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-[#b8c3ce]" />
          <button
            className="block w-full px-2 py-1 text-left text-[#8a3a2d] hover:bg-[#fde8e0]"
            onClick={() => handleContextAction(() => onRemoveBuddy?.(contextBuddy.id))}
          >
            Remove Buddy
          </button>
          {isBlocked ? (
            <button
              className="block w-full px-2 py-1 text-left text-[#2d6a4f] hover:bg-[#def2e6]"
              onClick={() => handleContextAction(() => onUnblockBuddy?.(contextBuddy.id))}
            >
              Unblock Buddy
            </button>
          ) : (
            <button
              className="block w-full px-2 py-1 text-left text-[#8a3a2d] hover:bg-[#fde8e0]"
              onClick={() => handleContextAction(() => onBlockBuddy?.(contextBuddy.id))}
            >
              Block Buddy
            </button>
          )}
        </div>
      )}
      <div className="flex gap-3 border-b border-gray-400 bg-[#dfdfdf] px-2 py-0.5 text-[11px] text-gray-800">
        <span className="cursor-pointer font-bold hover:underline">Contacts</span>
        <span className="cursor-pointer hover:underline">Actions</span>
        <span className="cursor-pointer hover:underline">Tools</span>
        <span className="cursor-pointer hover:underline">Help</span>
      </div>

      <UserProfileHeader username={username} session={session} onSignOut={onSignOut} />

      <div className="flex items-center gap-1 border-b border-gray-300 bg-[#dbe5ef] px-1 py-1 text-[10px]">
        <span className="font-bold text-gray-600">Slot:</span>
        {['slot_1', 'slot_2', 'slot_3'].map((slotId) => (
          <button key={slotId} onClick={() => onSwitchSlot?.(slotId)} className={`rounded border px-1.5 py-0.5 text-[10px] ${currentSlotId === slotId ? 'bg-white border-gray-500 font-bold text-[#1c4167]' : 'bg-[#f3f6f8] border-gray-300 text-gray-600 hover:bg-white'}`}>{slotId}</button>
        ))}
        <span className="ml-auto text-[9px] text-gray-500">{currentSlotId}</span>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-300 bg-[#f3f6f8] px-1 py-1 text-[10px]">
        <span className="font-bold text-gray-600">Skin:</span>
        {(['blue', 'silver', 'dark'] as PulseSkin[]).map((skin) => (
          <button key={skin} onClick={() => onChangeSkin?.(skin)} className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${pulseSkin === skin ? 'bg-white border-gray-500 font-bold text-[#1c4167]' : 'bg-[#f3f6f8] border-gray-300 text-gray-600 hover:bg-white'}`}>{skin}</button>
        ))}
      </div>

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
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-[#456990]"><span>Pulse activity</span><span className="font-normal text-gray-500">last {Math.min(activityFeed.length, 5)} • {activityFeed.filter((entry) => !entry.isRead).length} new</span></div>
            <div className="space-y-0.5">
              {activityFeed.slice(-5).reverse().map((entry) => {
                const isMessage = entry.kind === 'message';
                const isUnread = !entry.isRead;
                return <button key={entry.id} onClick={() => onOpenChat(entry.buddyId)} className={`block w-full truncate text-left text-[10px] hover:text-blue-800 hover:underline ${isUnread ? 'font-bold text-[#1d3d64]' : 'text-gray-700'} ${isMessage ? 'italic' : ''}`} title={`${entry.text} — Day ${Math.floor(entry.minute / 1440) + 1}`}>{isUnread ? '● ' : ''}{entry.text}</button>;
              })}
            </div>
          </div>}
          {friendRequestStatus === 'pending' ? <button onClick={onOpenRequests} className="mx-1 mt-1 flex items-center gap-2 border border-[#c39a35] bg-[#fff4bd] px-2 py-1 text-left text-[10px] font-bold text-[#6d5000] hover:bg-[#ffed8e]">
            <span className="rounded-full bg-[#d96c3b] px-1.5 py-0.5 text-white">1</span>
            <span>New friend request</span>
          </button> : <div className="mx-1 mt-1 border border-[#b8c3ce] bg-[#f3f6f8] px-2 py-1 text-[10px] text-gray-600">Friend request {friendRequestStatus}.</div>}
          <div className="flex-1 space-y-1 overflow-y-auto bg-white p-1">
            {groupedBuddies.map((group, index) => (
              <BuddyGroup
                key={group.id}
                groupId={group.id}
                title={group.label}
                buddies={group.buddies}
                unreadCounts={unreadCounts}
                onOpenChat={onOpenChat}
                onInspect={onInspect}
                onContextMenu={(buddyId, event) => setContextMenu({ buddyId, x: event.clientX, y: event.clientY })}
                defaultExpanded={index === 0}
                onRename={onRenameGroup}
                onMoveUp={onReorderGroup ? (groupId) => onReorderGroup(groupId, 'up') : undefined}
                onMoveDown={onReorderGroup ? (groupId) => onReorderGroup(groupId, 'down') : undefined}
                isFirst={index === 0}
                isLast={index === groupedBuddies.length - 1}
              />
            ))}
            {groupedBuddies.every((group) => group.buddies.length === 0) && blockedBuddies.length === 0 && <div className="p-4 text-center text-[11px] italic text-gray-500">No contacts match this search.</div>}
            {blockedBuddies.length > 0 && (
              <div className="mt-2 border-t border-dashed border-gray-300 pt-2">
                <button onClick={() => setShowBlocked((prev) => !prev)} className="flex w-full items-center gap-1 px-1 py-1 text-left text-[11px] font-bold text-gray-500 hover:bg-gray-100">
                  <span className="text-[9px]">{showBlocked ? '▾' : '▸'}</span>
                  <span>Blocked ({blockedBuddies.length})</span>
                </button>
                {showBlocked && (
                  <div className="pl-2 space-y-0.5 opacity-60">
                    {blockedBuddies.map(({ buddy }) => (
                      <div key={buddy.id} className="flex items-center justify-between gap-1 rounded p-1 hover:bg-gray-100">
                        <span className="truncate text-[11px] text-gray-600">{buddy.displayName} — blocked</span>
                        <button onClick={() => onUnblockBuddy?.(buddy.id)} className="shrink-0 rounded border border-gray-400 bg-white px-1.5 py-0.5 text-[10px] hover:bg-blue-50">Unblock</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
          <div className="mt-3 border-t border-dashed border-gray-300 pt-2 text-[10px] text-gray-500">Room list updated a moment ago. • Right-click a buddy for quick actions.</div>
        </div>
      )}

      <div className="flex justify-between border-t border-gray-400 bg-[#ece9d8] px-2 py-1 text-[10px] text-gray-500">
        <span>{activeCount} contacts active • {blockedBuddies.length > 0 ? `${blockedBuddies.length} blocked` : 'no blocks'}</span>
        <button onClick={onSignOut} className="text-blue-800 hover:underline">Sign out</button>
      </div>
    </div>
  );
};
