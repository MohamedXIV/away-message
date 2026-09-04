import React, { useEffect, useState } from 'react';
import { BuddyCharacter, MessageRecord } from '../../../engine/types';
import { ChatTabHeader } from './ChatTabHeader';
import { MessageHistoryView } from './MessageHistoryView';
import { MessageInputBar } from './MessageInputBar';
import { AuthoredResponseMenu } from './AuthoredResponseMenu';
import { ReplyChips } from './ReplyChips';
import { useReplySuggestions } from '../hooks/useReplySuggestions';
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
  /** AI reply suggestions for the player (P8/B2). Null = feature off. */
  suggestionFetcher?: ((buddyId: string) => Promise<string[]>) | null;
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
  suggestionFetcher = null,
}) => {
  const [injectedSuggestion, setInjectedSuggestion] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const { suggestions, loading: suggestionsLoading, refresh: refreshSuggestions, clear: clearSuggestions } = useReplySuggestions();

  const activeMessages = activeBuddyId ? conversations[activeBuddyId] || [] : [];
  const lastNpcMessage = [...activeMessages].reverse().find((m) => m.senderId !== 'player') || null;

  // Fetch fresh suggestions whenever a new NPC reply lands (or tab/refresh changes)
  useEffect(() => {
    if (!suggestionFetcher || !activeBuddyId || !lastNpcMessage || isPlayerTyping) return;
    const buddyId = activeBuddyId;
    const key = `${buddyId}:${lastNpcMessage.id}:${refreshCount}`;
    void refreshSuggestions(key, () => suggestionFetcher(buddyId));
  }, [suggestionFetcher, activeBuddyId, lastNpcMessage?.id, refreshCount, isPlayerTyping, refreshSuggestions]);

  useEffect(() => {
    clearSuggestions();
    setInjectedSuggestion(null);
    setRefreshCount(0);
  }, [activeBuddyId, clearSuggestions]);
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
  const showChips = !!suggestionFetcher && !!activeBuddyId && !isPlayerTyping;

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

      {showChips && (
        <ReplyChips
          suggestions={suggestions}
          loading={suggestionsLoading}
          disabled={isPlayerTyping}
          onPick={(text) => setInjectedSuggestion(text)}
          onRefresh={() => setRefreshCount((count) => count + 1)}
        />
      )}
      <MessageInputBar
        onSendMessage={(text) => onSendMessage(activeBuddyId, text)}
        onBuzz={() => onBuzz?.(activeBuddyId)}
        playerTypingText={playerTypingText}
        isPlayerTyping={isPlayerTyping}
        pendingSuggestion={injectedSuggestion}
        onSuggestionUsed={() => setInjectedSuggestion(null)}
      />
    </div>
  );
};
