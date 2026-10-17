import type { MessageRecord } from '../types';

/**
 * #173 — single authoritative conversation owner inside Social.
 *
 * Full transcripts live here, not in relationship/presence bookkeeping.
 * Indices are derived from the same message objects and rebuilt on import;
 * they are never persisted as an independent, drift-prone source of truth.
 * The external public API is intentionally read-only/detached: only Social
 * may append, restore, mark read or delete a conversation.
 *
 * #173's later cold persistence phase can replace this owner without
 * changing Social/Kernel's bounded query and ordering contracts.
 */
export class ConversationHistory {
  private readonly records = new Map<string, MessageRecord[]>();
  private readonly indexes = new Map<string, {
    unread: number;
    lastMessageMinute: number | null;
    lastActivityMinute: number;
    lastPlayerMinute: number;
    daySet: Set<number>;
    unreadMessages: MessageRecord[];
  }>();
  private lastPlayerMinute = 0;
  private readonly playerDays = new Set<number>();

  constructor(private readonly normalizeId: (id: string) => string) {}

  public ensure(rawId: string): void {
    const id = this.normalizeId(rawId);
    if (!this.records.has(id)) {
      this.records.set(id, []);
      this.indexes.set(id, this.emptyIndex());
    }
  }

  public delete(rawId: string): void {
    const id = this.normalizeId(rawId);
    this.records.delete(id);
    this.indexes.delete(id);
    this.rebuildGlobalPlayerIndex();
  }

  /** Called only on explicit snapshot load; replaces all source records. */
  public restore(data: Record<string, MessageRecord[]>): void {
    this.records.clear();
    this.indexes.clear();
    this.lastPlayerMinute = 0;
    this.playerDays.clear();
    for (const [rawId, messages] of Object.entries(data)) {
      const id = this.normalizeId(rawId);
      if (!Array.isArray(messages)) continue;
      const cleaned = messages.map(m => ({
        ...m,
        conversationId: this.normalizeId(m.conversationId),
        senderId: m.senderId === 'player' ? 'player' : this.normalizeId(m.senderId),
        recipientId: m.recipientId === 'player' ? 'player' : this.normalizeId(m.recipientId),
      }));
      this.records.set(id, cleaned);
      this.indexes.set(id, this.buildIndex(cleaned));
    }
    this.rebuildGlobalPlayerIndex();
  }

  /** Persistence/debug only: this is intentionally the expensive whole transcript export. */
  public exportAll(): Record<string, MessageRecord[]> {
    const data: Record<string, MessageRecord[]> = {};
    for (const [id, messages] of this.records) data[id] = messages.map(m => ({ ...m }));
    return data;
  }

  public append(msg: MessageRecord): void {
    const id = this.normalizeId(msg.conversationId);
    this.ensure(id);
    const record = { ...msg };
    this.records.get(id)!.push(record);
    const index = this.indexes.get(id)!;
    index.lastMessageMinute = record.timestampMinute;
    if (Number.isFinite(record.timestampMinute)) {
      index.lastActivityMinute = Math.max(index.lastActivityMinute, record.timestampMinute);
    }
    index.daySet.add(record.day);
    if (record.senderId !== 'player' && !record.isRead) {
      index.unread++;
      index.unreadMessages.push(record);
    }
    if (record.senderId === 'player' && Number.isFinite(record.timestampMinute)) {
      index.lastPlayerMinute = Math.max(index.lastPlayerMinute, record.timestampMinute);
      this.lastPlayerMinute = Math.max(this.lastPlayerMinute, record.timestampMinute);
      this.playerDays.add(Math.floor(record.timestampMinute / 1440) + 1);
    }
  }

  /** Read receipt updates source records and its derived unread index atomically. */
  public markRead(rawId: string): boolean {
    const id = this.normalizeId(rawId);
    const messages = this.records.get(id);
    if (!messages) return false;
    let changed = false;
    for (const message of messages) {
      if (message.isRead) continue;
      message.isRead = true;
      changed = true;
    }
    if (changed) {
      const index = this.indexes.get(id)!;
      index.unread = 0;
      index.unreadMessages.length = 0;
    }
    return changed;
  }

