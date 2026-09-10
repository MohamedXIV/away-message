import React from 'react';

export interface EmoticonDefinition {
  code: string;
  glyph: string;
  label: string;
  isOrion60Only?: boolean;
  /** Pulse 6.0 animated pack (gated on installed Pulse release, not the OS). */
  isPulse6Only?: boolean;
  animated?: boolean;
}

export interface EmoticonToken {
  type: 'text' | 'emoticon';
  content: string;
  glyph?: string;
  label?: string;
  animated?: boolean;
}

export const EMOTICON_LIST: EmoticonDefinition[] = [
  // Orion 6.0 Exclusives
  { code: '(:star:)', glyph: '⭐', label: 'Orion Star', isOrion60Only: true },
  { code: '(:fire:)', glyph: '🔥', label: 'Fire', isOrion60Only: true },
  { code: '(:zap:)', glyph: '⚡', label: 'Lightning', isOrion60Only: true },
  { code: '(:camera:)', glyph: '📷', label: '35mm Camera', isOrion60Only: true },

  // Pulse 6.0 animated pack (MSN-era motion emoticons)
  { code: '(:lol:)', glyph: '🤣', label: 'ROFL', isPulse6Only: true, animated: true },
  { code: '(:love:)', glyph: '😍', label: 'In Love', isPulse6Only: true, animated: true },
  { code: '(:dance:)', glyph: '💃', label: 'Dance', isPulse6Only: true, animated: true },
  { code: '(:party:)', glyph: '🥳', label: 'Party', isPulse6Only: true, animated: true },
  { code: '(:cry:)', glyph: '😭', label: 'Sob', isPulse6Only: true, animated: true },
  { code: '(:cool:)', glyph: '😎', label: 'Cool', isPulse6Only: true, animated: true },
  { code: '(:hug:)', glyph: '🤗', label: 'Hug', isPulse6Only: true, animated: true },
  { code: '(:wave:)', glyph: '👋', label: 'Wave', isPulse6Only: true, animated: true },

  // Classic MSN/AIM Emoticons
  { code: ':-)', glyph: '😊', label: 'Smile' },
  { code: ':)', glyph: '😊', label: 'Smile' },
  { code: ':-D', glyph: '😄', label: 'Big Grin' },
  { code: ':D', glyph: '😄', label: 'Big Grin' },
  { code: ':-P', glyph: '😛', label: 'Tongue Out' },
  { code: ':P', glyph: '😛', label: 'Tongue Out' },
  { code: ';-)', glyph: '😉', label: 'Wink' },
  { code: ';)', glyph: '😉', label: 'Wink' },
  { code: ':-O', glyph: '😮', label: 'Surprised' },
  { code: ':O', glyph: '😮', label: 'Surprised' },
  { code: ':-@', glyph: '😡', label: 'Angry' },
  { code: ':@', glyph: '😡', label: 'Angry' },
  { code: ':-S', glyph: '😖', label: 'Confused' },
  { code: ':S', glyph: '😖', label: 'Confused' },
  { code: ':-|', glyph: '😐', label: 'Neutral' },
  { code: ':|', glyph: '😐', label: 'Neutral' },
  { code: ':-*', glyph: '😘', label: 'Kiss' },
  { code: ':*', glyph: '😘', label: 'Kiss' },
  { code: '8-)', glyph: '😎', label: 'Cool Shades' },
  { code: '(H)', glyph: '😎', label: 'Cool Shades' },
  { code: '(A)', glyph: '😇', label: 'Angel' },
  { code: '(6)', glyph: '😈', label: 'Devil' },
  { code: '(L)', glyph: '❤️', label: 'Heart' },
  { code: '(U)', glyph: '💔', label: 'Broken Heart' },
  { code: '(M)', glyph: '🎵', label: 'Music Note' },
  { code: '(C)', glyph: '☕', label: 'Coffee Cup' },
  { code: '(Y)', glyph: '👍', label: 'Thumbs Up' },
  { code: '(N)', glyph: '👎', label: 'Thumbs Down' },
];

export function tokenizeEmoticons(text: string, isOrion60: boolean = false, isPulse6: boolean = false): EmoticonToken[] {
  if (!text) return [];

  // Sort all definitions by code length descending
  const sorted = [...EMOTICON_LIST].sort((a, b) => b.code.length - a.code.length);

  const regexPattern = sorted
    .map((e) => e.code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|');

  if (!regexPattern) return [{ type: 'text', content: text }];

  const regex = new RegExp(`(${regexPattern})`, 'g');
  const parts = text.split(regex);

  return parts.filter(Boolean).map((part) => {
    const match = sorted.find((e) => e.code === part);
    if (match) {
      if ((!match.isOrion60Only || isOrion60) && (!match.isPulse6Only || isPulse6)) {
        return {
          type: 'emoticon',
          content: match.code,
          glyph: match.glyph,
          label: match.label,
          animated: match.animated,
        };
      }
      return {
        type: 'text',
        content: part,
      };
    }
    return {
      type: 'text',
      content: part,
    };
  });
}

/**
 * Tokenizes text and parses emoticons into stylized React glyph spans.
 */
export function parseEmoticons(text: string, isOrion60: boolean = false, isPulse6: boolean = false): EmoticonToken[] {
  return tokenizeEmoticons(text, isOrion60, isPulse6);
}

export function renderEmoticonNodes(text: string, isOrion60: boolean = false, isPulse6: boolean = false): React.ReactNode {
  const tokens = tokenizeEmoticons(text, isOrion60, isPulse6);
  return tokens.map((token, index) => {
    if (token.type === 'emoticon' && token.glyph) {
      return (
        <span
          key={index}
          className={`inline-block transform hover:scale-125 transition-transform select-none mx-0.5${token.animated ? ' animate-bounce' : ''}`}
          title={`${token.label} (${token.content})`}
        >
          {token.glyph}
        </span>
      );
    }
    return <React.Fragment key={index}>{token.content}</React.Fragment>;
  });
}
