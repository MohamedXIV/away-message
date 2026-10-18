import type { MessageRecord } from '../engine/types';
import type { ConversationArchivePage } from './db';
import { ConversationHistory, type ConversationColdIndex } from '../engine/social/ConversationHistory';

/** Complete historical truth is stored in the slot archive; only this tail remains in the save document. */
export const RECENT_CONVERSATION_MESSAGES = 32;
export const CONVERSATION_ARCHIVE_PAGE_SIZE = 64;

export interface ConversationArchiveManifest {
  version: 1;
  /** Number of older messages stored outside the save document for each contact. */
  counts: Record<string, number>;
  /**
   * Optional because existing v1 archives predate cold bootstrapping.
   * Pure, bounded derived metadata from the canonical ConversationHistory.
   */
  indexes?: Record<string, ConversationColdIndex>;
}

export function isConversationColdIndex(value: unknown): value is ConversationColdIndex {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const x = value as Partial<ConversationColdIndex>;
  const integer = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return integer(x.unread) && integer(x.anyUnread) && x.unread! <= x.anyUnread!
    && (x.lastMessageMinute === null || finite(x.lastMessageMinute))
    && finite(x.lastActivityMinute) && finite(x.lastPlayerMinute)
    && Array.isArray(x.days) && x.days.every(integer)
    && Array.isArray(x.playerDays) && x.playerDays.every(integer)
    && Array.isArray(x.unreadPreview) && x.unreadPreview.length <= 10
    && x.unreadPreview.every(preview =>
      preview && typeof preview.id === 'string' && typeof preview.text === 'string'
      && finite(preview.timestampMinute))
    && (x.lastOfflineText === null || typeof x.lastOfflineText === 'string');
}

export function isConversationArchiveManifest(value: unknown): value is ConversationArchiveManifest {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<ConversationArchiveManifest>;
  if (input.version !== 1 || !input.counts || typeof input.counts !== 'object'
      || Array.isArray(input.counts)) return false;
  if (!Object.entries(input.counts).every(([id, count]) =>
    id.length > 0 && typeof count === 'number' && Number.isSafeInteger(count)
    && count >= 0)) return false;
  if (input.indexes === undefined) return true;
  if (!input.indexes || typeof input.indexes !== 'object' || Array.isArray(input.indexes)) return false;
  const ids = Object.keys(input.counts);
  return Object.keys(input.indexes).length === ids.length
    && ids.every(id => Object.hasOwn(input.indexes!, id)
      && isConversationColdIndex(input.indexes![id]));
}

export function conversationArchivePageKey(slotId: string, conversationId: string, pageIndex: number): string {
  // JSON tuple avoids delimiter collisions in player-authored/generated IDs.
  return JSON.stringify([slotId, conversationId, pageIndex]);
}

/**
 * Pure projection for one explicit save operation. No secondary canonical
 * runtime graph: messages are detached into one archive per save slot, and
 * the source engine still owns all live writes/reads.
 */
export function splitConversationArchive(
  slotId: string, conversations: Record<string, MessageRecord[]>,
): { recent: Record<string, MessageRecord[]>; pages: ConversationArchivePage[];
  manifest: ConversationArchiveManifest } {
  const recent: Record<string, MessageRecord[]> = {};
  const pages: ConversationArchivePage[] = [];
  const counts: Record<string, number> = {};
  const indexes: Record<string, ConversationColdIndex> = {};
  for (const [conversationId, messages] of Object.entries(conversations)) {
    indexes[conversationId] = ConversationHistory.summarizeForColdBootstrap(conversationId, messages);
    const coldCount = Math.max(0, messages.length - RECENT_CONVERSATION_MESSAGES);
    counts[conversationId] = coldCount;
    recent[conversationId] = messages.slice(coldCount).map(m => ({
      ...m, ...(m.tags ? { tags: [...m.tags] } : {}),
    }));
    for (let start = 0; start < coldCount; start += CONVERSATION_ARCHIVE_PAGE_SIZE) {
      const pageIndex = Math.floor(start / CONVERSATION_ARCHIVE_PAGE_SIZE);
      pages.push({
        key: conversationArchivePageKey(slotId, conversationId, pageIndex),
        slotId, conversationId, pageIndex,
        messages: messages.slice(start, Math.min(coldCount, start + CONVERSATION_ARCHIVE_PAGE_SIZE)).map(m => ({
          ...m, ...(m.tags ? { tags: [...m.tags] } : {}),
        })),
      });
    }
  }
  return { recent, pages, manifest: { version: 1, counts, indexes } };
}

function expectedLength(total: number, index: number): number {
  return Math.min(CONVERSATION_ARCHIVE_PAGE_SIZE,
    Math.max(0, total - index * CONVERSATION_ARCHIVE_PAGE_SIZE));
}

function verifyPage(
  page: ConversationArchivePage | undefined, slotId: string, conversationId: string,
  pageIndex: number, total: number,
): page is ConversationArchivePage {
  return Boolean(page
    && page.key === conversationArchivePageKey(slotId, conversationId, pageIndex)
    && page.slotId === slotId && page.conversationId === conversationId
    && page.pageIndex === pageIndex
    && Array.isArray(page.messages)
    && page.messages.length === expectedLength(total, pageIndex)
    && page.messages.every(m => m && m.conversationId === conversationId));
}

