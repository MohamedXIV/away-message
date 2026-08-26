import React from 'react';
import { DialogueChoiceOption } from '../types';

interface AuthoredResponseMenuProps {
  choices: DialogueChoiceOption[];
  onSelectChoice: (choice: DialogueChoiceOption) => void;
}

export const AuthoredResponseMenu: React.FC<AuthoredResponseMenuProps> = ({
  choices,
  onSelectChoice,
}) => {
  if (!choices || choices.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-t border-b border-yellow-300 p-2 space-y-1.5 shadow-inner">
      <span className="text-[10px] font-bold text-yellow-900 uppercase tracking-wide block">
        Choose Your Response:
      </span>
      <div className="grid grid-cols-1 gap-1.5">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onSelectChoice(choice)}
            className="text-left px-2.5 py-1.5 bg-white hover:bg-yellow-100 border border-yellow-400 rounded text-xs font-semibold text-blue-950 shadow-xs cursor-pointer transition-colors"
          >
            💬 {choice.text}
          </button>
        ))}
      </div>
    </div>
  );
};
