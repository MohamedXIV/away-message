import { useCallback, useRef, useState } from 'react';

/**
 * AI reply suggestions for the PLAYER (P8/B2). The caller triggers refresh()
 * with a dedupe key (usually buddyId + latest NPC message id) whenever a new
 * NPC reply lands; picks fill the input for editing, never auto-send.
 * Race-safe: stale fetches for superseded keys are discarded.
 */
export function useReplySuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedKey = useRef<string | null>(null);

  const refresh = useCallback(async (key: string, fetcher: () => Promise<string[]>) => {
    if (!key || fetchedKey.current === key) return;
    fetchedKey.current = key;
    setLoading(true);
    try {
      const replies = await fetcher();
      if (fetchedKey.current !== key) return;
      setSuggestions(Array.isArray(replies) ? replies.filter((r) => typeof r === 'string' && r.trim()).map((r) => r.trim().slice(0, 120)).slice(0, 3) : []);
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
