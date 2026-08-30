import type { PulseRoomMessage } from './components/PulseRoomWindow';
import type { PulseActivityEntry } from './types';
import { PULSE_ROOMS } from './data/pulseRooms';

const STORAGE_KEY = 'away_message_pulse_state_v1';

export type FriendRequestStatus = 'pending' | 'accepted' | 'ignored';

export interface PulsePersistedState {
  version: 1;
  joinedRoomIds: string[];
  roomMessages: Record<string, PulseRoomMessage[]>;
  roomTopics: Record<string, string>;
  roomReadThrough: Record<string, number>;
  activityBuckets: Record<string, number>;
  activityFeed: PulseActivityEntry[];
  lastSeenTotalMinutes: number;
  friendRequestStatus: FriendRequestStatus;
}

function makeSeedMessages(): Record<string, PulseRoomMessage[]> {
  const names: Record<string, string> = { maya: 'Maya', ryan: 'Ryan', nora: 'Nora', henderson: 'Mr. Henderson' };
  return Object.fromEntries(PULSE_ROOMS.map((room) => [room.id, room.seedMessages.map((message, index) => ({
    id: `${room.id}-seed-${index}`,
    senderId: message.senderId,
    senderName: names[message.senderId] || message.senderId,
    text: message.text,
    minute: message.minute,
  }))]));
}

export function makeDefaultPulseState(): PulsePersistedState {
  const roomMessages = makeSeedMessages();
  return {
    version: 1,
    joinedRoomIds: PULSE_ROOMS.map((room) => room.id),
    roomMessages,
    roomTopics: Object.fromEntries(PULSE_ROOMS.map((room) => [room.id, room.topic])),
    roomReadThrough: Object.fromEntries(PULSE_ROOMS.map((room) => [room.id, (roomMessages[room.id] || []).length])),
    activityBuckets: {},
    activityFeed: [],
    lastSeenTotalMinutes: 480,
    friendRequestStatus: 'pending',
  };
}

function isRoomMessage(value: unknown): value is PulseRoomMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.senderId === 'string'
    && typeof record.senderName === 'string'
    && typeof record.text === 'string'
    && typeof record.minute === 'number';
}

export function loadPulseState(): PulsePersistedState {
  const fallback = makeDefaultPulseState();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PulsePersistedState>;
    const knownRoomIds = new Set(PULSE_ROOMS.map((room) => room.id));
    const joinedRoomIds = Array.isArray(parsed.joinedRoomIds)
      ? parsed.joinedRoomIds.filter((id): id is string => typeof id === 'string' && knownRoomIds.has(id))
      : fallback.joinedRoomIds;
    const roomMessages: Record<string, PulseRoomMessage[]> = { ...fallback.roomMessages };
    const roomTopics: Record<string, string> = { ...fallback.roomTopics };
    const roomReadThrough: Record<string, number> = { ...fallback.roomReadThrough };
    const activityBuckets: Record<string, number> = {};
    if (parsed.roomMessages && typeof parsed.roomMessages === 'object') {
      Object.entries(parsed.roomMessages as Record<string, unknown>).forEach(([roomId, messages]) => {
        if (knownRoomIds.has(roomId) && Array.isArray(messages)) {
          roomMessages[roomId] = messages.filter(isRoomMessage).slice(-80);
        }
      });
    }
    if (parsed.roomTopics && typeof parsed.roomTopics === 'object') {
      Object.entries(parsed.roomTopics as Record<string, unknown>).forEach(([roomId, value]) => {
        if (knownRoomIds.has(roomId) && typeof value === 'string' && value.trim()) roomTopics[roomId] = value.trim().slice(0, 120);
      });
    }
    if (parsed.roomReadThrough && typeof parsed.roomReadThrough === 'object') {
      Object.entries(parsed.roomReadThrough as Record<string, unknown>).forEach(([roomId, value]) => {
        if (knownRoomIds.has(roomId) && typeof value === 'number' && Number.isFinite(value)) roomReadThrough[roomId] = Math.max(0, Math.min(Math.floor(value), roomMessages[roomId]?.length ?? 0));
      });
    }
    if (parsed.activityBuckets && typeof parsed.activityBuckets === 'object') {
      Object.entries(parsed.activityBuckets as Record<string, unknown>).forEach(([roomId, value]) => {
        if (knownRoomIds.has(roomId) && typeof value === 'number' && Number.isFinite(value)) activityBuckets[roomId] = value;
      });
    }
    const activityFeed = Array.isArray(parsed.activityFeed)
      ? parsed.activityFeed.filter((entry): entry is PulseActivityEntry => Boolean(entry && typeof entry === 'object' && typeof (entry as PulseActivityEntry).id === 'string' && typeof (entry as PulseActivityEntry).buddyId === 'string' && typeof (entry as PulseActivityEntry).text === 'string' && typeof (entry as PulseActivityEntry).minute === 'number')).slice(-60)
      : fallback.activityFeed;
    const lastSeenTotalMinutes = typeof parsed.lastSeenTotalMinutes === 'number' && Number.isFinite(parsed.lastSeenTotalMinutes)
      ? Math.max(0, parsed.lastSeenTotalMinutes)
      : fallback.lastSeenTotalMinutes;
    const friendRequestStatus: FriendRequestStatus = parsed.friendRequestStatus === 'accepted' || parsed.friendRequestStatus === 'ignored'
      ? parsed.friendRequestStatus
      : 'pending';
    return { version: 1, joinedRoomIds, roomMessages, roomTopics, roomReadThrough, activityBuckets, activityFeed, lastSeenTotalMinutes, friendRequestStatus };
  } catch {
    return fallback;
  }
}

export function savePulseState(state: PulsePersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      version: 1,
      activityFeed: state.activityFeed.slice(-60),
      roomMessages: Object.fromEntries(Object.entries(state.roomMessages).map(([roomId, messages]) => [roomId, messages.slice(-80)])),
    }));
  } catch {
    // Persistence is a convenience; Pulse remains playable if storage is unavailable.
  }
}
