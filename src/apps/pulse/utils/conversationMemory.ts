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

export interface ExtractedPromise {
  /** Player commitment text, trimmed to a usable snippet (<= 140 chars). */
  text: string;
  /** Days from today the commitment seems due (0 = today/tonight, 1 = tomorrow). Undefined = no clear due date. */
  dueDayOffset?: number;
}

const PROMISE_PATTERNS: RegExp[] = [
  /i promise\b(.{3,120})/i,
  /i will\b(.{3,120})/i,
  /i['’]ll\b(.{3,120})/i,
  /let['’]?s meet\b(.{0,100})/i,
  /i['’]?m coming\b(.{0,100})/i,
  /i['’]?ll come\b(.{0,100})/i,
  /i['’]?ll call\b(.{0,100})/i,
  /i['’]?ll be there\b(.{0,60})/i,
];

/**
 * P3 — extract explicit player commitments ("i promise...", "i'll call...").
 * Conservative: only fires on clear commitment phrasing. Pure + deterministic.
 */
export function extractPromisesFromPlayerMessage(text: string, maxLen = 140): ExtractedPromise[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const out: ExtractedPromise[] = [];
  for (const pattern of PROMISE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const snippet = trimmed.slice(0, maxLen).replace(/\s+/g, ' ').trim();
    if (snippet.length < 8) continue;
    let dueDayOffset: number | undefined;
    if (lower.includes('tomorrow')) dueDayOffset = 1;
    else if (lower.includes('tonight') || lower.includes('today') || lower.includes('later')) dueDayOffset = 0;
    else if (lower.includes('weekend') || lower.includes('saturday') || lower.includes('sunday')) dueDayOffset = 3;
    out.push({ text: snippet, dueDayOffset });
    break; // one promise per message max — keeps the ledger clean
  }
  return out;
}

const COMPLETION_PATTERNS: RegExp[] = [
  /\bdid it\b/i,
  /\bi did\b/i,
  /\bdone\b/i,
  /\bfinished\b/i,
  /\bi went\b/i,
  /\bi called\b/i,
  /\bi came\b/i,
  /\btook care of it\b/i,
  /\ball done\b/i,
];

/** P3 — does this player message read like a follow-through on an open promise? */
export function looksLikeCompletion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 200) return false;
  return COMPLETION_PATTERNS.some((pattern) => pattern.test(trimmed));
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
