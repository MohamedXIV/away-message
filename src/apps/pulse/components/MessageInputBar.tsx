import React, { useState } from 'react';

interface MessageInputBarProps {
  onSendMessage: (text: string) => void;
  playerTypingText?: string;
  isPlayerTyping?: boolean;
}

export const MessageInputBar: React.FC<MessageInputBarProps> = ({
  onSendMessage,
  playerTypingText = '',
  isPlayerTyping = false,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center bg-[#ece9d8] p-1.5 border-t border-gray-300">
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
