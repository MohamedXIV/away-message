import React from 'react';
import type { BuddyCharacter, BuddyPresence, RelationshipDimensions } from '../../../engine/types';
import type { PulseRoom } from '../data/pulseRooms';
import type { PulseActivityEntry } from '../types';
import { useSimulationStore } from '../../../store/useSimulationStore';

interface PulseProfileCardProps {
  buddy: BuddyCharacter;
  presence: BuddyPresence;
  relationship?: RelationshipDimensions;
  rooms: PulseRoom[];
  onClose: () => void;
  onChat: () => void;
  onBuzz: () => void;
  onInvite: (roomId: string) => void;
  awayHistory?: PulseActivityEntry[];
}

const meterItems: Array<{ key: keyof RelationshipDimensions; label: string; color: string }> = [
  { key: 'familiarity', label: 'Familiarity', color: '#5b8db8' },
  { key: 'trust', label: 'Trust', color: '#6c9b55' },
  { key: 'comfort', label: 'Comfort', color: '#c18b45' },
  { key: 'respect', label: 'Respect', color: '#8668a8' },
];

const EMPTY_KNOWLEDGE: import('../../../engine/types').BuddyEventKnowledge[] = [];
const EMPTY_EVENTS: import('../../../engine/types').GlobalEvent[] = [];
const EMPTY_PHOTOS: import('../../../engine/types').CoreMemory[] = [];

