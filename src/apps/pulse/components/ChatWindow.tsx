import React, { useEffect, useState } from 'react';
import type { SimulationPulseContact } from '../../../engine/kernel/SimulationPublication';
import { useConversationRead } from '../../../store/useBoundedSimulationRead';
import { useConversationPage } from '../hooks/useConversationPage';
import { ChatTabHeader } from './ChatTabHeader';
import { MessageHistoryView } from './MessageHistoryView';
import { MessageInputBar } from './MessageInputBar';
import { AuthoredResponseMenu } from './AuthoredResponseMenu';
import { ReplyChips } from './ReplyChips';
import { useReplySuggestions, type ReplySuggestionItem } from '../hooks/useReplySuggestions';
import { DialogueChoiceOption } from '../types';

interface ChatWindowProps {
  openBuddyIds: string[];
  activeBuddyId: string | null;
  buddies: Record<string, SimulationPulseContact>;
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
  /** AI reply suggestions for the player (P8/B2, tone + battery enriched). Null = feature off. */
  suggestionFetcher?: ((buddyId: string) => Promise<ReplySuggestionItem[]>) | null;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  openBuddyIds,
  activeBuddyId,
  buddies,
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
  const [pageOffset, setPageOffset] = useState(0);
  const { suggestions, loading: suggestionsLoading, refresh: refreshSuggestions, clear: clearSuggestions } = useReplySuggestions();

  // 50-message slices from canonical Social authority; never hand React a
  // complete conversation map. Suggestions always use the newest messages,
  // even when the player browses older pages.
  const { page, error: pageError, loading: pageLoading, retry: retryPage } =
    useConversationPage(activeBuddyId ?? '', pageOffset, 50);
  const latest = useConversationRead(activeBuddyId ?? '', 0, 8);
  const activeMessages = page?.messages ?? [];
  const lastNpcMessage = [...latest.messages].reverse().find((m) => m.senderId !== 'player') || null;

  // Fetch fresh suggestions whenever a new NPC reply lands (or tab/refresh changes)
  useEffect(() => {
    if (!suggestionFetcher || !activeBuddyId || !lastNpcMessage || isPlayerTyping) return;
    const buddyId = activeBuddyId;
    const key = `${buddyId}:${lastNpcMessage.id}:${refreshCount}`;
    void refreshSuggestions(key, () => suggestionFetcher(buddyId));
  }, [suggestionFetcher, activeBuddyId, lastNpcMessage?.id, refreshCount, isPlayerTyping, refreshSuggestions]);

  useEffect(() => {
    setPageOffset(0);
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-300 bg-[#ece9d8] px-2 py-1 text-[10px] text-gray-700">
          <span>{pageLoading ? 'Loading messages…' : pageError ? 'Conversation unavailable' : !page || page.total === 0 ? 'No messages' : `${Math.max(1, page.total - pageOffset - activeMessages.length + 1)}–${Math.max(0, page.total - pageOffset)} of ${page.total} messages`}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!page || pageLoading || !!pageError || !page.hasOlder} onClick={() => setPageOffset(offset => offset + 50)}
              className="rounded border border-gray-400 px-1.5 py-0.5 disabled:opacity-40">← Older</button>
            <button type="button" disabled={pageLoading || pageOffset === 0} onClick={() => setPageOffset(offset => Math.max(0, offset - 50))}
              className="rounded border border-gray-400 px-1.5 py-0.5 disabled:opacity-40">Newer →</button>
          </div>
        </div>
        {pageError ? (
          <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 text-red-700">
            <span>{pageError} The saved history was not modified.</span>
            <button type="button" onClick={retryPage} className="rounded border border-gray-400 px-3 py-1 text-gray-800">Retry</button>
          </div>
        ) : pageLoading ? (
          <div role="status" className="flex flex-1 items-center justify-center text-gray-500">Loading conversation…</div>
        ) : (
          <MessageHistoryView messages={activeMessages} totalMessages={page?.total ?? 0} buddy={activeBuddy as SimulationPulseContact} />
        )}

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
