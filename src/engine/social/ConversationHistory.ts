import type { MessageRecord } from '../types';
import { readColdMessageRange, type ColdConversationReader } from './ColdConversationPageReader';

/**
 * One canonical Social conversation owner. At most 32 recent + 63 pending
 * cold messages are live JS objects per conversation; settled cold chunks are
 * serialized once and decoded only by explicit pages/export/read receipts.
 * This is runtime representation, NOT a second durable persistence backend:
 * #173's IndexedDB slot archive remains responsible for durable cold pages.
 */
export const LIVE_RECENT_CONVERSATION_MESSAGES = 32;
export const LIVE_COLD_CONVERSATION_PAGE_SIZE = 64;
const UNREAD_PREVIEW_CAP = 10; // unreadTray() exposes at most 10 previews

type ConversationRecords = {
  /** Serialized, chronological 64-message blocks; no materialized body graph. */
  coldPages: string[];
  /** Tail of the cold tier not yet large enough to serialize into a full page. */
  pendingCold: MessageRecord[];
  /** Only the most recent messages are always materialized. */
  recent: MessageRecord[];
  total: number;
  /** Immutable saved prefix; its only truth lives in slot-scoped cold pages. */
  coldBaseCount: number;
  coldReader: ColdConversationReader | null;
  /** One receipt overlay on the saved prefix; never rewrite old pages in place. */
  coldReadAll: boolean;
};

/**
 * Derived, bounded metadata used to bootstrap cold history without loading
 * historical message bodies. Never a second writable social authority.
 */
export interface ConversationColdIndex {
  unread: number;
  anyUnread: number;
  lastMessageMinute: number | null;
  lastActivityMinute: number;
  lastPlayerMinute: number;
  days: number[];
  playerDays: number[];
  unreadPreview: Array<{ id: string; text: string; timestampMinute: number }>;
  lastOfflineText: string | null;
}

type ConversationIndex = {
  unread: number;
  anyUnread: number;
  lastMessageMinute: number | null;
  lastActivityMinute: number;
  lastPlayerMinute: number;
  daySet: Set<number>;
  playerDays: Set<number>;
  /** Bounded derived preview, never a second transcript or full unread list. */
  unreadPreview: Array<Pick<MessageRecord, 'id' | 'text' | 'timestampMinute'>>;
  lastOfflineText: string | null;
};

const detach = (m: MessageRecord): MessageRecord =>
  ({ ...m, ...(m.tags ? { tags: [...m.tags] } : {}) });

const ranked = (
  a: Pick<MessageRecord, 'id' | 'timestampMinute'>,
  b: Pick<MessageRecord, 'id' | 'timestampMinute'>,
): number =>
  b.timestampMinute - a.timestampMinute || b.id.localeCompare(a.id);

function emptyIndex(): ConversationIndex {
  return {
    unread: 0, anyUnread: 0, lastMessageMinute: null,
    lastActivityMinute: 0, lastPlayerMinute: 0,
    daySet: new Set(), playerDays: new Set(),
    unreadPreview: [], lastOfflineText: null,
  };
}

function emptyRecords(): ConversationRecords {
  return {
    coldPages: [], pendingCold: [], recent: [], total: 0,
    coldBaseCount: 0, coldReader: null, coldReadAll: false,
  };
}

export class ConversationHistory {
  private readonly records = new Map<string, ConversationRecords>();
  private readonly indexes = new Map<string, ConversationIndex>();
  private lastPlayerMinute = 0;
  private readonly playerDays = new Set<number>();

  constructor(private readonly normalizeId: (id: string) => string) {}

  /**
   * Explicit persistence boundary: derive cold bootstrap metadata by running
   * the exact same index logic as live history, without retaining transcript
   * arrays or introducing another unread/knowledge rule implementation.
   */
  public static summarizeForColdBootstrap(id: string, messages: readonly MessageRecord[]): ConversationColdIndex {
    const owner = new ConversationHistory(value => value);
    const index = emptyIndex();
    for (const message of messages) owner.track(index, id, message);
    return {
      unread: index.unread,
      anyUnread: index.anyUnread,
      lastMessageMinute: index.lastMessageMinute,
      lastActivityMinute: index.lastActivityMinute,
      lastPlayerMinute: index.lastPlayerMinute,
      days: [...index.daySet].sort((a, b) => a - b),
      playerDays: [...index.playerDays].sort((a, b) => a - b),
      unreadPreview: index.unreadPreview.map(m =>
        ({ id: m.id, text: m.text, timestampMinute: m.timestampMinute })),
      lastOfflineText: index.lastOfflineText,
    };
  }

