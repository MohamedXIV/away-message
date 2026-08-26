import React from 'react';

export interface EmoticonDefinition {
  code: string;
  glyph: string;
  label: string;
  isOrion60Only?: boolean;
}

export interface EmoticonToken {
  type: 'text' | 'emoticon';
  content: string;
  glyph?: string;
  label?: string;
}

export const EMOTICON_LIST: EmoticonDefinition[] = [
  // Orion 6.0 Exclusives
  { code: '(:star:)', glyph: '⭐', label: 'Orion Star', isOrion60Only: true },
  { code: '(:fire:)', glyph: '🔥', label: 'Fire', isOrion60Only: true },
  { code: '(:zap:)', glyph: '⚡', label: 'Lightning', isOrion60Only: true },
  { code: '(:camera:)', glyph: '📷', label: '35mm Camera', isOrion60Only: true },

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

export function tokenizeEmoticons(text: string, isOrion60: boolean = false): EmoticonToken[] {
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
      if (!match.isOrion60Only || isOrion60) {
        return {
          type: 'emoticon',
          content: match.code,
          glyph: match.glyph,
          label: match.label,
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
export function parseEmoticons(text: string, isOrion60: boolean = false): EmoticonToken[] {
  return tokenizeEmoticons(text, isOrion60);
}

export function renderEmoticonNodes(text: string, isOrion60: boolean = false): React.ReactNode {
  const tokens = tokenizeEmoticons(text, isOrion60);
  return tokens.map((token, index) => {
    if (token.type === 'emoticon' && token.glyph) {
      return (
        <span
          key={index}
          className="inline-block transform hover:scale-125 transition-transform select-none mx-0.5"
          title={`${token.label} (${token.content})`}
        >
          {token.glyph}
        </span>
      );
    }
    return <React.Fragment key={index}>{token.content}</React.Fragment>;
  });
}
