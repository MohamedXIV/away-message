import React from 'react';
import type { ReplySuggestionItem } from '../hooks/useReplySuggestions';

interface ReplyChipsProps {
  suggestions: ReplySuggestionItem[];
  loading: boolean;
  disabled?: boolean;
  onPick: (text: string) => void;
  onRefresh: () => void;
}

/**
 * AI-suggested quick replies for the player (P8/B2). Chips fill the input
 * for editing — they never send on their own.
 * Colour-coded by rules tone (normal / warm green / romantic pink scale /
 * cold blue) with the approximate battery price on each chip.
 */
/** Exported for tests: tone → colour family (hotter degree = stronger treatment). */
export function chipToneClasses(tone: ReplySuggestionItem['tone'], degree: number): string {
  const base = 'shrink-0 max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[11px] hover:brightness-95 disabled:opacity-50 text-left';
  switch (tone) {
    case 'warm':
      return `${base} border-green-500 bg-green-50 text-green-950`;
    case 'flirty':
      return degree >= 2
        ? `${base} border-pink-600 bg-pink-100 text-pink-950 font-semibold`
        : `${base} border-pink-400 bg-pink-50 text-pink-950`;
    case 'hot':
      return `${base} border-rose-600 bg-rose-100 text-rose-950 font-semibold`;
    case 'cold':
      return degree >= 2
        ? `${base} border-sky-700 bg-sky-100 text-sky-950 font-semibold`
        : `${base} border-sky-500 bg-sky-50 text-sky-950`;
    default:
      return `${base} border-purple-400 bg-purple-50 text-purple-950`;
  }
}

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
            key={`${index}-${suggestion.text.slice(0, 24)}`}
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion.text)}
            title={`Fill the input (editable — never auto-sends) • costs ~${suggestion.cost} battery`}
            className={chipToneClasses(suggestion.tone, suggestion.degree)}
          >
            {suggestion.text}
            <span className="ml-1.5 font-mono text-[10px] opacity-70">−{suggestion.cost}</span>
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