  public ensure(rawId: string): void {
    const id = this.normalizeId(rawId);
    if (!this.records.has(id)) {
      this.records.set(id, emptyRecords());
      this.indexes.set(id, emptyIndex());
    }
  }

  public delete(rawId: string): void {
    const id = this.normalizeId(rawId);
    this.records.delete(id);
    this.indexes.delete(id);
    this.rebuildGlobalPlayerIndex();
  }

  /** Explicit snapshot import is allowed to inspect all source bodies once. */
  public restore(data: Record<string, MessageRecord[]>): void {
    this.records.clear();
    this.indexes.clear();
    this.lastPlayerMinute = 0;
    this.playerDays.clear();
    for (const [rawId, messages] of Object.entries(data)) {
      const id = this.normalizeId(rawId);
      if (!Array.isArray(messages)) continue;
      const entry = emptyRecords();
      const index = emptyIndex();
      const coldCount = Math.max(0, messages.length - LIVE_RECENT_CONVERSATION_MESSAGES);
      // The first coldCount messages are older than the hot tail. Store complete
      // cold blocks as one JSON string each rather than retaining old objects.
      for (let start = 0; start < coldCount; start += LIVE_COLD_CONVERSATION_PAGE_SIZE) {
        const end = Math.min(coldCount, start + LIVE_COLD_CONVERSATION_PAGE_SIZE);
        const block: MessageRecord[] = [];
        for (let at = start; at < end; at++) {
          const message = this.normalizeMessage(messages[at]!);
          this.track(index, id, message);
          block.push(message);
        }
        if (block.length === LIVE_COLD_CONVERSATION_PAGE_SIZE) entry.coldPages.push(JSON.stringify(block));
        else entry.pendingCold = block;
      }
      for (let at = coldCount; at < messages.length; at++) {
        const message = this.normalizeMessage(messages[at]!);
        this.track(index, id, message);
        entry.recent.push(message);
      }
      entry.total = messages.length;
      this.records.set(id, entry);
      this.indexes.set(id, index);
    }
    this.rebuildGlobalPlayerIndex();
  }


  /**
   * Attach the saved immutable cold prefix to this same canonical owner.
   * The supplied partial snapshot MUST be the matching saved recent tails.
   * Reject inconsistent metadata BEFORE replacing live state. This is a boot
   * operation, never a second authority or UI cache.
   */
  public restoreCold(
    recent: Record<string, MessageRecord[]>,
    counts: Record<string, number>,
    indexes: Record<string, ConversationColdIndex>,
    reader: ColdConversationReader,
  ): void {
    const ids = Object.keys(recent);
    if (ids.length !== Object.keys(counts).length
      || ids.length !== Object.keys(indexes).length
      || ids.some(id => !Object.hasOwn(counts, id) || !Object.hasOwn(indexes, id)
        || !Number.isSafeInteger(counts[id]) || counts[id]! < 0
        || !Array.isArray(recent[id])
        || recent[id]!.length > LIVE_RECENT_CONVERSATION_MESSAGES
        || !indexes[id] || indexes[id]!.unread < 0
        || indexes[id]!.anyUnread < indexes[id]!.unread
        || indexes[id]!.anyUnread > counts[id]! + recent[id]!.length)) {
      throw new Error('Invalid cold conversation bootstrap');
    }
    this.restore(recent);
    for (const id of ids) {
      const key = this.normalizeId(id);
      if (key !== id) throw new Error('Cold conversation ID is not canonical');
      const entry = this.records.get(key)!;
      const saved = indexes[key]!;
      entry.coldBaseCount = counts[key]!;
      entry.coldReader = reader;
      entry.total += entry.coldBaseCount;
      this.indexes.set(key, {
        unread: saved.unread,
        anyUnread: saved.anyUnread,
        lastMessageMinute: saved.lastMessageMinute,
        lastActivityMinute: saved.lastActivityMinute,
        lastPlayerMinute: saved.lastPlayerMinute,
        daySet: new Set(saved.days),
        playerDays: new Set(saved.playerDays),
        unreadPreview: saved.unreadPreview.map(m => ({ ...m })),
        lastOfflineText: saved.lastOfflineText,
      });
    }
    this.rebuildGlobalPlayerIndex();
  }

