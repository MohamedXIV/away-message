import type { PulseRoomMessage } from './components/PulseRoomWindow';
import type { PulseActivityEntry } from './types';
import { PULSE_GROUPS, PULSE_ROOMS } from './data/pulseRooms';
import { db } from '../../persistence/db';

const STORAGE_KEY = 'away_message_pulse_state_v1';
const SLOT_STORAGE_KEY = 'pulse_current_slot';
const ACCOUNTS_KEY_PREFIX = 'away_message_pulse_accounts:';
const CREDS_KEY_PREFIX = 'away_message_pulse_creds:';

export function getCurrentPulseSlotId(): string {
  if (typeof window === 'undefined') return 'slot_1';
  try {
    const raw = window.localStorage.getItem(SLOT_STORAGE_KEY);
    if (raw && /^[a-zA-Z0-9_-]+$/.test(raw)) return raw;
  } catch { /* ignore */ }
  return 'slot_1';
}

export function setCurrentPulseSlotId(slotId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = slotId.trim().slice(0, 32) || 'slot_1';
    window.localStorage.setItem(SLOT_STORAGE_KEY, clean);
  } catch { /* ignore */ }
}

export function getPulseSlotStorageKey(slotId: string): string {
  return `${STORAGE_KEY}:${slotId}`;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'ignored';
export type PulseSkin = 'blue' | 'silver' | 'dark';

/** A real Pulse account: ID + password, created via sign-up (or first sign-in). */
export interface PulseAccount {
  id: string;
  password: string;
  createdAt: number;
}

/** Remembered login form state per slot (game-local convenience, plain text). */
export interface PulseCredentials {
  id: string;
  password: string;
  remember: boolean;
  autoSign: boolean;
}

function accountsKey(slotId: string): string {
  return `${ACCOUNTS_KEY_PREFIX}${slotId}`;
}

function credsKey(slotId: string): string {
  return `${CREDS_KEY_PREFIX}${slotId}`;
}

function cleanId(id: string): string {
  return id.trim().slice(0, 32);
}

/** Load all Pulse accounts for a slot (empty when nobody signed up yet). */
export function loadPulseAccounts(slotId?: string): PulseAccount[] {
  if (typeof window === 'undefined') return [];
  const effectiveSlotId = slotId || getCurrentPulseSlotId();
  // Migrate the pre-accounts single saved password into a wanderer06 account
  const legacyFallback = (): PulseAccount[] => {
    try {
      const legacy = window.localStorage.getItem('pulse_saved_password');
      if (legacy) return [{ id: 'wanderer06', password: legacy, createdAt: Date.now() }];
    } catch { /* ignore */ }
    return [];
  };
  try {
    const raw = window.localStorage.getItem(accountsKey(effectiveSlotId));
    if (!raw) return legacyFallback();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return legacyFallback();
    const accounts = parsed
      .filter((a): a is PulseAccount => Boolean(a && typeof a === 'object'
        && typeof (a as PulseAccount).id === 'string' && (a as PulseAccount).id.trim()
        && typeof (a as PulseAccount).password === 'string'))
      .map((a) => ({ id: cleanId(a.id), password: a.password.slice(0, 64), createdAt: typeof a.createdAt === 'number' ? a.createdAt : Date.now() }))
      .slice(0, 10);
    return accounts.length > 0 ? accounts : legacyFallback();
  } catch {
    return legacyFallback();
  }
}

function savePulseAccounts(accounts: PulseAccount[], slotId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(accountsKey(slotId || getCurrentPulseSlotId()), JSON.stringify(accounts.slice(0, 10)));
  } catch { /* persistence is best-effort */ }
}

export function findPulseAccount(accounts: PulseAccount[], id: string): PulseAccount | undefined {
  const clean = cleanId(id).toLowerCase();
  return accounts.find((a) => a.id.toLowerCase() === clean);
}

/**
 * Validate credentials against accounts.
 * - Unknown ID + non-empty password → creates the account (frictionless first sign-up).
 * - Known ID + matching password → ok.
 * - Otherwise → { ok: false } (wrong password / empty password).
 */
