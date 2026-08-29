import React from 'react';
import { BuddyCharacter, MessageRecord } from '../../../engine/types';
import { ChatTabHeader } from './ChatTabHeader';
import { MessageHistoryView } from './MessageHistoryView';
import { MessageInputBar } from './MessageInputBar';
import { AuthoredResponseMenu } from './AuthoredResponseMenu';
import { DialogueChoiceOption } from '../types';

interface ChatWindowProps {
  openBuddyIds: string[];
  activeBuddyId: string | null;
  buddies: Record<string, BuddyCharacter>;
  conversations: Record<string, MessageRecord[]>;
  unreadCounts: Record<string, number>;
  typingIndicatorText?: string;
  availableChoices?: DialogueChoiceOption[];
  playerTypingText?: string;
  isPlayerTyping?: boolean;
  onSelectTab: (buddyId: string) => void;
  onCloseTab: (buddyId: string) => void;
  onSendMessage: (buddyId: string, text: string) => void;
  onBuzz?: (buddyId: string) => void;
  onSelectChoice: (choice: DialogueChoiceOption, buddyId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  openBuddyIds,
  activeBuddyId,
  buddies,
  conversations,
  unreadCounts,
  typingIndicatorText,
  availableChoices = [],
  playerTypingText = '',
  isPlayerTyping = false,
  onSelectTab,
  onCloseTab,
  onSendMessage,
  onBuzz,
  onSelectChoice,
}) => {
  if (!activeBuddyId || openBuddyIds.length === 0) {
    return (
      <div className="flex-1 bg-[#ece9d8] flex items-center justify-center p-6 text-gray-500 text-xs italic">
        Double click any buddy on your contact list to open a chat.
      </div>
    );
  }

  const activeBuddy = buddies[activeBuddyId] || {
    id: activeBuddyId,
    displayName: activeBuddyId,
    handle: activeBuddyId,
  };
  const activeMessages = conversations[activeBuddyId] || [];

  return (
    <div className="flex-1 flex flex-col bg-[#ece9d8] border border-gray-400 overflow-hidden">
      <ChatTabHeader
        openBuddyIds={openBuddyIds}
        activeBuddyId={activeBuddyId}
        buddies={buddies}
        unreadCounts={unreadCounts}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
      />

      <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-white">
        <MessageHistoryView messages={activeMessages} buddy={activeBuddy as any} />

        {typingIndicatorText && (
          <div className="text-[11px] text-blue-700 italic px-2 animate-pulse">
            ✍️ {typingIndicatorText}
          </div>
        )}

        {availableChoices.length > 0 && (
          <AuthoredResponseMenu
            choices={availableChoices}
            onSelectChoice={(choice) => onSelectChoice(choice, activeBuddyId)}
          />
        )}
      </div>

      <MessageInputBar
        onSendMessage={(text) => onSendMessage(activeBuddyId, text)}
        onBuzz={() => onBuzz?.(activeBuddyId)}
        playerTypingText={playerTypingText}
        isPlayerTyping={isPlayerTyping}
      />
    </div>
  );
};