  /** True if a full synchronous snapshot would silently omit saved messages. */
  public hasColdHistory(): boolean {
    for (const entry of this.records.values()) if (entry.coldBaseCount > 0) return true;
    return false;
  }

  /** Explicit full export: never materialize this in a normal React revision. */
  public async exportAllAsync(): Promise<Record<string, MessageRecord[]>> {
    const data: Record<string, MessageRecord[]> = {};
    for (const [id, entry] of this.records) {
      const total = entry.total;
      const base = entry.coldBaseCount
        ? await readColdMessageRange(entry.coldReader!, id, entry.coldBaseCount, 0, entry.coldBaseCount)
        : [];
      if (this.records.get(id) !== entry || entry.total !== total) {
        throw new Error('Conversation changed during async export; retry the save');
      }
      if (entry.coldReadAll) for (const msg of base) msg.isRead = true;
      data[id] = [
        ...base,
        ...entry.coldPages.flatMap(p => (JSON.parse(p) as MessageRecord[]).map(detach)),
        ...entry.pendingCold.map(detach), ...entry.recent.map(detach),
      ];
    }
    return data;
  }

  /** Persistence/debug only — full materialization remains explicit and costly. */
  public exportAll(): Record<string, MessageRecord[]> {
    if (this.hasColdHistory()) throw new Error('Cold history requires async export');
    const data: Record<string, MessageRecord[]> = {};
    for (const [id, entry] of this.records) {
      data[id] = [
        ...entry.coldPages.flatMap(p => (JSON.parse(p) as MessageRecord[]).map(detach)),
        ...entry.pendingCold.map(detach), ...entry.recent.map(detach),
      ];
    }
    return data;
  }

  /** Single canonical write; old hot messages eventually seal into cold chunks. */
  public append(msg: MessageRecord): void {
    const id = this.normalizeId(msg.conversationId);
    this.ensure(id);
    const message = detach(msg);
    const entry = this.records.get(id)!;
    entry.recent.push(message);
    entry.total++;
    if (entry.recent.length > LIVE_RECENT_CONVERSATION_MESSAGES) {
      entry.pendingCold.push(entry.recent.shift()!);
      if (entry.pendingCold.length >= LIVE_COLD_CONVERSATION_PAGE_SIZE) {
        entry.coldPages.push(JSON.stringify(entry.pendingCold));
        entry.pendingCold = [];
      }
    }
    const index = this.indexes.get(id)!;
    this.track(index, id, message);
    if (message.senderId === 'player' && Number.isFinite(message.timestampMinute)) {
      this.lastPlayerMinute = Math.max(this.lastPlayerMinute, message.timestampMinute);
      this.playerDays.add(Math.floor(message.timestampMinute / 1440) + 1);
    }
  }

  /** Explicit read receipt updates cold pages, tails and derived indices together. */
  public markRead(rawId: string): boolean {
    const id = this.normalizeId(rawId);
    const entry = this.records.get(id);
    const index = this.indexes.get(id);
    if (!entry || !index || index.anyUnread === 0) return false;
    if (entry.coldBaseCount > 0) entry.coldReadAll = true;
    for (let at = 0; at < entry.coldPages.length; at++) {
      const messages = JSON.parse(entry.coldPages[at]!) as MessageRecord[];
      if (messages.some(m => !m.isRead)) {
        for (const m of messages) m.isRead = true;
        entry.coldPages[at] = JSON.stringify(messages);
      }
    }
    for (const message of [...entry.pendingCold, ...entry.recent]) message.isRead = true;
    index.unread = 0;
    index.anyUnread = 0;
    index.unreadPreview.length = 0;
    return true;
  }