export function checkPulseCredentials(
  accounts: PulseAccount[],
  id: string,
  password: string,
  slotId?: string
): { ok: boolean; accounts: PulseAccount[]; created: boolean } {
  const clean = cleanId(id);
  if (!clean || !password) return { ok: false, accounts, created: false };
  const existing = findPulseAccount(accounts, clean);
  if (!existing) {
    const next = [...accounts, { id: clean, password: password.slice(0, 64), createdAt: Date.now() }];
    savePulseAccounts(next, slotId);
    return { ok: true, accounts: next, created: true };
  }
  if (existing.password !== password) return { ok: false, accounts, created: false };
  return { ok: true, accounts, created: false };
}

/**
 * Explicit sign-up: ID must be fresh (case-insensitive), password non-empty
 * and confirmed. Returns the updated accounts on success.
 */
export function signUpPulseAccount(
  accounts: PulseAccount[],
  id: string,
  password: string,
  confirm: string,
  slotId?: string
): { ok: boolean; error?: string; accounts: PulseAccount[] } {
  const clean = cleanId(id);
  if (clean.length < 3) return { ok: false, error: 'Pick an ID with at least 3 characters.', accounts };
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) return { ok: false, error: 'IDs may only use letters, numbers, _ . -', accounts };
  if (!password) return { ok: false, error: 'Choose a password.', accounts };
  if (password !== confirm) return { ok: false, error: 'Passwords do not match.', accounts };
  if (findPulseAccount(accounts, clean)) return { ok: false, error: 'That ID is already taken on this PC.', accounts };
  const next = [...accounts, { id: clean, password: password.slice(0, 64), createdAt: Date.now() }];
  savePulseAccounts(next, slotId);
  return { ok: true, accounts: next };
}

/** Load remembered login-form state for a slot (null when Remember was off). */
export function loadPulseCredentials(slotId?: string): PulseCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(credsKey(slotId || getCurrentPulseSlotId()));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PulseCredentials>;
    if (typeof parsed.id !== 'string' || !parsed.id.trim() || !parsed.remember) return null;
    return {
      id: cleanId(parsed.id),
      password: typeof parsed.password === 'string' ? parsed.password.slice(0, 64) : '',
      remember: true,
      autoSign: parsed.autoSign === true,
    };
  } catch {
    return null;
  }
}

/** Save (or clear, when remember is off) the login-form state for a slot. */
export function savePulseCredentials(creds: PulseCredentials | null, slotId?: string): void {
  if (typeof window === 'undefined') return;
  const key = credsKey(slotId || getCurrentPulseSlotId());
  try {
    if (!creds || !creds.remember) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify({
      id: cleanId(creds.id),
      password: creds.password.slice(0, 64),
      remember: true,
      autoSign: creds.autoSign === true,
    }));
  } catch { /* persistence is best-effort */ }
}

export interface PulseSharedLink {
  id: string;
  url: string;
  host: string;
  title: string;
  sharedBy: string;
  sharedByName: string;
  minute: number;
  snippet: string;
}

