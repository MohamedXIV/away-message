import React, { useState } from 'react';

import { EmoticonPalette } from './EmoticonPalette';

interface MessageInputBarProps {
  onSendMessage: (text: string) => void;
  onBuzz?: () => void;
  playerTypingText?: string;
  isPlayerTyping?: boolean;
}

export const MessageInputBar: React.FC<MessageInputBarProps> = ({
  onSendMessage,
  onBuzz,
  playerTypingText = '',
  isPlayerTyping = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center gap-1.5 border-t border-gray-300 bg-[#ece9d8] p-1.5">
      <button type="button" onClick={() => setIsPaletteOpen((open) => !open)} disabled={isPlayerTyping} className="border border-gray-400 bg-white px-1.5 py-1 text-sm hover:bg-blue-50 disabled:opacity-50" title="Emoticons">:)</button>
      <button type="button" onClick={() => onBuzz?.()} disabled={isPlayerTyping} className="border border-[#8b6b2d] bg-[#f5e0a4] px-1.5 py-1 text-[10px] font-bold hover:bg-[#f0d183] disabled:opacity-50" title="Send a Buzz">Buzz</button>
      <EmoticonPalette isOpen={isPaletteOpen && !isPlayerTyping} onSelectEmoticon={(code) => setInputText((current) => `${current}${current ? ' ' : ''}${code}`)} onClose={() => setIsPaletteOpen(false)} />
      <input
        type="text"
        value={isPlayerTyping ? playerTypingText : inputText}
        onChange={(e) => setInputText(e.target.value)}
        disabled={isPlayerTyping}
        placeholder={isPlayerTyping ? 'Typing chosen response...' : 'Type a message (or select an authored choice above)...'}
        className="flex-1 px-2.5 py-1 bg-white border border-gray-400 rounded text-xs outline-none shadow-inner font-sans disabled:bg-gray-100"
      />
      <button
        type="submit"
        disabled={isPlayerTyping || !inputText.trim()}
        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded shadow cursor-pointer text-xs"
      >
        Send
      </button>
    </form>
  );
};
