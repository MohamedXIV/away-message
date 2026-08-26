import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { BuddyListWindow } from './components/BuddyListWindow';
import { ChatWindow } from './components/ChatWindow';
import { usePulseAudio } from './hooks/usePulseAudio';
import { useSimulatedTyping } from './hooks/useSimulatedTyping';
import { usePulseNotifications } from './hooks/usePulseNotifications';
import { PulseNotificationToast } from './components/PulseNotificationToast';
import { DIALOGUE_SCRIPTS } from './data/dialogueTrees';

export const PulseMessengerApp: React.FC = () => {
  const engine = useSimulationStore((s) => s.engine);
  const conversations = useSimulationStore((s) => s.state.social.conversations);
  const currentDay = useSimulationStore((s) => s.state.time.day);

  usePulseAudio();

  const [openBuddyIds, setOpenBuddyIds] = useState<string[]>(['maya']);
  const [activeBuddyId, setActiveBuddyId] = useState<string>('maya');
  const triggeredDayScripts = useRef<Set<string>>(new Set());

  const {
    typingState,
    playerTypingText,
    isPlayerTyping,
    triggerNpcScript,
    selectPlayerChoice,
  } = useSimulatedTyping(activeBuddyId);

  const { activeToasts, dismissToast } = usePulseNotifications(activeBuddyId);

  const unreadCounts: Record<string, number> = {};
  Object.entries(conversations).forEach(([buddyId, msgs]) => {
    const unreads = msgs.filter((m) => !m.isRead && m.senderId !== 'player').length;
    if (unreads > 0) unreadCounts[buddyId] = unreads;
  });

  const handleOpenChat = (buddyId: string) => {
    if (!openBuddyIds.includes(buddyId)) {
      setOpenBuddyIds([...openBuddyIds, buddyId]);
    }
    setActiveBuddyId(buddyId);
    engine.social.markAsRead(buddyId);
  };

  const handleCloseTab = (buddyId: string) => {
    const nextTabs = openBuddyIds.filter((id) => id !== buddyId);
    setOpenBuddyIds(nextTabs);
    if (activeBuddyId === buddyId) {
      setActiveBuddyId(nextTabs[0] || '');
    }
  };

  const handleSendMessage = (buddyId: string, text: string) => {
    engine.dispatchAction({
      type: 'SOCIAL_SEND_MESSAGE',
      buddyId,
      text,
    });
  };

  useEffect(() => {
    if (!activeBuddyId) return;

    const key = `${activeBuddyId}_day${currentDay}`;
    if (triggeredDayScripts.current.has(key)) return;

    const buddyMsgs = conversations[activeBuddyId] || [];
    const hasTodayMsg = buddyMsgs.some((m) => m.day === currentDay);

    if (!hasTodayMsg) {
      const script = DIALOGUE_SCRIPTS.find(
        (s) => s.buddyId === activeBuddyId && s.day === currentDay
      );
      if (script) {
        triggeredDayScripts.current.add(key);
        const timer = setTimeout(() => triggerNpcScript(script), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [activeBuddyId, currentDay, conversations, triggerNpcScript]);

  const buddiesMap: Record<string, any> = {};
  engine.social.getBuddies().forEach((b) => {
    buddiesMap[b.id] = b;
  });

  return (
    <div className="w-full h-full flex bg-[#ece9d8] text-black font-sans text-xs select-none overflow-hidden relative">
      <div className="w-56 shrink-0 h-full border-r border-gray-400 flex flex-col">
        <BuddyListWindow
          onOpenChat={handleOpenChat}
          unreadCounts={unreadCounts}
        />
      </div>

      <div className="flex-1 h-full flex flex-col">
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
          onSelectChoice={selectPlayerChoice}
        />
      </div>

      {activeToasts.map((toast) => (
        <PulseNotificationToast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onOpenChat={handleOpenChat}
        />
      ))}
    </div>
  );
};