export interface PulsePersistedState {
  version: 1;
  joinedRoomIds: string[];
  roomMessages: Record<string, PulseRoomMessage[]>;
  roomTopics: Record<string, string>;
  roomReadThrough: Record<string, number>;
  activityBuckets: Record<string, number>;
  activityFeed: PulseActivityEntry[];
  awayHistory: Record<string, PulseActivityEntry[]>;
  lastSeenTotalMinutes: number;
  conversationMemory: Record<string, string[]>;
  conversationSummaries: Record<string, string>;
  recentReplies: Record<string, string[]>;
  buddyFacts: Record<string, string[]>;
  npcMood: Record<string, string>;
  npcActivity: Record<string, string>;
  friendRequestStatus: FriendRequestStatus;
  blockedBuddyIds: string[];
  groupLabels: Record<string, string>;
  groupOrder: string[];
  sharedLinks: PulseSharedLink[];
  discoveredHosts: string[];
  pulseSkin: PulseSkin;
  // P3 — NPC initiatives: last game day each buddy messaged first (day-keyed, max once/day)
  initiatedToday?: Record<string, number>;
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
    awayHistory: {},
    lastSeenTotalMinutes: 480,
    conversationMemory: {},
    conversationSummaries: {},
    recentReplies: {},
    buddyFacts: {},
    npcMood: {},
    npcActivity: {},
    friendRequestStatus: 'pending',
    blockedBuddyIds: [],
    groupLabels: {},
    groupOrder: Object.keys(PULSE_GROUPS),
    sharedLinks: [],
    discoveredHosts: [],
    pulseSkin: 'blue',
    initiatedToday: {},
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

export function loadPulseState(slotId?: string): PulsePersistedState {
  const fallback = makeDefaultPulseState();
  if (typeof window === 'undefined') return fallback;

  const effectiveSlotId = slotId || getCurrentPulseSlotId();
  const slotKey = getPulseSlotStorageKey(effectiveSlotId);

  try {
    // Prefer slot-specific key, fall back to legacy global key for migration
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(slotKey); } catch { raw = null; }
    if (!raw) {
      try { raw = window.localStorage.getItem(STORAGE_KEY); } catch { raw = null; }
    }
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
      ? parsed.activityFeed.filter((entry): entry is PulseActivityEntry => Boolean(entry && typeof entry === 'object' && typeof (entry as PulseActivityEntry).id === 'string' && typeof (entry as PulseActivityEntry).buddyId === 'string' && typeof (entry as PulseActivityEntry).text === 'string' && typeof (entry as PulseActivityEntry).minute === 'number')).slice(-80)
      : fallback.activityFeed;
    const awayHistory: Record<string, PulseActivityEntry[]> = {};
    if (parsed.awayHistory && typeof parsed.awayHistory === 'object') {
      Object.entries(parsed.awayHistory as Record<string, unknown>).forEach(([buddyId, entries]) => {
        if (Array.isArray(entries)) {
          const filtered = entries.filter((entry): entry is PulseActivityEntry => Boolean(entry && typeof entry === 'object' && typeof (entry as PulseActivityEntry).id === 'string' && typeof (entry as PulseActivityEntry).buddyId === 'string' && typeof (entry as PulseActivityEntry).text === 'string' && typeof (entry as PulseActivityEntry).minute === 'number')).slice(-20);
          if (filtered.length > 0) awayHistory[buddyId] = filtered;
        }
      });
    }
    const lastSeenTotalMinutes = typeof parsed.lastSeenTotalMinutes === 'number' && Number.isFinite(parsed.lastSeenTotalMinutes)
      ? Math.max(0, parsed.lastSeenTotalMinutes)
      : fallback.lastSeenTotalMinutes;
    const readStringMap = (value: unknown): Record<string, string> => value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).reduce<Array<[string, string]>>((items, [key, item]) => {
        if (typeof item === 'string') items.push([key, item]);
        return items;
      }, []))
      : {};
    const conversationMemory: Record<string, string[]> = {};
    if (parsed.conversationMemory && typeof parsed.conversationMemory === 'object') {
      Object.entries(parsed.conversationMemory as Record<string, unknown>).forEach(([buddyId, items]) => {
        if (Array.isArray(items)) conversationMemory[buddyId] = items.filter((item): item is string => typeof item === 'string').slice(-6);
      });
    }
    const conversationSummaries = readStringMap(parsed.conversationSummaries as unknown);
    const recentReplies: Record<string, string[]> = {};
    if ((parsed as Record<string, unknown>).recentReplies && typeof (parsed as Record<string, unknown>).recentReplies === 'object') {
      Object.entries((parsed as Record<string, unknown>).recentReplies as Record<string, unknown>).forEach(([buddyId, items]) => {
        if (Array.isArray(items)) recentReplies[buddyId] = items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => (item as string).slice(0, 500)).slice(-6);
      });
    }
    const buddyFacts: Record<string, string[]> = {};
    if ((parsed as Record<string, unknown>).buddyFacts && typeof (parsed as Record<string, unknown>).buddyFacts === 'object') {
      Object.entries((parsed as Record<string, unknown>).buddyFacts as Record<string, unknown>).forEach(([buddyId, items]) => {
        if (Array.isArray(items)) buddyFacts[buddyId] = items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => (item as string).slice(0, 160)).slice(-12);
      });
    }
    const npcMood = readStringMap(parsed.npcMood);
    const npcActivity = readStringMap(parsed.npcActivity);
    const friendRequestStatus: FriendRequestStatus = parsed.friendRequestStatus === 'accepted' || parsed.friendRequestStatus === 'ignored'
      ? parsed.friendRequestStatus
      : 'pending';
    const blockedBuddyIds = Array.isArray((parsed as Record<string, unknown>).blockedBuddyIds)
      ? ((parsed as Record<string, unknown>).blockedBuddyIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 20)
      : fallback.blockedBuddyIds;
    const groupLabels: Record<string, string> = {};
    if ((parsed as Record<string, unknown>).groupLabels && typeof (parsed as Record<string, unknown>).groupLabels === 'object') {
      Object.entries((parsed as Record<string, unknown>).groupLabels as Record<string, unknown>).forEach(([groupId, label]) => {
        // Keep labels for known groups plus the dynamic 'uncategorized' bucket; drop anything else
        if (typeof label === 'string' && label.trim().length > 0 && (!!PULSE_GROUPS[groupId as keyof typeof PULSE_GROUPS] || groupId === 'uncategorized')) groupLabels[groupId] = label.trim().slice(0, 32);
      });
    }
    const knownGroupIds = new Set([...Object.keys(PULSE_GROUPS), 'uncategorized']);
    const rawGroupOrder = Array.isArray((parsed as Record<string, unknown>).groupOrder)
      ? ((parsed as Record<string, unknown>).groupOrder as unknown[]).filter((id): id is string => typeof id === 'string' && knownGroupIds.has(id))
      : fallback.groupOrder;
    const groupOrder = rawGroupOrder.length > 0 ? Array.from(new Set(rawGroupOrder)) : fallback.groupOrder;
    // Ensure all groups are present in order even if stored order is incomplete
    Object.keys(PULSE_GROUPS).forEach((groupId) => { if (!groupOrder.includes(groupId)) groupOrder.push(groupId); });
    const sharedLinks: PulseSharedLink[] = Array.isArray((parsed as Record<string, unknown>).sharedLinks)
      ? ((parsed as Record<string, unknown>).sharedLinks as unknown[]).filter((entry): entry is PulseSharedLink => Boolean(entry && typeof entry === 'object' && typeof (entry as PulseSharedLink).id === 'string' && typeof (entry as PulseSharedLink).url === 'string' && typeof (entry as PulseSharedLink).host === 'string' && typeof (entry as PulseSharedLink).sharedBy === 'string' && typeof (entry as PulseSharedLink).minute === 'number')).map((entry) => ({ ...entry, title: typeof (entry as PulseSharedLink).title === 'string' ? (entry as PulseSharedLink).title.slice(0, 80) : entry.host, snippet: typeof (entry as PulseSharedLink).snippet === 'string' ? (entry as PulseSharedLink).snippet.slice(0, 160) : '' })).slice(-30)
      : fallback.sharedLinks;
    const discoveredHosts: string[] = Array.isArray((parsed as Record<string, unknown>).discoveredHosts)
      ? ((parsed as Record<string, unknown>).discoveredHosts as unknown[]).filter((host): host is string => typeof host === 'string' && host.toLowerCase().endsWith('.local')).map((host) => host.toLowerCase()).slice(0, 30)
      : fallback.discoveredHosts;
    // Ensure discoveredHosts includes all sharedLinks hosts
    const discoveredSet = new Set(discoveredHosts);
    sharedLinks.forEach((link) => discoveredSet.add(link.host.toLowerCase()));
    const mergedDiscoveredHosts = Array.from(discoveredSet).slice(0, 30);
    const pulseSkin: PulseSkin = (parsed as Record<string, unknown>).pulseSkin === 'silver' ? 'silver' : (parsed as Record<string, unknown>).pulseSkin === 'dark' ? 'dark' : 'blue';
    const initiatedToday: Record<string, number> = {};
    if ((parsed as Record<string, unknown>).initiatedToday && typeof (parsed as Record<string, unknown>).initiatedToday === 'object') {
      Object.entries((parsed as Record<string, unknown>).initiatedToday as Record<string, unknown>).forEach(([buddyId, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) initiatedToday[buddyId] = Math.max(1, Math.floor(value));
      });
    }
    return { version: 1, joinedRoomIds, roomMessages, roomTopics, roomReadThrough, activityBuckets, activityFeed, awayHistory, lastSeenTotalMinutes, conversationMemory, conversationSummaries, recentReplies, buddyFacts, npcMood, npcActivity, friendRequestStatus, blockedBuddyIds, groupLabels, groupOrder, sharedLinks, discoveredHosts: mergedDiscoveredHosts, pulseSkin, initiatedToday };
  } catch {
    return fallback;
  }
}