  public page(rawId: string, offset = 0, limit = 30): {
    conversationId: string;
    messages: MessageRecord[];
    total: number;
    hasOlder: boolean;
  } {
    const id = this.normalizeId(rawId);
    const records = this.records.get(id) ?? [];
    const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 30;
    const end = Math.max(0, records.length - safeOffset);
    const start = Math.max(0, end - safeLimit);
    return {
      conversationId: id,
      messages: records.slice(start, end).map(m => ({
        ...m, ...(m.tags ? { tags: [...m.tags] } : {}),
      })),
      total: records.length,
      hasOlder: start > 0,
    };
  }

  public allMessages(rawId: string): MessageRecord[] {
    return (this.records.get(this.normalizeId(rawId)) ?? []).map(m => ({ ...m }));
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
      for (const message of index.unreadMessages) {
        newest.push({
          id: message.id, buddyId: id, buddyName: name(id),
          text: message.text, minute: message.timestampMinute,
        });
        newest.sort((a, b) => b.minute - a.minute || b.id.localeCompare(a.id));
        if (newest.length > limit) newest.pop();
      }
    }
    return {
      unreadCount,
      previews: newest.map(({ id, buddyId, buddyName, text }) => ({ id, buddyId, buddyName, text })),
    };
  }

  public summary(rawId: string): { lastMessageMinute: number | null; unread: number } {
    const index = this.indexes.get(this.normalizeId(rawId));
    return { lastMessageMinute: index?.lastMessageMinute ?? null, unread: Math.min(9999, index?.unread ?? 0) };
  }

  public hasMessageOnDay(rawId: string, day: number): boolean {
    return Number.isInteger(day) && (this.indexes.get(this.normalizeId(rawId))?.daySet.has(day) ?? false);
  }

  public lastOfflineMessage(rawId: string): string | null {
    const id = this.normalizeId(rawId);
    const messages = this.records.get(id);
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]!;
      if (message.senderId === id && message.tags?.includes('offline-message')) return message.text;
    }
    return null;
  }

  public lastActivity(rawId: string): number {
    return this.indexes.get(this.normalizeId(rawId))?.lastActivityMinute ?? 0;
  }

  public lastPlayerMessageMinute(): number { return this.lastPlayerMinute; }

  public playerWroteOnDay(day: number): boolean {
    return this.playerDays.has(Math.max(1, Math.floor(day) || 1));
  }

  private emptyIndex() {
    return {
      unread: 0, lastMessageMinute: null as number | null,
      lastActivityMinute: 0, lastPlayerMinute: 0,
      daySet: new Set<number>(), unreadMessages: [] as MessageRecord[],
    };
  }

  private buildIndex(messages: MessageRecord[]): ReturnType<ConversationHistory['emptyIndex']> {
    const index = this.emptyIndex();
    for (const message of messages) {
      index.lastMessageMinute = message.timestampMinute;
      if (Number.isFinite(message.timestampMinute)) {
        index.lastActivityMinute = Math.max(index.lastActivityMinute, message.timestampMinute);
      }
      index.daySet.add(message.day);
      if (message.senderId !== 'player' && !message.isRead) {
        index.unread++;
        index.unreadMessages.push(message);
      }
      if (message.senderId === 'player' && Number.isFinite(message.timestampMinute)) {
        index.lastPlayerMinute = Math.max(index.lastPlayerMinute, message.timestampMinute);
      }
    }
    return index;
  }

  private rebuildGlobalPlayerIndex(): void {
    this.lastPlayerMinute = 0;
    this.playerDays.clear();
    for (const [id, messages] of this.records) {
      const index = this.indexes.get(id);
      if (index) this.lastPlayerMinute = Math.max(this.lastPlayerMinute, index.lastPlayerMinute);
      for (const msg of messages) {
        if (msg.senderId !== 'player' || !Number.isFinite(msg.timestampMinute)) continue;
        this.playerDays.add(Math.floor(msg.timestampMinute / 1440) + 1);
      }
    }
  }
}