  public page(rawId: string, offset = 0, limit = 30): {
    conversationId: string; messages: MessageRecord[]; total: number; hasOlder: boolean;
  } {
    const id = this.normalizeId(rawId);
    const entry = this.records.get(id);
    const total = entry?.total ?? 0;
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 30;
    const end = Math.max(0, total - safeOffset);
    const start = Math.max(0, end - safeLimit);
    const messages: MessageRecord[] = [];
    if (entry && start < end) {
      if (start < entry.coldBaseCount) {
        throw new Error('Cold history page requires async read');
      }
      // Only pages overlapping the requested window are deserialized. Backdated
      // world minutes never change append/chronological transcript ordering.
      for (let at = 0; at < entry.coldPages.length; at++) {
        const chunkStart = entry.coldBaseCount + at * LIVE_COLD_CONVERSATION_PAGE_SIZE;
        const chunkEnd = chunkStart + LIVE_COLD_CONVERSATION_PAGE_SIZE;
        if (chunkEnd <= start) continue;
        if (chunkStart >= end) break;
        const chunk = JSON.parse(entry.coldPages[at]!) as MessageRecord[];
        messages.push(...chunk.slice(Math.max(0, start - chunkStart), Math.min(chunk.length, end - chunkStart)).map(detach));
      }
      const pendingStart = entry.coldBaseCount + entry.coldPages.length * LIVE_COLD_CONVERSATION_PAGE_SIZE;
      if (pendingStart < end && pendingStart + entry.pendingCold.length > start) {
        messages.push(...entry.pendingCold.slice(Math.max(0, start - pendingStart),
          Math.min(entry.pendingCold.length, end - pendingStart)).map(detach));
      }
      const recentStart = pendingStart + entry.pendingCold.length;
      if (recentStart < end && recentStart + entry.recent.length > start) {
        messages.push(...entry.recent.slice(Math.max(0, start - recentStart),
          Math.min(entry.recent.length, end - recentStart)).map(detach));
      }
    }
    return { conversationId: id, messages, total, hasOlder: start > 0 };
  }


  /** Optional cold bytes are fetched only for the selected window. */
  public async pageAsync(rawId: string, offset = 0, limit = 30): Promise<{
    conversationId: string; messages: MessageRecord[]; total: number; hasOlder: boolean;
  }> {
    const id = this.normalizeId(rawId);
    const entry = this.records.get(id);
    if (!entry || entry.coldBaseCount === 0) return this.page(id, offset, limit);
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 30;
    const total = entry.total;
    const end = Math.max(0, total - safeOffset);
    const start = Math.max(0, end - safeLimit);
    if (start >= entry.coldBaseCount || start === end) {
      return this.page(id, offset, limit);
    }
    const coldEnd = Math.min(end, entry.coldBaseCount);
    const older = await readColdMessageRange(entry.coldReader!, id, entry.coldBaseCount,
      start, coldEnd);
    if (this.records.get(id) !== entry || entry.total !== total) {
      throw new Error('Conversation changed during async page read');
    }
    if (entry.coldReadAll) for (const message of older) message.isRead = true;
    const local = end > entry.coldBaseCount
      ? this.page(id, total - end, end - entry.coldBaseCount).messages : [];
    return { conversationId: id, messages: [...older, ...local],
      total, hasOlder: start > 0 };
  }

  public async allMessagesAsync(rawId: string): Promise<MessageRecord[]> {
    const id = this.normalizeId(rawId);
    const entry = this.records.get(id);
    if (!entry) return [];
    const total = entry.total;
    const older = entry.coldBaseCount
      ? await readColdMessageRange(entry.coldReader!, id, entry.coldBaseCount, 0, entry.coldBaseCount)
      : [];
    if (this.records.get(id) !== entry || entry.total !== total) {
      throw new Error('Conversation changed during async export');
    }
    if (entry.coldReadAll) for (const message of older) message.isRead = true;
    return [...older, ...this.allLocalMessages(entry)];
  }

  private allLocalMessages(entry: ConversationRecords): MessageRecord[] {
    return [...entry.coldPages.flatMap(p => (JSON.parse(p) as MessageRecord[]).map(detach)),
      ...entry.pendingCold.map(detach), ...entry.recent.map(detach)];
  }

  public allMessages(rawId: string): MessageRecord[] {
    const id = this.normalizeId(rawId);
    const entry = this.records.get(id);
    if (!entry) return [];
    if (entry.coldBaseCount > 0) throw new Error('Cold history requires async export');
    return [...entry.coldPages.flatMap(p => (JSON.parse(p) as MessageRecord[]).map(detach)),
      ...entry.pendingCold.map(detach), ...entry.recent.map(detach)];
  }

  public unreadCounts(limit = 500, visible: (id: string) => boolean = () => true): Record<string, number> {
    const bounded = Number.isFinite(limit) ? Math.max(0, Math.min(500, Math.floor(limit))) : 500;
    const result: Record<string, number> = {};
    let indexed = 0;
    for (const [id, index] of this.indexes) {
      if (!visible(id)) continue;
      if (indexed >= bounded) break;
      if (index.unread > 0) result[id] = index.unread;
      indexed++;
    }
    return result;
  }

