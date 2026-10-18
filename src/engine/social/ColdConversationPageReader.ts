import type { MessageRecord } from '../types';

/**
 * A read-only, slot-scoped source of frozen historical pages. All live changes
 * (appends/receipts/deletes) remain with ConversationHistory, never with a
 * second mutable message store.
 */
export type ColdConversationReader = (
  conversationId: string, pageIndex: number,
) => Promise<MessageRecord[] | null>;

export const COLD_PAGE_SIZE = 64;

const clone = (message: MessageRecord): MessageRecord => ({
  ...message, ...(message.tags ? { tags: [...message.tags] } : {}),
});

/** No caching: read only source pages intersecting an explicit requested range. */
export async function readColdMessageRange(
  reader: ColdConversationReader,
  conversationId: string,
  totalCold: number,
  start: number,
  end: number,
): Promise<MessageRecord[]> {
  if (start < 0 || end > totalCold || end < start) throw new Error('Invalid cold conversation range');
  const selected: MessageRecord[] = [];
  if (start === end) return selected;
  const first = Math.floor(start / COLD_PAGE_SIZE);
  const last = Math.floor((end - 1) / COLD_PAGE_SIZE);
  for (let index = first; index <= last; index++) {
    const page = await reader(conversationId, index);
    const expected = Math.min(COLD_PAGE_SIZE, totalCold - index * COLD_PAGE_SIZE);
    if (!page || page.length !== expected || page.some(m => !m || m.conversationId !== conversationId)) {
      throw new Error('Unavailable or invalid cold conversation page');
    }
    const pageStart = index * COLD_PAGE_SIZE;
    selected.push(...page.slice(Math.max(0, start - pageStart),
      Math.min(expected, end - pageStart)).map(clone));
  }
  return selected;
}
