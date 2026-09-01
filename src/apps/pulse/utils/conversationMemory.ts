function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

export function hashReply(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 240);
  return `${hashString(normalized)}:${normalized.length}:${normalized.slice(0, 32)}`;
}

export function isDuplicateReply(newText: string, recentHashes: string[], recentTexts: string[]): boolean {
  const newHash = hashReply(newText);
  if (recentHashes.includes(newHash)) return true;
  const normalizedNew = newText.trim().toLowerCase();
  // Near-duplicate: >80% Jaccard on token sets
  const newTokens = new Set(normalizedNew.split(/\s+/).filter(Boolean));
  for (const existing of recentTexts.slice(-5)) {
    const existingTokens = new Set(existing.trim().toLowerCase().split(/\s+/).filter(Boolean));
    const intersection = [...newTokens].filter((token) => existingTokens.has(token)).length;
    const union = new Set([...newTokens, ...existingTokens]).size;
    if (union > 0 && intersection / union > 0.82) return true;
    // Exact-ish small messages
    if (normalizedNew.length < 60 && normalizedNew === existing.trim().toLowerCase()) return true;
  }
  return false;
}

export function extractFactsFromPlayerMessage(text: string): string[] {
  const facts: string[] = [];
  const lower = text.toLowerCase();
  const trimmed = text.trim();
  if (!trimmed) return facts;

  // Name introduction
  const nameMatch = trimmed.match(/(?:my name is|call me|i'm|i am)\s+([A-Za-z][A-Za-z\s]{1,18})/i);
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].trim().slice(0, 24);
    if (name.length >= 2) facts.push(`Player introduced themselves as "${name}"`);
  }

  // Promises / commitments
  if (lower.includes('i promise') || lower.includes('i will') || lower.includes("i'll")) {
    const snippet = trimmed.slice(0, 120);
    facts.push(`Player committed: "${snippet}"`);
  }

  // Preferences
  if (lower.includes('i like') || lower.includes('i love') || lower.includes('i hate') || lower.includes('my favorite')) {
    const snippet = trimmed.slice(0, 120);
    facts.push(`Preference: "${snippet}"`);
  }

  // Plans / availability
  if (lower.includes('tomorrow') || lower.includes('tonight') || lower.includes('later') || lower.includes('meet')) {
    const snippet = trimmed.slice(0, 120);
    facts.push(`Player mentioned plan/time: "${snippet}"`);
  }

  // Do-not-know guard: if player asks NPC to reveal something NPC shouldn't know spontaneously, we don't auto-inject knowledge into NPC
  // This list is intentionally conservative — facts are only what player explicitly told that buddy.

  return facts.slice(0, 2);
}

export function buildConversationSummary(recentMessages: Array<{ sender: string; text: string }>, previousSummary: string, maxLen = 520): string {
  if (recentMessages.length === 0) return previousSummary || 'No prior conversation.';
  // Build a compressed transcript: last 6 exchanges summarized as "Player: ... / Buddy: ..."
  const tail = recentMessages.slice(-6);
  const transcript = tail.map((message) => `${message.sender === 'player' ? 'Player' : 'Buddy'}: ${message.text.slice(0, 140)}`).join(' | ');
  const base = previousSummary && previousSummary !== 'No prior conversation.' ? `${previousSummary} | Recent: ${transcript}` : transcript;
  // Deduplicate and truncate intelligently
  const deduped = base.replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim();
  if (deduped.length <= maxLen) return deduped;
  // Keep the most recent part when truncating
  return `...${deduped.slice(-(maxLen - 3))}`;
}

export function buildMemoryContext(
  conversationMemory: string[],
  buddyFacts: string[],
  summary: string,
  recentReplies: string[]
): string {
  const memoryLine = conversationMemory.length > 0 ? conversationMemory.join(' | ') : 'No prior remembered details.';
  const factsLine = buddyFacts.length > 0 ? buddyFacts.slice(-6).join(' | ') : 'No confirmed facts yet.';
  const summaryLine = summary || 'No summary.';
  const antiRepeatLine = recentReplies.length > 0 ? `Avoid repeating these recent replies verbatim: ${recentReplies.slice(-3).map((reply) => `"${reply.slice(0, 80)}"`).join(', ')}` : '';
  return `Memory: ${memoryLine} | Facts: ${factsLine} | Summary: ${summaryLine}${antiRepeatLine ? ` | ${antiRepeatLine}` : ''}`;
}