export const PulseProfileCard: React.FC<PulseProfileCardProps> = ({ buddy, presence, relationship, rooms, onClose, onChat, onBuzz, onInvite, awayHistory = [] }) => {
  const avatarLetter = buddy.displayName.trim().charAt(0).toUpperCase() || '?';
  // Use stable selectors — avoid creating new [] on every getSnapshot call
  const buddyKnowledge = useSimulationStore((s) => s.state.world.buddyKnowledge?.[buddy.id] ?? EMPTY_KNOWLEDGE);
  const worldEvents = useSimulationStore((s) => s.state.world.triggeredEvents ?? EMPTY_EVENTS);
  // P5.5 visual album: immortal shared-photo memories (stable reference from cached engine state)
  const photoMemories = useSimulationStore((s) => s.state.social.coreMemories?.[buddy.id] ?? EMPTY_PHOTOS);
  const photos = photoMemories.filter((m) => m.kind === 'shared_photo');

  return (
    <div className="absolute right-3 top-3 z-30 w-72 border-2 border-[#38516e] bg-[#edf2f8] font-sans text-xs text-[#18283b] shadow-[6px_6px_0_rgba(15,35,60,0.26)]">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#27456d] to-[#7099be] px-2 py-1 text-white">
        <span className="font-bold">Buddy Profile</span>
        <button onClick={onClose} className="h-4 w-4 border border-white/70 text-[10px] leading-3 hover:bg-white/20">×</button>
      </div>

      <div className="flex gap-3 border-b border-[#a8b7c7] bg-white p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-[#7088a2] bg-gradient-to-br from-[#5f8fbd] to-[#243f67] text-2xl font-bold text-white shadow-inner">{avatarLetter}</div>
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-[#183b61]">{buddy.displayName}</div>
          <div className="truncate text-[11px] text-gray-600">{buddy.handle}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] uppercase text-gray-600"><span className={`h-2 w-2 rounded-full ${presence.status === 'online' ? 'bg-green-500' : presence.status === 'away' ? 'bg-yellow-500' : presence.status === 'busy' ? 'bg-red-500' : 'bg-gray-400'}`} />{presence.status}</div>
          <div className="mt-1 truncate text-[10px] italic text-gray-500">{presence.awayMessage || 'No away message'}</div>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex gap-1">
          <button onClick={onChat} className="flex-1 border border-[#3d5874] bg-[#d9e9f7] px-2 py-1 font-bold hover:bg-[#c6def1]">Send IM</button>
          <button onClick={onBuzz} className="border border-[#825c25] bg-[#f4d58d] px-2 py-1 font-bold hover:bg-[#eec878]">Buzz</button>
        </div>

        {awayHistory.length > 0 ? <div className="border border-[#b2bdc8] bg-white p-2">
          <div className="mb-1 flex items-center justify-between font-bold text-[#274e78]"><span>Away message history</span><span className="text-[9px] font-normal text-gray-400">{awayHistory.length} entries</span></div>
          <div className="space-y-1.5 text-[10px] text-gray-600">
            {awayHistory.slice(-5).reverse().map((entry) => {
              const cleanText = entry.text.replace(`${buddy.displayName} is away: `, '').replace(`${buddy.displayName} is away`, '').trim();
              const dayLabel = `Day ${Math.floor(entry.minute / 1440) + 1} • ${String(Math.floor((entry.minute % 1440)/60)).padStart(2,'0')}:${String(entry.minute % 60).padStart(2,'0')}`;
              return <div key={entry.id} className="border-l-2 border-[#a8b7c7] pl-1.5"><div className="italic leading-tight">“{cleanText || entry.text}”</div><div className="text-[9px] text-gray-400">{dayLabel}</div></div>;
            })}
          </div>
        </div> : <div className="border border-dashed border-[#b2bdc8] bg-white p-2 text-[10px] text-gray-500">No away history yet — changes appear after buddies switch to away.</div>}

        <div className="border border-[#b2bdc8] bg-white p-2">
          <div className="mb-2 font-bold text-[#274e78]">Relationship snapshot</div>
          {meterItems.map((meter) => {
            const value = relationship?.[meter.key] ?? 0;
            return (
              <div key={meter.key} className="mb-1.5">
                <div className="mb-0.5 flex justify-between text-[10px] text-gray-600"><span>{meter.label}</span><span>{value}%</span></div>
                <div className="h-2 border border-gray-400 bg-[#edf0f3]"><div className="h-full" style={{ width: `${value}%`, backgroundColor: meter.color }} /></div>
              </div>
            );
          })}
        </div>

        {photos.length > 0 && (
          <div className="border border-[#b2bdc8] bg-white p-2">
            <div className="mb-1 flex items-center justify-between font-bold text-[#274e78]"><span>Shared photos</span><span className="text-[9px] font-normal text-gray-400">{photos.length} immortal</span></div>
            <div className="space-y-1.5 text-[10px] text-gray-600">
              {photos.slice(-3).reverse().map((photo) => (
                <div key={photo.id} className="border-l-2 border-[#c18b45] pl-1.5"><div className="italic leading-tight">📷 “{photo.text.replace(/^Shared a photo, Day \d+: /, '')}”</div><div className="text-[9px] text-gray-400">Day {photo.day} • never forgotten</div></div>
              ))}
            </div>
          </div>
        )}

        {buddyKnowledge.length > 0 && (
          <div className="border border-[#b2bdc8] bg-white p-2">
            <div className="mb-1 font-bold text-[#274e78]">World take — same news, different eyes</div>
            <div className="space-y-1.5">
              {buddyKnowledge.slice(-3).reverse().map((k) => {
                const evt = worldEvents.find((e) => e.id === k.eventId);
                return (
                  <div key={k.eventId} className="border-l-2 border-[#a8b7c7] pl-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span className={`px-1 py-0.5 text-[8px] uppercase text-white ${k.attitude === 'hyped' ? 'bg-emerald-600' : k.attitude === 'annoyed' ? 'bg-red-600' : k.attitude === 'skeptical' ? 'bg-amber-600' : k.attitude === 'worried' ? 'bg-orange-600' : k.attitude === 'curious' ? 'bg-sky-600' : 'bg-gray-500'}`}>{k.attitude}</span>
                      <span className="truncate text-[#183b61]">{evt?.title ?? k.eventId}</span>
                    </div>
                    <div className="text-[10px] italic leading-tight text-gray-600">“{k.personalTake}”</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <label className="block text-[10px] font-bold text-gray-600" htmlFor="profile-room-invite">Invite to room</label>
        <select id="profile-room-invite" defaultValue="" onChange={(event) => { if (event.target.value) onInvite(event.target.value); }} className="w-full border border-gray-500 bg-white px-2 py-1 text-[11px]">
          <option value="">Choose a room...</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </select>
      </div>

      <div className="border-t border-[#a8b7c7] bg-[#dbe5ef] px-3 py-1 text-[10px] text-gray-600">Member since the early days of the Orion network.</div>
    </div>
  );
};