export function savePulseState(state: PulsePersistedState, slotId?: string): void {
  if (typeof window === 'undefined') return;
  const effectiveSlotId = slotId || getCurrentPulseSlotId();
  const slotKey = getPulseSlotStorageKey(effectiveSlotId);
  try {
    const payload = JSON.stringify({
      ...state,
      version: 1,
      activityFeed: state.activityFeed.slice(-80),
      awayHistory: Object.fromEntries(Object.entries(state.awayHistory).map(([buddyId, entries]) => [buddyId, entries.slice(-20)])),
      conversationMemory: Object.fromEntries(Object.entries(state.conversationMemory).map(([buddyId, items]) => [buddyId, items.slice(-6)])),
      conversationSummaries: Object.fromEntries(Object.entries(state.conversationSummaries).map(([buddyId, summary]) => [buddyId, summary.slice(0, 600)])),
      recentReplies: Object.fromEntries(Object.entries(state.recentReplies).map(([buddyId, items]) => [buddyId, items.slice(-6).map((item) => item.slice(0, 500))])),
      buddyFacts: Object.fromEntries(Object.entries(state.buddyFacts).map(([buddyId, items]) => [buddyId, items.slice(-12).map((item) => item.slice(0, 160))])),
      roomMessages: Object.fromEntries(Object.entries(state.roomMessages).map(([roomId, messages]) => [roomId, messages.slice(-80)])),
      blockedBuddyIds: state.blockedBuddyIds.slice(0, 20),
      groupLabels: Object.fromEntries(Object.entries(state.groupLabels).map(([groupId, label]) => [groupId, label.slice(0, 32)])),
      groupOrder: state.groupOrder.slice(0, 10),
      sharedLinks: state.sharedLinks.slice(-30),
      discoveredHosts: state.discoveredHosts.slice(0, 30),
      pulseSkin: state.pulseSkin,
    });
    window.localStorage.setItem(slotKey, payload);
    // Keep legacy key in sync for the current slot to aid migration and old readers
    if (effectiveSlotId === getCurrentPulseSlotId()) {
      try { window.localStorage.setItem(STORAGE_KEY, payload); } catch { /* ignore */ }
    }
    // Also sync to Dexie per-slot table best-effort (async, no await)
    try {
      const pulseTable = (db as unknown as { pulse_state?: { put: (record: unknown) => Promise<void> } }).pulse_state;
      if (pulseTable) {
        void pulseTable.put({ saveSlotId: effectiveSlotId, state, updatedAt: Date.now() }).catch(() => {});
      }
    } catch { /* ignore — Dexie sync is best-effort */ }
  } catch {
    // Persistence is a convenience; Pulse remains playable if storage is unavailable.
  }
}
