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
import { loadPulseState, savePulseState, type PulsePersistedState } from './persistence';
import type { PulseActivityEntry } from './types';

function getBuddyPersona(buddyId: string): string {
  const personas: Record<string, string> = {
    ryan: 'Warm, impulsive food-cart coworker. Uses casual slang, jokes, and short messages. He avoids heavy emotional talks unless trust is high.',
    maya: 'Quiet, observant, creative, and a little guarded. Uses lowercase, pauses, music references, and gentle honesty. She warms up slowly.',
    nora: 'Night-owl archivist with dry humor. Curious about strange details, concise, slightly cryptic, but not supernatural.',
    henderson: 'Professional motel manager. Formal, practical, and terse. He cares about rent, schedules, and keeping the property calm.',
  };
  return personas[buddyId] || 'A believable online friend with a distinct but grounded personality.';
}

function getNpcMood(status: string, relationship?: { trust: number; comfort: number; annoyance: number }): string {
  if (status === 'offline') return 'unavailable and likely tired';
  if (status === 'away') return 'distracted but reachable';
  if ((relationship?.annoyance ?? 0) > 45) return 'slightly irritated';
  if ((relationship?.comfort ?? 0) > 65) return 'relaxed and familiar';
  return 'neutral and present';
}

function getRoomReply(roomId: string): { senderId: string; text: string } {
  if (roomId === 'pc-help') return { senderId: 'ryan', text: 'drop the specs and someone will probably have a mirror link' };
  if (roomId === 'night-shift') return { senderId: 'maya', text: 'hold on... i have a track for exactly that mood' };
  return { senderId: 'nora', text: 'hello, new arrival. please observe the room etiquette.' };
}

