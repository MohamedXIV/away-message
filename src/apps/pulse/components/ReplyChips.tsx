import React from 'react';

interface ReplyChipsProps {
  suggestions: string[];
  loading: boolean;
  disabled?: boolean;
  onPick: (text: string) => void;
  onRefresh: () => void;
}

/**
 * AI-suggested quick replies for the player (P8/B2). Chips fill the input
 * for editing — they never send on their own.
 */
export const ReplyChips: React.FC<ReplyChipsProps> = ({
  suggestions,
  loading,
  disabled = false,
  onPick,
  onRefresh,
}) => {
  if (!loading && suggestions.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 overflow-x-auto">
      <span className="shrink-0 text-[10px] font-bold text-purple-900">✨</span>
      {loading && suggestions.length === 0 ? (
        <span className="text-[10px] italic text-gray-500 animate-pulse">thinking of what you could say…</span>
      ) : (
        suggestions.map((suggestion, index) => (
          <button
            key={`${index}-${suggestion.slice(0, 24)}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            title="Fill the input (editable — never auto-sends)"
            className="shrink-0 max-w-[220px] truncate rounded-full border border-purple-400 bg-purple-50 px-2.5 py-1 text-[11px] text-purple-950 hover:bg-purple-100 disabled:opacity-50 text-left"
          >
            {suggestion}
          </button>
        ))
      )}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onRefresh}
        title="Suggest different replies"
        className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-1 text-[11px] hover:bg-gray-50 disabled:opacity-50"
      >
        ⟳
      </button>
    </div>
  );
};
