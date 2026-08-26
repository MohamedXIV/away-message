import React, { useEffect, useRef } from 'react';
import { MessageRecord, BuddyCharacter } from '../../../engine/types';
import { renderEmoticonNodes } from '../utils/emoticonParser';
import { formatSimulationMinutes } from '../utils/timeFormat';
import { useSimulationStore } from '../../../store/useSimulationStore';

interface MessageHistoryViewProps {
  messages: MessageRecord[];
  buddy: BuddyCharacter;
}

export const MessageHistoryView: React.FC<MessageHistoryViewProps> = ({ messages, buddy }) => {
  const isOrion60 = useSimulationStore((s) => s.state.hardware.osVersion === 'Orion_6.0');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-3 bg-white border border-gray-300 rounded font-sans text-xs space-y-2 select-text"
    >
      {messages.length === 0 ? (
        <div className="text-gray-400 italic text-center py-6">
          --- Conversation started with {buddy.displayName} ({buddy.handle}) ---
        </div>
      ) : (
        messages.map((msg) => {
          const isPlayer = msg.senderId === 'player';
          const senderName = isPlayer ? 'wanderer06' : buddy.displayName;
          const senderColor = isPlayer ? '#000080' : '#800080';

          return (
            <div key={msg.id} className="leading-relaxed">
              <span className="text-[10px] text-gray-500 font-mono mr-1.5">
                ({formatSimulationMinutes(msg.timestampMinute)})
              </span>
              <span
                style={{ color: senderColor }}
                className="font-bold mr-1.5"
              >
                {senderName}:
              </span>
              <span className="text-gray-900">
                {renderEmoticonNodes(msg.text, isOrion60)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