function getRoomResponderId(roomId: string, participantIds: string[], messageCount: number): string {
  if (participantIds.length === 0) return 'nora';
  const offset = roomId.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return participantIds[(offset + messageCount) % participantIds.length] ?? participantIds[0] ?? 'nora';
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
  const [pulseState, setPulseState] = useState<PulsePersistedState>(() => loadPulseState());
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

  const { joinedRoomIds, roomMessages, roomTopics, friendRequestStatus } = pulseState;

  useEffect(() => {
    savePulseState(pulseState);
  }, [pulseState]);

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
      setPulseState((previous) => ({ ...previous, activityFeed: [...previous.activityFeed, ...changes].slice(-60) }));
    }
  }, [engine, presenceMap, session, totalMinutes]);

  useEffect(() => {
    if (!session || deliveredOfflineForSession.current || !Number.isFinite(totalMinutes)) return;
    deliveredOfflineForSession.current = true;
    const elapsed = totalMinutes - pulseState.lastSeenTotalMinutes;
    const nextActivities: PulseActivityEntry[] = [];
    if (elapsed >= 45) {
      const offlineLines: Record<string, string> = {
        maya: 'hey... sorry i missed you. i was away from the desk. what did i miss?',
        ryan: 'yo, leaving this here before i crash. we still on for later?',
        nora: 'you were offline. i found an interesting link and bookmarked it for you.',
        henderson: 'Please contact the office regarding your account when convenient.',
      };
      engine.social.getBuddies().forEach((buddy) => {
        const text = offlineLines[buddy.id];
        if (!text) return;
        engine.dispatchAction({ type: 'SOCIAL_RECEIVE_MESSAGE', buddyId: buddy.id, text, timestampMinute: Math.max(pulseState.lastSeenTotalMinutes + 15, totalMinutes - 20), deliveredAway: true, tags: ['offline-message'] });
        nextActivities.push({ id: `offline_${buddy.id}_${totalMinutes}`, buddyId: buddy.id, kind: 'message', text: `${buddy.displayName} left you an offline message.`, minute: totalMinutes, createdAt: Date.now(), isRead: false });
      });
    }
    setPulseState((previous) => ({ ...previous, lastSeenTotalMinutes: totalMinutes, activityFeed: [...previous.activityFeed, ...nextActivities].slice(-60) }));
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

  const handleCloseTab = (buddyId: string) => {
    const nextTabs = openBuddyIds.filter((id) => id !== buddyId);
    setOpenBuddyIds(nextTabs);
    if (activeBuddyId === buddyId) setActiveBuddyId(nextTabs[0] || '');
  };

  const handleSendMessage = async (buddyId: string, text: string) => {
    engine.dispatchAction({ type: 'SOCIAL_SEND_MESSAGE', buddyId, text });

    const buddy = engine.social.getBuddy(buddyId);
    const relationship = engine.social.getRelationships(buddyId);
    const presence = engine.social.getPresence(buddyId);
    const mood = getNpcMood(presence?.status || 'offline', relationship);
    const activity = presence?.awayMessage || (presence?.status === 'online' ? 'online and checking messages' : 'offline');
    const memory = pulseState.conversationMemory[buddyId] || [];
    setPulseState((previous) => ({
      ...previous,
      conversationMemory: { ...previous.conversationMemory, [buddyId]: [...(previous.conversationMemory[buddyId] || []), `Player said: ${text}`].slice(-6) },
      npcMood: { ...previous.npcMood, [buddyId]: mood },
      npcActivity: { ...previous.npcActivity, [buddyId]: activity },
    }));
    const recentMessages = engine.social.getMessages(buddyId).slice(-8).map((message) => ({
      sender: message.senderId === 'player' ? 'player' : 'buddy',
      text: message.text,
    }));

    const result = await aiService.generateChat({
      buddyId,
      displayName: buddy?.displayName || buddyId,
      handle: buddy?.handle || buddyId,
      persona: getBuddyPersona(buddyId),
      relationshipSummary: `${relationship ? JSON.stringify(relationship) : 'new friendship'} Mood: ${mood}. Current activity: ${activity}. Memory: ${memory.join(' | ') || 'No prior remembered details.'}`,
      recentMessages,
      playerMessage: text,
    }, loadAISettings());

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

    const responderId = getRoomResponderId(room.id, room.participantIds, existingMessages.length);
    const responder = engine.social.getBuddy(responderId);
    const roomTopic = roomTopics[room.id] || room.topic;
    const recentMessages = [...existingMessages, playerMessage].slice(-10).map((message) => ({
      sender: message.senderId === 'player' ? 'player' : message.senderName,
      text: message.text,
    }));

    try {
      const result = await aiService.generateChat({
        buddyId: `room-${room.id}-${responderId}`,
        displayName: responder?.displayName || responderId,
        handle: responder?.handle || responderId,
        persona: `${getBuddyPersona(responderId)} You are replying inside the group room "${room.name}". Room topic: ${roomTopic}. Keep the reply conversational and aware that other participants are present.`,
        relationshipSummary: `Group room: ${room.name}. Participants: ${room.participantIds.join(', ')}.`,
        recentMessages,
        playerMessage: text,
      }, loadAISettings());
      const generatedText = result.data.messages[0]?.text?.trim();
      const fallback = getRoomReply(room.id);
      const reply = result.meta.fallback || !generatedText ? fallback : { senderId: responderId, text: generatedText };
      const botMessage: PulseRoomMessage = { id: `room_${Date.now()}_reply`, senderId: reply.senderId, senderName: engine.social.getBuddy(reply.senderId)?.displayName || reply.senderId, text: reply.text, minute: minute + 1 };
      setPulseState((previous) => ({ ...previous, roomMessages: { ...previous.roomMessages, [room.id]: [...(previous.roomMessages[room.id] || []), botMessage].slice(-80) } }));
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
      const result = await aiService.generateChat({
        buddyId: `whisper-${room.id}-${targetId}`,
        displayName: target?.displayName || targetId,
        handle: target?.handle || targetId,
        persona: `${getBuddyPersona(targetId)} You are receiving a private whisper from the player inside the room "${room.name}". Reply privately in one short line and do not expose the whisper to the room.`,
        relationshipSummary: `Private whisper in ${room.name}.`,
        recentMessages: [{ sender: 'player', text }],
        playerMessage: text,
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
      const responderId = getRoomResponderId(room.id, room.participantIds, existingMessages.length + activityBucket);
      const responder = engine.social.getBuddy(responderId);
      const recentMessages = existingMessages.slice(-8).map((message) => ({ sender: message.senderId === 'player' ? 'player' : message.senderName, text: message.text }));
      void aiService.generateChat({
        buddyId: `room-event-${room.id}-${activityBucket}`,
        displayName: responder?.displayName || responderId,
        handle: responder?.handle || responderId,
        persona: `${getBuddyPersona(responderId)} You are posting one ambient message in the public room "${room.name}". Room topic: ${roomTopics[room.id] || room.topic}. Do not mention the player or claim that you are an AI.`,
        relationshipSummary: `Ambient public room event at game minute ${totalMinutes}.`,
        recentMessages,
        playerMessage: `Write one short room message that feels like a real participant checking in during game minute ${totalMinutes}.`,
      }, loadAISettings()).then((result) => {
        const fallbackLines: Record<string, string> = {
          'orion-lounge': 'anyone else still awake? the lounge is getting weirdly quiet.',
          'pc-help': 'quick question: is anyone else getting a timeout from the driver mirror?',
          'night-shift': 'the signal is clear for a minute. putting on something slow.',
        };
        const text = result.meta.fallback ? (fallbackLines[room.id] || 'someone just checked in.') : result.data.messages[0]?.text?.trim();
        if (!text) return;
        const nextMessage: PulseRoomMessage = { id: `room_event_${room.id}_${activityBucket}`, senderId: result.meta.fallback ? responderId : responderId, senderName: responder?.displayName || responderId, text, minute: totalMinutes, kind: 'chat' };
        setPulseState((previous) => {
          const messages = previous.roomMessages[room.id] || [];
          if (messages.some((message) => message.id === nextMessage.id)) return previous;
          const nextMessages = [...messages, nextMessage].slice(-80);
          return {
            ...previous,
            roomMessages: { ...previous.roomMessages, [room.id]: nextMessages },
            roomReadThrough: { ...previous.roomReadThrough, [room.id]: activeRoomId === room.id ? nextMessages.length : previous.roomReadThrough[room.id] ?? 0 },
          };
        });
        if (activeRoomId !== room.id) soundManager.play('im_recv');
      }).catch(() => {});
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

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#ece9d8] font-sans text-xs text-black select-none">
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
            awayHistory={pulseState.activityFeed.filter((entry) => entry.buddyId === selectedBuddyId && entry.kind === 'away')}

        />
      )}
      {buzzActive && <div className="pointer-events-none absolute inset-0 z-40 animate-[pulse_0.16s_ease-in-out_4] border-4 border-[#f4c542]" />}
      {inviteNotice && <div className="absolute bottom-10 right-3 z-40 border-2 border-[#38516e] bg-[#fff7c7] px-3 py-2 text-xs font-bold text-[#4d3c00] shadow-[3px_3px_0_rgba(0,0,0,0.25)]">{inviteNotice}</div>}
      {activeToasts.map((toast) => <PulseNotificationToast key={toast.id} toast={toast} onDismiss={dismissToast} onOpenChat={handleOpenChat} />)}
    </div>
  );
};