/**
 * Reconstructs the full current-format snapshot only on explicit load. A
 * missing/corrupt page fails closed: never silently lose canonical history.
 */
export function hydrateConversationArchive(
  slotId: string,
  recent: Record<string, MessageRecord[]>,
  manifest: ConversationArchiveManifest,
  pages: ConversationArchivePage[],
): Record<string, MessageRecord[]> | null {
  if (!isConversationArchiveManifest(manifest)) return null;
  if (pages.some(p => !(p.conversationId in manifest.counts))) return null;
  const conversations: Record<string, MessageRecord[]> = {};
  const allKeys = new Set([...Object.keys(manifest.counts), ...Object.keys(recent)]);
  for (const id of allKeys) {
    const totalCold = manifest.counts[id];
    if (totalCold === undefined || !Array.isArray(recent[id])
      || recent[id].length > RECENT_CONVERSATION_MESSAGES) return null;
    const expectedPages = Math.ceil(totalCold / CONVERSATION_ARCHIVE_PAGE_SIZE);
    const actorPages = pages.filter(page => page.conversationId === id);
    if (actorPages.length !== expectedPages) return null;
    const older: MessageRecord[] = [];
    for (let pageIndex = 0; pageIndex < expectedPages; pageIndex++) {
      const page = actorPages.find(p => p.pageIndex === pageIndex);
      if (!verifyPage(page, slotId, id, pageIndex, totalCold)) return null;
      older.push(...page.messages);
    }
    conversations[id] = [...older, ...recent[id]].map(m => ({
      ...m, ...(m.tags ? { tags: [...m.tags] } : {}),
    }));
  }
  return conversations;
}

/**
 * Cold runtime reader: one immutable persisted 64-message chunk, no whole
 * conversation materialization. A generation token prevents reads from a
 * subsequently overwritten slot being confused with the source snapshot.
 */
export async function readSavedColdConversationChunk(
  slotId: string, conversationId: string, pageIndex: number, expectedUpdatedAt: number,
): Promise<MessageRecord[] | null> {
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0) return null;
  const { db } = await import('./db');
  return db.transaction('r', db.saves, db.conversation_pages, async () => {
    const slot = await db.saves.get(slotId);
    const archive = slot?.meta?.conversationArchive;
    if (!slot || slot.updatedAt !== expectedUpdatedAt
      || !isConversationArchiveManifest(archive)) return null;
    const count = archive.counts[conversationId];
    if (count === undefined || pageIndex >= Math.ceil(count / CONVERSATION_ARCHIVE_PAGE_SIZE)) return null;
    const page = await db.conversation_pages.get(conversationArchivePageKey(slotId, conversationId, pageIndex));
    if (!verifyPage(page, slotId, conversationId, pageIndex, count)) return null;
    return page.messages.map(m => ({ ...m, ...(m.tags ? { tags: [...m.tags] } : {}) }));
  });
}

/** Select only the necessary cold pages for one saved conversation page. */
export async function readSavedConversationPage(
  slotId: string, conversationId: string, offset = 0, limit = 30,
): Promise<{ conversationId: string; messages: MessageRecord[]; total: number; hasOlder: boolean } | null> {
  const { db } = await import('./db');
  return db.transaction('r', db.saves, db.conversation_pages, async () => {
    const record = await db.saves.get(slotId);
    if (!record?.snapshot) return null;
    const recent = record.snapshot.social?.conversations?.[conversationId];
    const raw = record.meta?.conversationArchive;
    if (!isConversationArchiveManifest(raw) || !Array.isArray(recent)
      || recent.length > RECENT_CONVERSATION_MESSAGES) return null;
    const cold = raw.counts[conversationId];
    if (cold === undefined) return null;
    const total = cold + recent.length;
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 30;
    const end = Math.max(0, total - safeOffset);
    const start = Math.max(0, end - safeLimit);
    const coldStart = Math.min(cold, start);
    const coldEnd = Math.min(cold, end);
    const selected: MessageRecord[] = [];
    if (coldStart < coldEnd) {
      const first = Math.floor(coldStart / CONVERSATION_ARCHIVE_PAGE_SIZE);
      const last = Math.floor((coldEnd - 1) / CONVERSATION_ARCHIVE_PAGE_SIZE);
      for (let index = first; index <= last; index++) {
        const page = await db.conversation_pages.get(conversationArchivePageKey(slotId, conversationId, index));
        if (!verifyPage(page, slotId, conversationId, index, cold)) return null;
        const begin = Math.max(coldStart - index * CONVERSATION_ARCHIVE_PAGE_SIZE, 0);
        const until = Math.min(coldEnd - index * CONVERSATION_ARCHIVE_PAGE_SIZE, page.messages.length);
        selected.push(...page.messages.slice(begin, until));
      }
    }
    if (end > cold) selected.push(...recent.slice(Math.max(0, start - cold), end - cold));
    return {
      conversationId,
      messages: selected.map(m => ({ ...m, ...(m.tags ? { tags: [...m.tags] } : {}) })),
      total, hasOlder: start > 0,
    };
  });
}
