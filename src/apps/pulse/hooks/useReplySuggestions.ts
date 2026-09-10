import { useCallback, useRef, useState } from 'react';
import type { PlayerTone } from '../../../engine/PlayerActs';

/** A reply suggestion enriched with rules tone + battery price (never auto-sends). */
export interface ReplySuggestionItem {
  text: string;
  tone: PlayerTone;
  degree: number;
  cost: number;
}

/** Exported for tests: caps at 3, trims, defaults tone/cost. */
export function sanitizeItems(items: unknown): ReplySuggestionItem[] {  if (!Array.isArray(items)) return [];
  const clean: ReplySuggestionItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const text = String((item as ReplySuggestionItem).text ?? '').trim().slice(0, 120);
    if (!text) continue;
    const tone = (item as ReplySuggestionItem).tone;
    clean.push({
      text,
      tone: tone === 'warm' || tone === 'flirty' || tone === 'hot' || tone === 'cold' ? tone : 'normal',
      degree: typeof (item as ReplySuggestionItem).degree === 'number' ? Math.max(0, Math.min(2, Math.round((item as ReplySuggestionItem).degree))) : 0,
      cost: typeof (item as ReplySuggestionItem).cost === 'number' ? Math.max(0, Math.round((item as ReplySuggestionItem).cost)) : 1,
    });
    if (clean.length >= 3) break;
  }
  return clean;
}

/**
 * AI reply suggestions for the PLAYER (P8/B2). The caller triggers refresh()
 * with a dedupe key (usually buddyId + latest NPC message id) whenever a new
 * NPC reply lands; picks fill the input for editing, never auto-send.
 * Race-safe: stale fetches for superseded keys are discarded.
 */
export function useReplySuggestions() {
  const [suggestions, setSuggestions] = useState<ReplySuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedKey = useRef<string | null>(null);

  const refresh = useCallback(async (key: string, fetcher: () => Promise<ReplySuggestionItem[]>) => {
    if (!key || fetchedKey.current === key) return;
    fetchedKey.current = key;
    setLoading(true);
    try {
      const replies = await fetcher();
      if (fetchedKey.current !== key) return;
      setSuggestions(sanitizeItems(replies));
    } catch {
      if (fetchedKey.current === key) setSuggestions([]);
    } finally {
      if (fetchedKey.current === key) setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    fetchedKey.current = null;
    setSuggestions([]);
    setLoading(false);
  }, []);

  return { suggestions, loading, refresh, clear };
}
