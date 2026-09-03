import React, { useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { BuddyListWindow } from './components/BuddyListWindow';
import { ChatWindow } from './components/ChatWindow';
import { PulseLoginSplash, PulseLoginSession } from './components/PulseLoginSplash';
import { PulseRoomWindow, PulseRoomMessage } from './components/PulseRoomWindow';
import { PulseProfileCard } from './components/PulseProfileCard';
import { PulseFriendRequest } from './components/PulseFriendRequest';
import type { PulseListView } from './components/BuddyListWindow';
import { getPulseRoom, PULSE_ROOMS } from './data/pulseRooms';
import { usePulseAudio } from './hooks/usePulseAudio';
import { useSimulatedTyping } from './hooks/useSimulatedTyping';
import { usePulseNotifications } from './hooks/usePulseNotifications';
import { PulseNotificationToast } from './components/PulseNotificationToast';
import { DIALOGUE_SCRIPTS } from './data/dialogueTrees';
import { aiService } from '../../ai/service';
import { loadAISettings } from '../../ai/settings';
import { soundManager } from '../../audio/SoundManager';
import { loadPulseState, savePulseState, getCurrentPulseSlotId, setCurrentPulseSlotId, type PulsePersistedState, type PulseSkin } from './persistence';
import type { PulseActivityEntry, PulseActivityKind } from './types';
import { getNpcStyle, getNpcMoodLabel, getNpcAvailabilityLabel, getNpcActivityLabel } from './data/npcStyles';
import { extractFactsFromPlayerMessage, extractPromisesFromPlayerMessage, looksLikeCompletion, buildConversationSummary, buildMemoryContext, hashReply, isDuplicateReply } from './utils/conversationMemory';
import { extractLocalLinks, pickRandomBuddyLink } from './utils/linkDetector';
import { CHARACTER_ARCHETYPES, pickTemplateOfflineLine, shouldInitiateContact, pickInitiativeText, resolveArchetype, type InitiativeKind } from '../../engine/characterTemplates';
import type { BuddyCharacter } from '../../engine/types';

function getBuddyPersona(buddyId: string, buddy?: BuddyCharacter | null): string {
  const personas: Record<string, string> = {
    ryan: 'Warm, impulsive food-cart coworker. Uses casual slang, jokes, and short messages. He avoids heavy emotional talks unless trust is high.',
    maya: 'Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. She warms up slowly.',
    nora: 'Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but not supernatural.',
    henderson: 'Professional motel manager. Formal, practical, and terse. He cares about rent, schedules, and keeping the property calm.',
  };
  if (personas[buddyId]) return personas[buddyId]!;
  // Dynamic buddies speak from their archetype template (governed, offline-safe).
  const archetype = buddy?.archetype && CHARACTER_ARCHETYPES[buddy.archetype] ? buddy.archetype : undefined;
  if (archetype) {
    const template = CHARACTER_ARCHETYPES[archetype];
    return `${template.personaHint} Vocabulary hints: ${template.vocabulary.join(', ')}. Quirks: ${template.quirks.join(', ')}.`;
  }
  return 'A believable online friend with a distinct but grounded personality.';
}

function getRoomReply(roomId: string): { senderId: string; text: string } {
  if (roomId === 'pc-help') return { senderId: 'ryan', text: 'drop the specs and someone will probably have a mirror link' };
  if (roomId === 'night-shift') return { senderId: 'maya', text: 'hold on... i have a track for exactly that mood' };
  return { senderId: 'nora', text: 'hello, new arrival. please observe the room etiquette.' };
}

export function getRoomResponderId(roomId: string, participantIds: string[], messageCount: number): string {
  if (participantIds.length === 0) return 'nora';
  const offset = roomId.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return participantIds[(offset + messageCount) % participantIds.length] ?? participantIds[0] ?? 'nora';
}

export function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

export const OFFLINE_MESSAGE_POOLS: Record<string, string[]> = {
  maya: [
    'hey... sorry i missed you. i was away from the desk. what did i miss?',
    'are you there? i made coffee and thought of you :)',
    'i left a note on myplace... tell me what you think when you get this — http://myplace.local/maya_x',
    'the rain got heavy again. i was listening to that track we talked about — http://rain-archive.local/',
    'you were offline for a bit — i bookmarked something on findit for you: http://rain-archive.local/collection',
    'check this when you are back: http://retroamp.local/playlist/maya-blue ~',
  ],
  ryan: [
    'yo, leaving this here before i crash. we still on for later?',
    'dude my cart shift was brutal lol. hmu when you are back',
    'found a mirror that actually works. will send the link when you are on — http://downloadhub.local/files/flashfetch',
    'yo i tried buzzing you but you were offline. ping me — also http://techmart.local/product/ram512 is the ram i mentioned',
    'leaving this offline so you see it: tacos tomorrow? my treat if you show — http://taco-cart.local/',
    'check the pc help room mirror list: http://pc-help.local/',
  ],
  nora: [
    'you were offline. i found an interesting link and bookmarked it for you. http://canal-hum.local/recording',
    'nightboard was quiet while you were away. left you a thread to read: http://nightboard.local/thread/104',
    'heard that hum again near the canal. tell me if you hear it too? http://canal-hum.local/recording',
    'i was indexing logs. you missed a weird post — i saved it: http://archive.local/logs/nora-index',
    'the lounge was empty. i kept a seat for you — http://nightboard.local/thread/112',
    'found a log that mentions the motel: http://citywire.local/article/power_grid',
  ],
  henderson: [
    'Please contact the office regarding your account when convenient. http://motellink.local/',
    'Reminder: rent ledger updated. See me at the front desk if you have questions. http://motellink.local/',
    'Office hours 08:00–20:00. Leave a message if you miss me. http://motellink.local/',
    'Noticed a draft by the window. Let me know if the heat is uneven.',
    'Your mailbox has a notice. Check when you are back online. http://goldnet.local/',
    'Updated office notice: http://citywire.local/article/motel-district',
  ],
};

export function pickOfflineMessage(buddyId: string, minute: number, archetype?: BuddyCharacter['archetype']): string {
  const pool = OFFLINE_MESSAGE_POOLS[buddyId];
  if (pool) {
    const index = hashString(`${buddyId}:${minute}`) % pool.length;
    return pool[index] || pool[0]!;
  }
  // Dynamic buddies use their archetype's offline voice; unknown falls back to generic.
  if (archetype && CHARACTER_ARCHETYPES[archetype]) {
    return pickTemplateOfflineLine(archetype, minute);
  }
  return `hey, you missed me at ${minute}. ping me later?`;
}

export function collectMissedPresenceActivities(
  lastSeenMinute: number,
  currentMinute: number,
  getBuddy: (id: string) => { displayName: string; schedule: Record<number, Array<{ startMinuteOfDay: number; endMinuteOfDay: number; status: string; awayMessage: string }>> } | undefined,
  buddyIds: string[]
): PulseActivityEntry[] {
  if (!Number.isFinite(lastSeenMinute) || !Number.isFinite(currentMinute) || currentMinute <= lastSeenMinute) return [];
  const cappedLastSeen = Math.max(0, lastSeenMinute);
  const elapsed = currentMinute - cappedLastSeen;
  if (elapsed < 15) return [];
  const activities: import('./types').PulseActivityEntry[] = [];
  const startDay = Math.floor(cappedLastSeen / 1440) + 1;
  const endDay = Math.floor(currentMinute / 1440) + 1;
  for (const buddyId of buddyIds) {
    const buddy = getBuddy(buddyId);
    if (!buddy) continue;
    for (let day = startDay; day <= endDay; day += 1) {
      const daySchedule = buddy.schedule[day] || buddy.schedule[1];
      if (!daySchedule) continue;
      for (const block of daySchedule) {
        const blockStartTotal = (day - 1) * 1440 + block.startMinuteOfDay;
        if (blockStartTotal <= cappedLastSeen || blockStartTotal > currentMinute) continue;
        const kind = block.status === 'online' ? 'sign_in' : block.status === 'offline' ? 'sign_out' : 'away';
        const text = kind === 'sign_in'
          ? `${buddy.displayName} signed in.`
          : kind === 'sign_out'
            ? `${buddy.displayName} signed out.`
            : `${buddy.displayName} is away: ${block.awayMessage || 'be right back'}`;
        activities.push({
          id: `missed_${buddyId}_${blockStartTotal}_${kind}`,
          buddyId,
          kind: kind as PulseActivityKind,
          text,
          minute: blockStartTotal,
          createdAt: Date.now() - (currentMinute - blockStartTotal) * 60000,
          isRead: false,
        });
      }
    }
  }
  activities.sort((a, b) => a.minute - b.minute);
  return activities.slice(-30);
}

export function getRoomResponderSequence(roomId: string, participantIds: string[], messageCount: number, playerText: string): string[] {
  if (participantIds.length === 0) return ['nora'];
  const primary = getRoomResponderId(roomId, participantIds, messageCount);
  const hash = hashString(`${roomId}:${messageCount}:${playerText}`);
  const roll = hash % 100;
  let count = 1;
  if (participantIds.length >= 2) {
    if (roll < 10) count = 3;
    else if (roll < 40) count = 2;
  }
  // Cap by available participants
  count = Math.min(count, participantIds.length);
  if (count === 1) return [primary];
  const remaining = participantIds.filter((id) => id !== primary);
  const secondIndex = (hash >> 7) % remaining.length;
  const second = remaining[secondIndex]!;
  if (count === 2) return [primary, second];
  const remaining2 = remaining.filter((id) => id !== second);
  const thirdIndex = (hash >> 14) % remaining2.length;
  const third = remaining2[thirdIndex]!;
  return [primary, second, third];
}

export const PulseMessengerApp: React.FC = () => {
  const engine = useSimulationStore((s) => s.engine);
  const conversations = useSimulationStore((s) => s.state.social.conversations);
  const currentDay = useSimulationStore((s) => s.state.time.day);
  const totalMinutes = useSimulationStore((s) => s.state.time.totalMinutes);
  const presenceMap = useSimulationStore((s) => s.state.social.presence);

  usePulseAudio();

  const [session, setSession] = useState<PulseLoginSession | null>(null);
  const [openBuddyIds, setOpenBuddyIds] = useState<string[]>(['maya']);
  const [activeBuddyId, setActiveBuddyId] = useState<string>('maya');
  const [view, setView] = useState<PulseListView>('contacts');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [buzzActive, setBuzzActive] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [showFriendRequest, setShowFriendRequest] = useState(false);
  const [roomTyping, setRoomTyping] = useState(false);
  const [currentSlotId, setCurrentSlotIdState] = useState<string>(() => getCurrentPulseSlotId());
  const [pulseState, setPulseState] = useState<PulsePersistedState>(() => loadPulseState(getCurrentPulseSlotId()));
  const triggeredDayScripts = useRef<Set<string>>(new Set());
  const previousPresence = useRef<Record<string, string>>({});
  const deliveredOfflineForSession = useRef(false);

  const {
    typingState,
    playerTypingText,
    isPlayerTyping,
    triggerNpcScript,
    triggerGeneratedResponse,
    selectPlayerChoice,
  } = useSimulatedTyping(activeBuddyId);

  const { activeToasts, dismissToast } = usePulseNotifications(activeBuddyId);

  const { joinedRoomIds, roomMessages, roomTopics, friendRequestStatus, pulseSkin } = pulseState;

  useEffect(() => {
    savePulseState(pulseState, currentSlotId);
  }, [pulseState, currentSlotId]);

  const handleChangeSkin = (skin: PulseSkin) => {
    setPulseState((previous) => ({ ...previous, pulseSkin: skin }));
  };

  const handleSwitchSlot = (slotId: string) => {
    const cleanSlotId = slotId.trim().slice(0, 32) || 'slot_1';
    if (cleanSlotId === currentSlotId) return;
    // Persist current slot before switching
    savePulseState(pulseState, currentSlotId);
    setCurrentPulseSlotId(cleanSlotId);
    setCurrentSlotIdState(cleanSlotId);
    const nextState = loadPulseState(cleanSlotId);
    setPulseState(nextState);
    deliveredOfflineForSession.current = false;
    previousPresence.current = {};
    triggeredDayScripts.current.clear();
    setInviteNotice(`Switched to ${cleanSlotId} — Pulse timeline isolated.`);
    window.setTimeout(() => setInviteNotice(null), 2200);
  };

  useEffect(() => {
    if (!session || !Number.isFinite(totalMinutes)) return;
    const changes: PulseActivityEntry[] = [];
    Object.entries(presenceMap).forEach(([buddyId, presence]) => {
      const nextKey = `${presence.status}:${presence.awayMessage}`;
      const previousKey = previousPresence.current[buddyId];
      previousPresence.current[buddyId] = nextKey;
      if (!previousKey || previousKey === nextKey) return;
      const buddy = engine.social.getBuddy(buddyId);
      if (!buddy) return;
      const kind = presence.status === 'online' ? 'sign_in' : presence.status === 'offline' ? 'sign_out' : 'away';
      const text = kind === 'sign_in'
        ? `${buddy.displayName} signed in.`
        : kind === 'sign_out'
          ? `${buddy.displayName} signed out.`
          : `${buddy.displayName} is away: ${presence.awayMessage || 'be right back'}`;
      changes.push({ id: `activity_${buddyId}_${totalMinutes}_${kind}`, buddyId, kind, text, minute: totalMinutes, createdAt: Date.now(), isRead: false });
    });
    if (changes.length > 0) {
      setPulseState((previous) => {
        const nextAwayHistory = { ...previous.awayHistory };
        changes.forEach((entry) => {
          if (entry.kind === 'away') {
            const existing = nextAwayHistory[entry.buddyId] || [];
            nextAwayHistory[entry.buddyId] = [...existing, entry].slice(-20);
          }
        });
        return { ...previous, activityFeed: [...previous.activityFeed, ...changes].slice(-80), awayHistory: nextAwayHistory };
      });
    }
  }, [engine, presenceMap, session, totalMinutes]);

  useEffect(() => {
    if (!session || deliveredOfflineForSession.current || !Number.isFinite(totalMinutes)) return;
    deliveredOfflineForSession.current = true;
    const elapsed = totalMinutes - pulseState.lastSeenTotalMinutes;
    const buddyIds = engine.social.getBuddies().map((buddy) => buddy.id).filter((id) => !pulseState.blockedBuddyIds.includes(id));
    const missedActivities = collectMissedPresenceActivities(pulseState.lastSeenTotalMinutes, totalMinutes, (id) => engine.social.getBuddy(id) as any, buddyIds);
    const offlineActivities: PulseActivityEntry[] = [];
    const offlineNewLinks: import('./persistence').PulseSharedLink[] = [];
    // Generate varied offline messages when the player was away long enough.
    // Each buddy that was at least once online/away during the absence may leave one.
    if (elapsed >= 30) {
      const shouldLeaveMessage = (buddyId: string): boolean => {
        // Deterministic 75% chance per buddy based on elapsed and buddy hash — keeps world feeling alive but not spammy.
        if (elapsed >= 90) return true;
        const roll = hashString(`${buddyId}:${pulseState.lastSeenTotalMinutes}:${totalMinutes}`) % 100;
        return roll < 75;
      };
      engine.social.getBuddies().forEach((buddy) => {
        if (pulseState.blockedBuddyIds.includes(buddy.id)) return;
        if (!shouldLeaveMessage(buddy.id)) return;
        const hash = hashString(`${buddy.id}:${totalMinutes}:${pulseState.lastSeenTotalMinutes}`);
        const maxOffset = Math.max(10, elapsed - 12);
        const offset = 10 + (hash % Math.min( maxOffset, 720));
        const timestampMinute = Math.min(totalMinutes - 2, Math.max(pulseState.lastSeenTotalMinutes + 10, pulseState.lastSeenTotalMinutes + offset));
        const text = pickOfflineMessage(buddy.id, timestampMinute, buddy.archetype);
        // Capture any .local links from offline message for sharedLinks / FindIt discovery
        extractLocalLinks(text).forEach((link) => {
          const lower = link.url.toLowerCase();
          if (offlineNewLinks.some((entry) => entry.url.toLowerCase() === lower) || pulseState.sharedLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
          offlineNewLinks.push({
            id: `shared_offline_${buddy.id}_${link.host}_${timestampMinute}`,
            url: link.url,
            host: link.host,
            title: `${link.host} — shared by ${buddy.displayName}`,
            sharedBy: buddy.id,
            sharedByName: buddy.displayName,
            minute: timestampMinute,
            snippet: `Offline message from ${buddy.displayName} at Day ${Math.floor(timestampMinute / 1440) + 1}.`,
          });
        });
        engine.dispatchAction({ type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: buddy.id, text, timestampMinute, deliveredAway: true, tags: ['offline-message', 'offline'] });
        if (elapsed >= 240) {
          // Very long absence: second message from the most social buddies with a staggered timestamp.
          if (buddy.id === 'maya' || buddy.id === 'ryan') {
            const secondOffset = Math.min(offset + 45, elapsed - 4);
            const secondMinute = Math.min(totalMinutes - 1, pulseState.lastSeenTotalMinutes + secondOffset);
            const secondText = pickOfflineMessage(buddy.id, secondMinute + 999, buddy.archetype);
            if (secondText !== text) {
              extractLocalLinks(secondText).forEach((link) => {
                const lower = link.url.toLowerCase();
                if (offlineNewLinks.some((entry) => entry.url.toLowerCase() === lower) || pulseState.sharedLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
                offlineNewLinks.push({
                  id: `shared_offline_${buddy.id}_${link.host}_${secondMinute}`,
                  url: link.url,
                  host: link.host,
                  title: `${link.host} — shared by ${buddy.displayName}`,
                  sharedBy: buddy.id,
                  sharedByName: buddy.displayName,
                  minute: secondMinute,
                  snippet: `Offline message from ${buddy.displayName} at Day ${Math.floor(secondMinute / 1440) + 1}.`,
                });
              });
              engine.dispatchAction({ type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: buddy.id, text: secondText, timestampMinute: secondMinute, deliveredAway: true, tags: ['offline-message'] });
            }
          }
        }
        offlineActivities.push({ id: `offline_${buddy.id}_${timestampMinute}`, buddyId: buddy.id, kind: 'message', text: `${buddy.displayName} left you an offline message.`, minute: timestampMinute, createdAt: Date.now() - (totalMinutes - timestampMinute) * 60000, isRead: false });
      });
    }
    // P3 — NPC initiatives (rules pick the moment + template voice; AI only paraphrases in live chat).
    // Fires once per session login, max once/day/buddy (persisted in initiatedToday).
    const initiatedToday: Record<string, number> = { ...(pulseState.initiatedToday || {}) };
    const initiativeDay = Math.floor(totalMinutes / 1440) + 1;
    try {
      const engineAny = engine as unknown as { world?: { getTriggeredEvents?: () => Array<{ title?: string; triggerDay?: number }> } };
      const worldEvents = engineAny.world?.getTriggeredEvents?.() || [];
      const freshEvents = worldEvents.filter((e) => typeof e.triggerDay === 'number' && (e.triggerDay === initiativeDay || e.triggerDay === initiativeDay - 1) && typeof e.title === 'string' && e.title.trim().length > 3);
      for (const buddy of engine.social.getBuddies()) {
        if (pulseState.blockedBuddyIds.includes(buddy.id)) continue;
        if (initiatedToday[buddy.id] === initiativeDay) continue;
        if (buddy.status === 'distant' || buddy.status === 'gone' || buddy.status === 'blocked') continue;
        const stage = engine.social.getRelationshipStage(buddy.id);
        const pres = engine.social.getPresence(buddy.id);
        const mood = engine.social.getDailyMood(buddy.id, initiativeDay);
        const roll = hashString(`${buddy.id}:${initiativeDay}:init`) % 100;
        if (!shouldInitiateContact({ stage, presenceStatus: pres?.status ?? 'offline', mood, initiatedToday: false, roll })) continue;
        // Kind pick: open promise → reminder, fresh world event → share, else check-in (close: rare cafe invite)
        const open = engine.social.getOpenPromises(buddy.id);
        const kindRoll = hashString(`${buddy.id}:${initiativeDay}:kind`) % 100;
        let kind: InitiativeKind = 'checkin';
        let eventTitle: string | undefined;
        if (open.length > 0 && kindRoll < 40) {
          kind = 'promise_reminder';
        } else if (freshEvents.length > 0 && kindRoll < 75) {
          kind = 'event_share';
          eventTitle = freshEvents[hashString(`${buddy.id}:${initiativeDay}:evt`) % freshEvents.length]?.title;
        }
        if (kind === 'checkin' && stage === 'close' && (hashString(`${buddy.id}:${initiativeDay}:cafe`) % 100) < 10) kind = 'cafe_invite';
        const text = pickInitiativeText(resolveArchetype(buddy.id, buddy.archetype), kind, `${buddy.id}:${initiativeDay}`, { eventTitle, promiseText: open[0]?.text });
        engine.dispatchAction({ type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: buddy.id, text, deliveredAway: false, tags: ['initiative', kind] });
        initiatedToday[buddy.id] = initiativeDay;
        offlineActivities.push({ id: `initiative_${buddy.id}_${initiativeDay}`, buddyId: buddy.id, kind: 'message', text: `${buddy.displayName} messaged you first.`, minute: totalMinutes, createdAt: Date.now(), isRead: false });
      }
    } catch { /* initiatives never break login */ }
    const mergedActivities = [...missedActivities, ...offlineActivities].sort((a, b) => a.minute - b.minute);
    setPulseState((previous) => {
      const nextAwayHistory = { ...previous.awayHistory };
      mergedActivities.forEach((entry) => {
        if (entry.kind === 'away') {
          const existing = nextAwayHistory[entry.buddyId] || [];
          if (!existing.some((e) => e.id === entry.id)) nextAwayHistory[entry.buddyId] = [...existing, entry].slice(-20);
        }
      });
      // Also push missed away entries into away history if they came from schedule gap.
      missedActivities.forEach((entry) => {
        if (entry.kind === 'away') {
          const existing = nextAwayHistory[entry.buddyId] || [];
          if (!existing.some((e) => e.id === entry.id)) nextAwayHistory[entry.buddyId] = [...existing, entry].slice(-20);
        }
      });
      // Merge offline-discovered links
      const existingShared = previous.sharedLinks || [];
      const existingUrls = new Set(existingShared.map((link) => link.url.toLowerCase()));
      const newLinksToAdd = offlineNewLinks.filter((link) => !existingUrls.has(link.url.toLowerCase()));
      const mergedSharedLinks = [...existingShared, ...newLinksToAdd].slice(-30);
      const discoveredSet = new Set(previous.discoveredHosts || []);
      newLinksToAdd.forEach((link) => discoveredSet.add(link.host.toLowerCase()));
      const mergedDiscoveredHosts = Array.from(discoveredSet).slice(0, 30);
      return { ...previous, lastSeenTotalMinutes: totalMinutes, initiatedToday, activityFeed: [...previous.activityFeed, ...mergedActivities].slice(-80), awayHistory: nextAwayHistory, sharedLinks: mergedSharedLinks, discoveredHosts: mergedDiscoveredHosts };
    });
  }, [engine, pulseState.lastSeenTotalMinutes, session, totalMinutes]);
  const unreadCounts: Record<string, number> = {};
  Object.entries(conversations).forEach(([buddyId, msgs]) => {
    const unreads = msgs.filter((message) => !message.isRead && message.senderId !== 'player').length;
    if (unreads > 0) unreadCounts[buddyId] = unreads;
  });
  const roomUnreadCounts: Record<string, number> = Object.fromEntries(PULSE_ROOMS.map((room) => {
    const total = pulseState.roomMessages[room.id]?.length ?? 0;
    const readThrough = pulseState.roomReadThrough[room.id] ?? 0;
    return [room.id, Math.max(0, total - readThrough)];
  }));

  const handleOpenChat = (buddyId: string) => {
    if (!openBuddyIds.includes(buddyId)) setOpenBuddyIds((previous) => [...previous, buddyId]);
    setSelectedBuddyId(null);
    setActiveBuddyId(buddyId);
    setActiveRoomId(null);
    setView('contacts');
    engine.social.markAsRead(buddyId);
    setPulseState((previous) => ({
      ...previous,
      activityFeed: previous.activityFeed.map((entry) => entry.buddyId === buddyId ? { ...entry, isRead: true } : entry),
      awayHistory: previous.awayHistory[buddyId]
        ? { ...previous.awayHistory, [buddyId]: previous.awayHistory[buddyId]!.map((entry) => ({ ...entry, isRead: true })) }
        : previous.awayHistory,
    }));
  };

  const handleOpenRoom = (roomId: string) => {
    setPulseState((previous) => {
      const alreadyJoined = previous.joinedRoomIds.includes(roomId);
      if (alreadyJoined) {
        return { ...previous, roomReadThrough: { ...previous.roomReadThrough, [roomId]: previous.roomMessages[roomId]?.length ?? 0 } };
      }
      const room = getPulseRoom(roomId);
      const joinMessage: PulseRoomMessage = { id: `room_join_${roomId}_${Date.now()}`, senderId: 'system', senderName: 'Pulse', text: `you joined ${room?.name || 'the room'}.`, minute: totalMinutes, kind: 'system' };
      const nextMessages = [...(previous.roomMessages[roomId] || []), joinMessage].slice(-80);
      return {
        ...previous,
        joinedRoomIds: [...previous.joinedRoomIds, roomId],
        roomMessages: { ...previous.roomMessages, [roomId]: nextMessages },
        roomReadThrough: { ...previous.roomReadThrough, [roomId]: nextMessages.length },
      };
    });
    setActiveRoomId(roomId);
    setSelectedBuddyId(null);
    setView('rooms');
  };

  const handleBuzz = () => {
    soundManager.play('buzz');
    setBuzzActive(true);
    window.setTimeout(() => setBuzzActive(false), 650);
  };

  const handleAcceptFriendRequest = () => {
    soundManager.play('invite');
    setPulseState((previous) => ({ ...previous, friendRequestStatus: 'accepted' }));
    setShowFriendRequest(false);
    setInviteNotice('webmaster_2006 was added to your local address book.');
    window.setTimeout(() => setInviteNotice(null), 2600);
  };

  const handleInvite = (buddyId: string, roomId: string) => {
    const buddy = engine.social.getBuddy(buddyId);
    const room = getPulseRoom(roomId);
    if (!buddy || !room) return;
    soundManager.play('invite');
    setInviteNotice(`${buddy.displayName} has been invited to ${room.name}.`);
    window.setTimeout(() => setInviteNotice(null), 2600);
  };

  const handleBlockBuddy = (buddyId: string) => {
    const buddy = engine.social.getBuddy(buddyId);
    setPulseState((previous) => {
      if (previous.blockedBuddyIds.includes(buddyId)) return previous;
      return { ...previous, blockedBuddyIds: [...previous.blockedBuddyIds, buddyId] };
    });
    soundManager.play('buzz');
    setInviteNotice(`${buddy?.displayName || buddyId} has been blocked.`);
    window.setTimeout(() => setInviteNotice(null), 2600);
    setOpenBuddyIds((previous) => previous.filter((id) => id !== buddyId));
    if (activeBuddyId === buddyId) setActiveBuddyId(() => {
      const remaining = openBuddyIds.filter((id) => id !== buddyId);
      return remaining[0] || '';
    });
  };

  const handleUnblockBuddy = (buddyId: string) => {
    const buddy = engine.social.getBuddy(buddyId);
    setPulseState((previous) => ({ ...previous, blockedBuddyIds: previous.blockedBuddyIds.filter((id) => id !== buddyId) }));
    setInviteNotice(`${buddy?.displayName || buddyId} has been unblocked.`);
    window.setTimeout(() => setInviteNotice(null), 2600);
  };

  const handleRemoveBuddy = (buddyId: string) => {
    const buddy = engine.social.getBuddy(buddyId);
    // Remove is currently a soft-block (hide) with a distinct message; unblock restores it.
    setPulseState((previous) => {
      if (previous.blockedBuddyIds.includes(buddyId)) return previous;
      return { ...previous, blockedBuddyIds: [...previous.blockedBuddyIds, buddyId] };
    });
    setInviteNotice(`${buddy?.displayName || buddyId} removed from your buddy list. (Use Unblock to restore)`);
    window.setTimeout(() => setInviteNotice(null), 2600);
    setOpenBuddyIds((previous) => previous.filter((id) => id !== buddyId));
    if (activeBuddyId === buddyId) setActiveBuddyId(() => {
      const remaining = openBuddyIds.filter((id) => id !== buddyId);
      return remaining[0] || '';
    });
  };

  const handleRenameGroup = (groupId: string, newLabel: string) => {
    const clean = newLabel.trim().slice(0, 32);
    if (!clean) return;
    setPulseState((previous) => ({ ...previous, groupLabels: { ...previous.groupLabels, [groupId]: clean } }));
  };

  const handleReorderGroup = (groupId: string, direction: 'up' | 'down') => {
    setPulseState((previous) => {
      const order = [...previous.groupOrder];
      const index = order.indexOf(groupId);
      if (index === -1) return previous;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= order.length) return previous;
      const temp = order[index]!;
      order[index] = order[targetIndex]!;
      order[targetIndex] = temp;
      return { ...previous, groupOrder: order };
    });
  };

  const handleCloseTab = (buddyId: string) => {
    const nextTabs = openBuddyIds.filter((id) => id !== buddyId);
    setOpenBuddyIds(nextTabs);
    if (activeBuddyId === buddyId) setActiveBuddyId(nextTabs[0] || '');
  };

  const handleSendMessage = async (buddyId: string, text: string) => {
    if (pulseState.blockedBuddyIds.includes(buddyId)) {
      setInviteNotice('You have blocked this buddy. Unblock to send messages.');
      window.setTimeout(() => setInviteNotice(null), 2200);
      return;
    }
    engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId, text });

    // P3 — promise ledger: capture commitments, detect follow-through (rules only, no AI)
    try {
      const gameDay = Math.floor(totalMinutes / 1440) + 1;
      for (const extracted of extractPromisesFromPlayerMessage(text)) {
        engine.social.addPromise(
          buddyId,
          extracted.text,
          gameDay,
          extracted.dueDayOffset !== undefined ? gameDay + extracted.dueDayOffset : undefined
        );
      }
      if (looksLikeCompletion(text)) {
        const open = engine.social.getOpenPromises(buddyId);
        if (open.length > 0 && open[0]) engine.social.resolvePromise(buddyId, open[0].id, true, gameDay);
      }
    } catch { /* promise ledger never blocks chat */ }

    const buddy = engine.social.getBuddy(buddyId);
    const relationship = engine.social.getRelationships(buddyId);
    const presence = engine.social.getPresence(buddyId);
    const gameHour = Math.floor((totalMinutes % 1440) / 60);
    let playerEnergy = 80;
    try { playerEnergy = (engine as unknown as { economy: { getState: () => { energy: number } } }).economy.getState().energy ?? 80; } catch { playerEnergy = 80; }
    const style = getNpcStyle(buddyId);
    const mood = getNpcMoodLabel(presence, relationship, gameHour, playerEnergy);
    const availability = getNpcAvailabilityLabel(presence, gameHour);
    const activity = getNpcActivityLabel(presence, buddyId, gameHour);
    const existingMemory = pulseState.conversationMemory[buddyId] || [];
    const existingFacts = pulseState.buddyFacts[buddyId] || [];
    const newFacts = extractFactsFromPlayerMessage(text);
    const mergedFacts = [...existingFacts, ...newFacts].slice(-12);
    const recentMessagesForSummary = engine.social.getMessages(buddyId).slice(-8).map((message) => ({
      sender: message.senderId === 'player' ? 'player' : 'buddy',
      text: message.text,
    }));
    const previousSummary = pulseState.conversationSummaries[buddyId] || '';
    const updatedSummary = buildConversationSummary(recentMessagesForSummary, previousSummary);
    const recentRepliesForBuddy = pulseState.recentReplies[buddyId] || [];
    const memoryContext = buildMemoryContext([...existingMemory, `Player said: ${text}`].slice(-6), mergedFacts, updatedSummary, recentRepliesForBuddy);

    setPulseState((previous) => ({
      ...previous,
      conversationMemory: { ...previous.conversationMemory, [buddyId]: [...(previous.conversationMemory[buddyId] || []), `Player said: ${text}`].slice(-6) },
      conversationSummaries: { ...previous.conversationSummaries, [buddyId]: updatedSummary },
      buddyFacts: { ...previous.buddyFacts, [buddyId]: mergedFacts },
      npcMood: { ...previous.npcMood, [buddyId]: mood },
      npcActivity: { ...previous.npcActivity, [buddyId]: activity },
    }));

    const recentMessages = recentMessagesForSummary;

    const personaWithStyle = `${style.persona} Vocabulary hints: ${style.vocabulary.join(', ')}. Punctuation: ${style.punctuation}. Quirks: ${style.quirks.join(', ')}. ${getBuddyPersona(buddyId, buddy)}`;
    // P3 — stage/mood/long-term memory injected so the NPC honours history (AI paraphrases, rules decide)
    let relationshipStage = 'acquaintance';
    let dailyMood = 'steady';
    let longTermContext = '';
    try {
      relationshipStage = engine.social.getRelationshipStage(buddyId);
      dailyMood = engine.social.getDailyMood(buddyId, currentDay);
      longTermContext = engine.social.buildLongTermContext(buddyId);
    } catch { /* prompt enrichment is best-effort */ }
    const relationshipSummary = `${relationship ? JSON.stringify(relationship) : 'new friendship'} | Stage: ${relationshipStage} | DailyMood: ${dailyMood} | Mood: ${mood} | Availability: ${availability} | Activity: ${activity} | ${memoryContext} | ${longTermContext} | Typing: ${style.typing.wpm} wpm, ${style.typing.pauseStyle}`;
    // Sandbox world knowledge — per-buddy attitude (B)
    let worldKnowledge = '';
    let currentGameDay = currentDay;
    try {
      const engineAny = engine as unknown as { world?: { getKnowledgeContextForBuddy: (buddyId: string, day: number) => string; getKnowledgeContext: (day: number) => string } ; clock?: { getTime: () => { day: number } } };
      if (engineAny.world?.getKnowledgeContextForBuddy) {
        worldKnowledge = engineAny.world.getKnowledgeContextForBuddy(buddyId, currentGameDay ?? 1);
      } else if (engineAny.world?.getKnowledgeContext) {
        worldKnowledge = engineAny.world.getKnowledgeContext(currentGameDay ?? 1);
      } else if (engineAny.clock?.getTime) {
        currentGameDay = engineAny.clock.getTime().day;
      }
    } catch {}

    let result = await aiService.generateChat({
      buddyId,
      displayName: buddy?.displayName || buddyId,
      handle: buddy?.handle || buddyId,
      persona: personaWithStyle,
      relationshipSummary,
      recentMessages,
      playerMessage: text,
      worldKnowledge,
      currentDay: currentGameDay,
    }, loadAISettings());

    // Anti-repeat: check if AI reply duplicates recent replies
    const candidateTexts = result.data.messages.map((message) => message.text);
    const recentHashes = recentRepliesForBuddy.map(hashReply);
    const isDupe = candidateTexts.some((candidateText) => isDuplicateReply(candidateText, recentHashes, recentRepliesForBuddy));
    if (isDupe && !result.meta.fallback) {
      // Retry once with explicit anti-repeat instruction
      const retryRelationshipSummary = `${relationshipSummary} | IMPORTANT: Avoid repeating these exact phrases: ${recentRepliesForBuddy.slice(-3).join(' | ')}. Vary wording and keep it fresh.`;
      try {
        const retryResult = await aiService.generateChat({
          buddyId,
          displayName: buddy?.displayName || buddyId,
          handle: buddy?.handle || buddyId,
          persona: personaWithStyle,
          relationshipSummary: retryRelationshipSummary,
          recentMessages,
          playerMessage: text,
          worldKnowledge,
          currentDay: currentGameDay,
        }, { ...loadAISettings(), } as any);
        // Only use retry if it is not also duplicate and not fallback
        const retryTexts = retryResult.data.messages.map((message) => message.text);
        const retryIsDupe = retryTexts.some((retryText) => isDuplicateReply(retryText, recentHashes, recentRepliesForBuddy));
        if (!retryIsDupe || retryResult.meta.fallback) {
          result = retryResult;
        } else if (!retryIsDupe) {
          result = retryResult;
        }
      } catch {
        // keep original result on retry failure
      }
    }

    // Link handling: inject occasional .local link if AI didn't include one, then capture
    let finalCandidateTexts = result.data.messages.map((message) => message.text);
    let detectedLinks = finalCandidateTexts.flatMap((candidateText) => extractLocalLinks(candidateText));
    if (detectedLinks.length === 0) {
      const chance = buddyId === 'nora' ? 38 : buddyId === 'maya' ? 32 : buddyId === 'ryan' ? 22 : 12;
      const roll = hashString(`${buddyId}:${totalMinutes}:${text}:${finalCandidateTexts.join('|')}`) % 100;
      if (roll < chance) {
        const picked = pickRandomBuddyLink(buddyId, totalMinutes);
        if (picked && result.data.messages[0]) {
          result.data.messages[0].text = `${result.data.messages[0].text.trim()} ${picked.url}`;
          finalCandidateTexts = result.data.messages.map((message) => message.text);
          detectedLinks = finalCandidateTexts.flatMap((candidateText) => extractLocalLinks(candidateText));
        }
      }
    }

    // Persist recent replies (store raw texts) and update summary post-reply, plus shared links
    const newReplyTexts = result.data.messages.map((message) => message.text.slice(0, 500));
    // Avoid storing fallback generic replies as canonical fingerprints? We still store to avoid loops, but mark as fallback.
    setPulseState((previous) => {
      const existingReplies = previous.recentReplies[buddyId] || [];
      const mergedReplies = [...existingReplies, ...newReplyTexts].slice(-6);
      // Rebuild summary to include the new AI reply for next turn
      const messagesWithReply = [...recentMessages, ...newReplyTexts.map((replyText) => ({ sender: 'buddy', text: replyText }))];
      const postReplySummary = buildConversationSummary(messagesWithReply, previous.conversationSummaries[buddyId] || updatedSummary);

      // Shared links: capture any .local links from the final AI reply
      const existingSharedLinks = previous.sharedLinks || [];
      const existingUrls = new Set(existingSharedLinks.map((link) => link.url.toLowerCase()));
      const newSharedLinks: typeof existingSharedLinks = [];
      detectedLinks.forEach((link) => {
        const lower = link.url.toLowerCase();
        if (existingUrls.has(lower) || newSharedLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
        // Try to find rich title/snippet from buddy pool, otherwise generic
        const poolMatch = (() => {
          try {
            const pool = (pickRandomBuddyLink(buddyId, totalMinutes) as unknown as { host: string; title: string; snippet: string } | null);
            return pool && pool.host === link.host ? pool : null;
          } catch { return null; }
        })();
        const title = poolMatch?.title || `${link.host} — shared by ${buddy?.displayName || buddyId}`;
        const snippet = poolMatch?.snippet || `Shared in Pulse by ${buddy?.displayName || buddyId} at Day ${Math.floor(totalMinutes / 1440) + 1}.`;
        newSharedLinks.push({
          id: `shared_${buddyId}_${link.host}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          url: link.url,
          host: link.host,
          title,
          sharedBy: buddyId,
          sharedByName: buddy?.displayName || buddyId,
          minute: totalMinutes,
          snippet,
        });
      });
      const mergedSharedLinks = [...existingSharedLinks, ...newSharedLinks].slice(-30);
      const existingDiscovered = new Set(previous.discoveredHosts || []);
      newSharedLinks.forEach((link) => existingDiscovered.add(link.host.toLowerCase()));
      const mergedDiscoveredHosts = Array.from(existingDiscovered).slice(0, 30);

      return {
        ...previous,
        recentReplies: { ...previous.recentReplies, [buddyId]: mergedReplies },
        conversationSummaries: { ...previous.conversationSummaries, [buddyId]: postReplySummary },
        sharedLinks: mergedSharedLinks,
        discoveredHosts: mergedDiscoveredHosts,
      };
    });

    // Character image generation: if NPC agreed to send a photo, generate a small era-appropriate image via Fal (or fallback)
    const rawImagePrompt = (result.data as any).imagePrompt as string | null | undefined;
    const msgImagePrompt = result.data.messages.find((m: any) => (m as any).imagePrompt)?.imagePrompt as string | undefined;
    const effectiveImagePrompt = (rawImagePrompt || msgImagePrompt || '').trim();
    if (effectiveImagePrompt && effectiveImagePrompt.length > 8) {
      try {
        const { generateCharacterImage } = await import('../../ai/imageService');
        const buddyName = buddy?.displayName || buddyId;
        const imgRes = await generateCharacterImage(
          { buddyId, buddyName, prompt: effectiveImagePrompt, size: { width: 320, height: 240 } },
          loadAISettings()
        );
        // Attach to the last message so useSimulatedTyping can send it with the image
        const lastIdx = result.data.messages.length - 1;
        if (lastIdx >= 0 && result.data.messages[lastIdx]) {
          (result.data.messages[lastIdx] as any).imageUrl = imgRes.url;
          (result.data.messages[lastIdx] as any).imagePrompt = effectiveImagePrompt;
          (result.data.messages[lastIdx] as any).imageCaption = (result.data as any).imageCaption || (result.data.messages[lastIdx] as any).imageCaption || '';
        }
      } catch (err) {
        console.warn('Character image generation failed, using text only', err);
      }
    }

    triggerGeneratedResponse(buddyId, result.data);
  };

  const handleSendRoomMessage = async (text: string) => {
    if (!activeRoomId || !session) return;
    const room = getPulseRoom(activeRoomId);
    if (!room) return;
    const minute = currentDay * 1440 + new Date().getHours() * 60 + new Date().getMinutes();
    const playerMessage: PulseRoomMessage = { id: `room_${Date.now()}`, senderId: 'player', senderName: session.username, text, minute };
    const existingMessages = pulseState.roomMessages[room.id] || [];
    setPulseState((previous) => ({ ...previous, roomMessages: { ...previous.roomMessages, [room.id]: [...(previous.roomMessages[room.id] || []), playerMessage].slice(-80) } }));
    setRoomTyping(true);

    const responderIds = getRoomResponderSequence(room.id, room.participantIds, existingMessages.length, text);
    const roomTopic = roomTopics[room.id] || room.topic;
    let recentMessages = [...existingMessages, playerMessage].slice(-10).map((message) => ({
      sender: message.senderId === 'player' ? 'player' : message.senderName,
      text: message.text,
    }));

    try {
      for (let responderIndex = 0; responderIndex < responderIds.length; responderIndex++) {
        const responderId = responderIds[responderIndex]!;
        const responder = engine.social.getBuddy(responderId);
        const style = getNpcStyle(responderId);
        const persona = `${style.persona} You are replying inside the group room "${room.name}". Room topic: ${roomTopic}. Keep the reply conversational and aware that other participants (${responderIds.join(', ')}) are present.${responderIndex > 0 ? ' Another participant just replied before you — acknowledge or build on it briefly without repeating.' : ''}`;

        if (responderIndex > 0) {
          // Staggered typing pause between multiple responders
          await new Promise((resolve) => setTimeout(resolve, 450 + (hashString(`${room.id}:${text}:${responderIndex}`) % 700)));
        }

        // Per-buddy attitude for room responders
        let roomWorldKnowledge = '';
        try {
          const eAny = engine as unknown as { world?: { getKnowledgeContextForBuddy: (bid:string, day:number)=>string; getKnowledgeContext: (day:number)=>string } };
          roomWorldKnowledge = eAny.world?.getKnowledgeContextForBuddy?.(responderId, currentDay) ?? eAny.world?.getKnowledgeContext(currentDay) ?? '';
        } catch {}
        const result = await aiService.generateChat({
          buddyId: `room-${room.id}-${responderId}-${responderIndex}`,
          displayName: responder?.displayName || responderId,
          handle: responder?.handle || responderId,
          persona,
          relationshipSummary: `Group room: ${room.name}. Participants: ${room.participantIds.join(', ')}. Responder #${responderIndex + 1} of ${responderIds.length}.`,
          recentMessages: [...recentMessages],
          playerMessage: text,
          worldKnowledge: roomWorldKnowledge,
          currentDay: currentDay,
        }, loadAISettings());

        let generatedText = result.data.messages[0]?.text?.trim() || '';
        let finalText = generatedText;
        if (!finalText || result.meta.fallback) {
          const fallback = getRoomReply(room.id);
          if (responderIndex === 0) {
            finalText = fallback.text;
          } else {
            const fallbackPools: Record<string, string[]> = {
              'orion-lounge': ['lol yeah, that tracks', 'i was just thinking the same', 'anyone else getting that vibe?'],
              'pc-help': ['try a different mirror, the main one is throttled', 'i had the same timeout last night', 'check the driver version first'],
              'night-shift': ['that frequency comes back around 2am', 'putting this on the archive if you want it', 'the signal is quieter now'],
            };
            const pool = fallbackPools[room.id] || ['noted — i see what you mean', 'yeah, go on'];
            finalText = pool[hashString(`${room.id}:${responderId}:${responderIndex}`) % pool.length]!;
          }
        }

        // Occasional .local link injection for room replies
        const existingRoomLinks = extractLocalLinks(finalText);
        if (existingRoomLinks.length === 0) {
          const chance = responderId === 'nora' ? 28 : responderId === 'maya' ? 22 : 15;
          if (hashString(`${room.id}:${responderId}:${finalText}`) % 100 < chance) {
            const picked = pickRandomBuddyLink(responderId, totalMinutes + responderIndex);
            if (picked) finalText = `${finalText} ${picked.url}`;
          }
        }

        const botMessage: PulseRoomMessage = {
          id: `room_${Date.now()}_${responderId}_${responderIndex}_${Math.random().toString(36).slice(2, 4)}`,
          senderId: responderId,
          senderName: engine.social.getBuddy(responderId)?.displayName || responderId,
          text: finalText,
          minute: minute + 1 + responderIndex,
        };

        const roomLinks = extractLocalLinks(finalText);
        setPulseState((previous) => {
          const existingShared = previous.sharedLinks || [];
          const existingUrls = new Set(existingShared.map((link) => link.url.toLowerCase()));
          const newLinks: typeof existingShared = [];
          roomLinks.forEach((link) => {
            const lower = link.url.toLowerCase();
            if (existingUrls.has(lower) || newLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
            newLinks.push({
              id: `shared_room_${room.id}_${link.host}_${Date.now()}_${responderIndex}`,
              url: link.url,
              host: link.host,
              title: `${link.host} — shared in ${room.name} by ${responder?.displayName || responderId}`,
              sharedBy: responderId,
              sharedByName: responder?.displayName || responderId,
              minute: botMessage.minute,
              snippet: `Shared in ${room.name} by ${responder?.displayName || responderId}`,
            });
          });
          const mergedShared = [...existingShared, ...newLinks].slice(-30);
          const discoveredSet = new Set(previous.discoveredHosts || []);
          newLinks.forEach((link) => discoveredSet.add(link.host.toLowerCase()));
          const nextMessages = [...(previous.roomMessages[room.id] || []), botMessage].slice(-80);
          return {
            ...previous,
            roomMessages: { ...previous.roomMessages, [room.id]: nextMessages },
            roomReadThrough: { ...previous.roomReadThrough, [room.id]: activeRoomId === room.id ? nextMessages.length : previous.roomReadThrough[room.id] ?? 0 },
            sharedLinks: mergedShared,
            discoveredHosts: Array.from(discoveredSet).slice(0, 30),
          };
        });

        // Update recentMessages to include this reply for the next responder in the same turn
        recentMessages = [...recentMessages, { sender: botMessage.senderName, text: botMessage.text }].slice(-10);
      }
    } finally {
      setRoomTyping(false);
    }
  };

  const handleWhisper = async (targetId: string, text: string) => {
    if (!activeRoomId || !session) return;
    const room = getPulseRoom(activeRoomId);
    if (!room || !room.participantIds.includes(targetId)) return;
    const target = engine.social.getBuddy(targetId);
    const whisper: PulseRoomMessage = { id: `whisper_${Date.now()}`, senderId: 'player', senderName: session.username, text, minute: totalMinutes, kind: 'whisper', targetId };
    setPulseState((previous) => ({ ...previous, roomMessages: { ...previous.roomMessages, [room.id]: [...(previous.roomMessages[room.id] || []), whisper].slice(-80) }, roomReadThrough: { ...previous.roomReadThrough, [room.id]: (previous.roomMessages[room.id]?.length ?? 0) + 1 } }));
    setRoomTyping(true);
    try {
      let whisperWorldKnowledge = '';
      try {
        const eAny = engine as unknown as { world?: { getKnowledgeContextForBuddy: (bid:string, day:number)=>string; getKnowledgeContext: (day:number)=>string } };
        whisperWorldKnowledge = eAny.world?.getKnowledgeContextForBuddy?.(targetId, currentDay) ?? eAny.world?.getKnowledgeContext(currentDay) ?? '';
      } catch {}
      const result = await aiService.generateChat({
        buddyId: `whisper-${room.id}-${targetId}`,
        displayName: target?.displayName || targetId,
        handle: target?.handle || targetId,
        persona: `${getBuddyPersona(targetId, target ?? undefined)} You are receiving a private whisper from the player inside the room "${room.name}". Reply privately in one short line and do not expose the whisper to the room.`,
        relationshipSummary: `Private whisper in ${room.name}.`,
        recentMessages: [{ sender: 'player', text }],
        playerMessage: text,
        worldKnowledge: whisperWorldKnowledge,
        currentDay: currentDay,
      }, loadAISettings());
      const fallback = { senderId: targetId, text: targetId === 'maya' ? 'got it... keeping this between us.' : 'yeah, i see it. whisper me if anything changes.' };
      const replyText = result.meta.fallback ? fallback.text : result.data.messages[0]?.text?.trim();
      if (replyText) {
        const reply: PulseRoomMessage = { id: `whisper_${Date.now()}_reply`, senderId: targetId, senderName: target?.displayName || targetId, text: replyText, minute: totalMinutes + 1, kind: 'whisper' };
        setPulseState((previous) => ({ ...previous, roomMessages: { ...previous.roomMessages, [room.id]: [...(previous.roomMessages[room.id] || []), reply].slice(-80) } }));
      }
    } finally {
      setRoomTyping(false);
    }
  };

  const handleTopicChange = (topic: string) => {
    if (!activeRoomId || !session) return;
    setPulseState((previous) => {
      const systemMessage: PulseRoomMessage = { id: `topic_${Date.now()}`, senderId: 'system', senderName: 'Pulse', text: `${session.username} changed the topic to: ${topic}`, minute: totalMinutes, kind: 'system' };
      const nextMessages = [...(previous.roomMessages[activeRoomId] || []), systemMessage].slice(-80);
      return { ...previous, roomTopics: { ...previous.roomTopics, [activeRoomId]: topic }, roomMessages: { ...previous.roomMessages, [activeRoomId]: nextMessages }, roomReadThrough: { ...previous.roomReadThrough, [activeRoomId]: nextMessages.length } };
    });
  };

  useEffect(() => {
    if (!session || joinedRoomIds.length === 0 || !Number.isFinite(totalMinutes)) return;
    const activityBucket = Math.floor(totalMinutes / 30);
    const pendingRooms = PULSE_ROOMS.filter((room) => joinedRoomIds.includes(room.id) && (pulseState.activityBuckets[room.id] ?? -1) < activityBucket);
    if (pendingRooms.length === 0) return;

    setPulseState((previous) => ({
      ...previous,
      activityBuckets: { ...previous.activityBuckets, ...Object.fromEntries(pendingRooms.map((room) => [room.id, activityBucket])) },
    }));

    pendingRooms.forEach((room) => {
      const existingMessages = pulseState.roomMessages[room.id] || [];
      const ambientCount = hashString(`${room.id}:${activityBucket}`) % 100 < 22 ? 2 : 1;
      const responderSequence = getRoomResponderSequence(room.id, room.participantIds, existingMessages.length + activityBucket, `ambient-${activityBucket}`);
      const selectedResponders = responderSequence.slice(0, ambientCount);
      selectedResponders.forEach((responderId, responderIndex) => {
        const responder = engine.social.getBuddy(responderId);
        const recentMessages = existingMessages.slice(-8).map((message) => ({ sender: message.senderId === 'player' ? 'player' : message.senderName, text: message.text }));
        const ambientStyle = getNpcStyle(responderId);
        let ambientWorldKnowledge = '';
        try {
          const eAny2 = engine as unknown as { world?: { getKnowledgeContextForBuddy: (bid:string, day:number)=>string; getKnowledgeContext: (day:number)=>string } };
          ambientWorldKnowledge = eAny2.world?.getKnowledgeContextForBuddy?.(responderId, currentDay) ?? eAny2.world?.getKnowledgeContext(currentDay) ?? '';
        } catch {}
        void aiService.generateChat({
          buddyId: `room-event-${room.id}-${activityBucket}-${responderIndex}`,
          displayName: responder?.displayName || responderId,
          handle: responder?.handle || responderId,
          persona: `${ambientStyle.persona} You are posting one ambient message in the public room "${room.name}". Room topic: ${roomTopics[room.id] || room.topic}. Do not mention the player or claim that you are an AI.${responderIndex > 0 ? ' Another participant just posted — respond naturally without repeating.' : ''}`,
          relationshipSummary: `Ambient public room event at game minute ${totalMinutes} (#${responderIndex + 1}/${selectedResponders.length}).`,
          recentMessages,
          playerMessage: `Write one short room message that feels like a real participant checking in during game minute ${totalMinutes}.`,
          worldKnowledge: ambientWorldKnowledge,
          currentDay: currentDay,
        }, loadAISettings()).then((result) => {
          const fallbackPools: Record<string, string[]> = {
            'orion-lounge': ['anyone else still awake? the lounge is getting weirdly quiet.', 'lounge is quiet — putting on some music if anyone wants in'],
            'pc-help': ['quick question: is anyone else getting a timeout from the driver mirror?', 'mirror #2 is up but slow — try again in a bit'],
            'night-shift': ['the signal is clear for a minute. putting on something slow.', 'low hum is back — you hear it too?'],
          };
          const pool = fallbackPools[room.id] || ['someone just checked in.'];
          const fallbackText = pool[(hashString(`${room.id}:${activityBucket}:${responderIndex}`) % pool.length)]!;
          const text = result.meta.fallback ? fallbackText : result.data.messages[0]?.text?.trim() || fallbackText;
          if (!text) return;
          let finalText = text;
          const links = extractLocalLinks(finalText);
          if (links.length === 0 && hashString(`${room.id}:${activityBucket}:${responderId}`) % 100 < 18) {
            const picked = pickRandomBuddyLink(responderId, totalMinutes + responderIndex);
            if (picked) finalText = `${finalText} ${picked.url}`;
          }
          const roomLinks = extractLocalLinks(finalText);
          const nextMessage: PulseRoomMessage = {
            id: `room_event_${room.id}_${activityBucket}_${responderIndex}`,
            senderId: responderId,
            senderName: responder?.displayName || responderId,
            text: finalText,
            minute: totalMinutes + responderIndex,
            kind: 'chat',
          };
          setPulseState((previous) => {
            const messages = previous.roomMessages[room.id] || [];
            if (messages.some((message) => message.id === nextMessage.id)) return previous;
            const existingShared = previous.sharedLinks || [];
            const existingUrls = new Set(existingShared.map((link) => link.url.toLowerCase()));
            const newLinks: typeof existingShared = [];
            roomLinks.forEach((link) => {
              const lower = link.url.toLowerCase();
              if (existingUrls.has(lower) || newLinks.some((entry) => entry.url.toLowerCase() === lower)) return;
              newLinks.push({
                id: `shared_room_${room.id}_${link.host}_${Date.now()}_${responderIndex}`,
                url: link.url,
                host: link.host,
                title: `${link.host} — shared in ${room.name} by ${responder?.displayName || responderId}`,
                sharedBy: responderId,
                sharedByName: responder?.displayName || responderId,
                minute: nextMessage.minute,
                snippet: `Shared in ${room.name} by ${responder?.displayName || responderId}`,
              });
            });
            const mergedShared = [...existingShared, ...newLinks].slice(-30);
            const discoveredSet = new Set(previous.discoveredHosts || []);
            newLinks.forEach((link) => discoveredSet.add(link.host.toLowerCase()));
            const nextMessages = [...messages, nextMessage].slice(-80);
            return {
              ...previous,
              roomMessages: { ...previous.roomMessages, [room.id]: nextMessages },
              roomReadThrough: { ...previous.roomReadThrough, [room.id]: activeRoomId === room.id ? nextMessages.length : previous.roomReadThrough[room.id] ?? 0 },
              sharedLinks: mergedShared,
              discoveredHosts: Array.from(discoveredSet).slice(0, 30),
            };
          });
          if (activeRoomId !== room.id) soundManager.play('im_recv');
        }).catch(() => {});
      });
    });
  }, [session, totalMinutes, joinedRoomIds, pulseState.activityBuckets, pulseState.roomMessages, engine, activeRoomId]);

  useEffect(() => {
    if (!activeBuddyId || !session) return;

    const key = `${activeBuddyId}_day${currentDay}`;
    if (triggeredDayScripts.current.has(key)) return;

    const buddyMsgs = conversations[activeBuddyId] || [];
    const hasTodayMsg = buddyMsgs.some((message) => message.day === currentDay);
    if (!hasTodayMsg) {
      const script = DIALOGUE_SCRIPTS.find((item) => item.buddyId === activeBuddyId && item.day === currentDay);
      if (script) {
        triggeredDayScripts.current.add(key);
        const timer = window.setTimeout(() => triggerNpcScript(script), 1200);
        return () => window.clearTimeout(timer);
      }
    }
  }, [activeBuddyId, currentDay, conversations, triggerNpcScript, session]);

  const buddiesMap: Record<string, any> = {};
  engine.social.getBuddies().forEach((buddy) => { buddiesMap[buddy.id] = buddy; });
  const activeRoom = activeRoomId ? getPulseRoom(activeRoomId) : undefined;

  if (!session) return <PulseLoginSplash onLogin={setSession} />;

  const skinClasses = pulseSkin === 'dark' ? 'bg-[#0f1419] text-gray-200' : pulseSkin === 'silver' ? 'bg-[#e8e8e8] text-black' : 'bg-[#ece9d8] text-black';

  return (
    <div className={`relative flex h-full w-full overflow-hidden font-sans text-xs select-none ${skinClasses}`}>
      <div className="flex h-full w-56 shrink-0 flex-col border-r border-gray-400">
        <BuddyListWindow
          username={session.username}
          session={session}
          view={view}
          activeRoomId={activeRoomId}
          joinedRoomIds={joinedRoomIds}
          roomUnreadCounts={roomUnreadCounts}
          friendRequestStatus={friendRequestStatus}
          onOpenChat={handleOpenChat}
          onInspect={setSelectedBuddyId}
          onOpenRoom={handleOpenRoom}
          onViewChange={setView}
          onOpenRequests={() => { setShowFriendRequest(true); soundManager.play('invite'); }}
          onBuzz={() => handleBuzz()}
          onSignOut={() => { setPulseState((previous) => ({ ...previous, lastSeenTotalMinutes: totalMinutes })); deliveredOfflineForSession.current = false; setSession(null); setActiveRoomId(null); setView('contacts'); }}
          unreadCounts={unreadCounts}
          activityFeed={pulseState.activityFeed}
          blockedBuddyIds={pulseState.blockedBuddyIds}
          groupLabels={pulseState.groupLabels}
          groupOrder={pulseState.groupOrder}
          onBlockBuddy={handleBlockBuddy}
          onUnblockBuddy={handleUnblockBuddy}
          onRemoveBuddy={handleRemoveBuddy}
          onInviteBuddyToRoom={handleInvite}
          onRenameGroup={handleRenameGroup}
          onReorderGroup={handleReorderGroup}
          currentSlotId={currentSlotId}
          onSwitchSlot={handleSwitchSlot}
          pulseSkin={pulseSkin}
          onChangeSkin={handleChangeSkin}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {view === 'rooms' && activeRoom ? (
          <PulseRoomWindow
            room={activeRoom}
            messages={roomMessages[activeRoom.id] || []}
            participantNames={Object.fromEntries(engine.social.getBuddies().map((buddy) => [buddy.id, buddy.displayName]))}
            username={session.username}
            topic={roomTopics[activeRoom.id] || activeRoom.topic}
            isTyping={roomTyping}
            isJoined={joinedRoomIds.includes(activeRoom.id)}
            onSend={handleSendRoomMessage}
            onWhisper={handleWhisper}
            onTopicChange={handleTopicChange}
            onJoin={() => handleOpenRoom(activeRoom.id)}
            onLeave={() => {
              setPulseState((previous) => {
                const leaveMessage: PulseRoomMessage = { id: `room_leave_${activeRoom.id}_${Date.now()}`, senderId: 'system', senderName: 'Pulse', text: `you left ${activeRoom.name}.`, minute: totalMinutes, kind: 'system' };
                const nextMessages = [...(previous.roomMessages[activeRoom.id] || []), leaveMessage].slice(-80);
                return { ...previous, joinedRoomIds: previous.joinedRoomIds.filter((id) => id !== activeRoom.id), roomMessages: { ...previous.roomMessages, [activeRoom.id]: nextMessages }, roomReadThrough: { ...previous.roomReadThrough, [activeRoom.id]: nextMessages.length } };
              });
              setActiveRoomId(null);
              setView('rooms');
            }}
          />
        ) : (
          <ChatWindow
            openBuddyIds={openBuddyIds}
            activeBuddyId={activeBuddyId}
            buddies={buddiesMap}
            conversations={conversations}
            unreadCounts={unreadCounts}
            typingIndicatorText={typingState.activeBuddyId === activeBuddyId ? typingState.typingIndicatorText : undefined}
            availableChoices={typingState.activeBuddyId === activeBuddyId ? typingState.availableChoices : []}
            playerTypingText={playerTypingText}
            isPlayerTyping={isPlayerTyping}
            onSelectTab={setActiveBuddyId}
            onCloseTab={handleCloseTab}
            onSendMessage={handleSendMessage}
            onBuzz={() => handleBuzz()}
            onSelectChoice={selectPlayerChoice}
          />
        )}
      </div>

      {showFriendRequest && <>
        <div className="absolute inset-0 z-40 bg-black/20" onClick={() => setShowFriendRequest(false)} />
        <PulseFriendRequest onAccept={handleAcceptFriendRequest} onIgnore={() => setShowFriendRequest(false)} onClose={() => setShowFriendRequest(false)} />
      </>}
      {selectedBuddyId && buddiesMap[selectedBuddyId] && (
        <PulseProfileCard
          buddy={buddiesMap[selectedBuddyId]}
          presence={engine.social.getPresence(selectedBuddyId) || { status: 'offline', awayMessage: '' }}
          relationship={engine.social.getRelationships(selectedBuddyId)}
          rooms={PULSE_ROOMS}
          onClose={() => setSelectedBuddyId(null)}
          onChat={() => handleOpenChat(selectedBuddyId)}
          onBuzz={handleBuzz}
          onInvite={(roomId) => handleInvite(selectedBuddyId, roomId)}
          awayHistory={pulseState.awayHistory[selectedBuddyId] || pulseState.activityFeed.filter((entry) => entry.buddyId === selectedBuddyId && entry.kind === 'away')}

        />
      )}
      {buzzActive && <div className="pointer-events-none absolute inset-0 z-40 animate-[pulse_0.16s_ease-in-out_4] border-4 border-[#f4c542]" />}
      {inviteNotice && <div className="absolute bottom-10 right-3 z-40 border-2 border-[#38516e] bg-[#fff7c7] px-3 py-2 text-xs font-bold text-[#4d3c00] shadow-[3px_3px_0_rgba(0,0,0,0.25)]">{inviteNotice}</div>}
      {activeToasts.map((toast) => <PulseNotificationToast key={toast.id} toast={toast} onDismiss={dismissToast} onOpenChat={handleOpenChat} />)}
    </div>
  );
};