  public unreadTray(maxPreview = 4, visible: (id: string) => boolean = () => true,
    name: (id: string) => string = id => id): {
    unreadCount: number;
    previews: Array<{ id: string; buddyId: string; buddyName: string; text: string }>;
  } {
    const limit = Number.isFinite(maxPreview) ? Math.max(0, Math.min(10, Math.floor(maxPreview))) : 4;
    let unreadCount = 0;
    const newest: Array<{ id: string; buddyId: string; buddyName: string; text: string; minute: number }> = [];
    for (const [id, index] of this.indexes) {
      if (!visible(id)) continue;
      unreadCount += index.unread;
      if (limit === 0) continue;
      for (const message of index.unreadPreview) {
        newest.push({
          id: message.id, buddyId: id, buddyName: name(id), text: message.text, minute: message.timestampMinute,
        });
        newest.sort((a, b) => b.minute - a.minute || b.id.localeCompare(a.id));
        if (newest.length > limit) newest.pop();
      }
    }
    return { unreadCount, previews: newest.map(({ id, buddyId, buddyName, text }) => ({ id, buddyId, buddyName, text })) };
  }

  public summary(rawId: string): { lastMessageMinute: number | null; unread: number } {
    const index = this.indexes.get(this.normalizeId(rawId));
    return { lastMessageMinute: index?.lastMessageMinute ?? null, unread: Math.min(9999, index?.unread ?? 0) };
  }

  public hasMessageOnDay(rawId: string, day: number): boolean {
    return Number.isInteger(day) && (this.indexes.get(this.normalizeId(rawId))?.daySet.has(day) ?? false);
  }

  public lastOfflineMessage(rawId: string): string | null {
    return this.indexes.get(this.normalizeId(rawId))?.lastOfflineText ?? null;
  }

  public lastActivity(rawId: string): number {
    return this.indexes.get(this.normalizeId(rawId))?.lastActivityMinute ?? 0;
  }

  public lastPlayerMessageMinute(): number { return this.lastPlayerMinute; }
  public playerWroteOnDay(day: number): boolean {
    return this.playerDays.has(Math.max(1, Math.floor(day) || 1));
  }

  /** Explicit instrumentation: count retained body objects, not storage bytes. */
  public getStorageFootprint(rawId: string): {
    total: number; materialized: number; serializedPages: number;
  } {
    const entry = this.records.get(this.normalizeId(rawId));
    return entry
      ? { total: entry.total, materialized: entry.pendingCold.length + entry.recent.length,
          serializedPages: entry.coldPages.length }
      : { total: 0, materialized: 0, serializedPages: 0 };
  }

  private normalizeMessage(m: MessageRecord): MessageRecord {
    return {
      ...detach(m),
      conversationId: this.normalizeId(m.conversationId),
      senderId: m.senderId === 'player' ? 'player' : this.normalizeId(m.senderId),
      recipientId: m.recipientId === 'player' ? 'player' : this.normalizeId(m.recipientId),
    };
  }

  /** Deterministic cached summaries built from the same authoritative message. */
  private track(index: ConversationIndex, id: string, message: MessageRecord): void {
    index.lastMessageMinute = message.timestampMinute;
    if (Number.isFinite(message.timestampMinute)) {
      index.lastActivityMinute = Math.max(index.lastActivityMinute, message.timestampMinute);
    }
    index.daySet.add(message.day);
    if (!message.isRead) index.anyUnread++;
    if (message.senderId !== 'player' && !message.isRead) {
      index.unread++;
      index.unreadPreview.push(message);
      index.unreadPreview.sort(ranked);
      if (index.unreadPreview.length > UNREAD_PREVIEW_CAP) index.unreadPreview.pop();
    }
    if (message.senderId === 'player' && Number.isFinite(message.timestampMinute)) {
      index.lastPlayerMinute = Math.max(index.lastPlayerMinute, message.timestampMinute);
      index.playerDays.add(Math.floor(message.timestampMinute / 1440) + 1);
    }
    if (message.senderId === id && message.tags?.includes('offline-message')) {
      index.lastOfflineText = message.text;
    }
  }

  /** Derive cross-contact player activity solely from small per-contact indices. */
  private rebuildGlobalPlayerIndex(): void {
    this.lastPlayerMinute = 0;
    this.playerDays.clear();
    for (const index of this.indexes.values()) {
      this.lastPlayerMinute = Math.max(this.lastPlayerMinute, index.lastPlayerMinute);
      for (const day of index.playerDays) this.playerDays.add(day);
    }
  }
}
