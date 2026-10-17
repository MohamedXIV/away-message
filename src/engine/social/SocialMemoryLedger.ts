import type { CoreMemory, PromiseRecord, SocialEngineState } from '../types';
import { parseCoreMemoryMeaning } from '../semantic/CoreMemoryMeaning';

// Social-authoritative limits. Never persist derived indices/relationships here.
export const MAX_CORE_MEMORIES = 8;
export const MAX_OPEN_PROMISES = 5;
export const MAX_PHOTO_MEMORIES = 3;

export function socialHashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function sanitize(text: string, max: number): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, max);
}

function validKind(kind: unknown): kind is CoreMemory['kind'] {
  return kind === 'fact' || kind === 'promise_kept' || kind === 'promise_broken'
    || kind === 'first_meeting' || kind === 'shared_moment' || kind === 'shared_photo';
}

/**
 * One source-owned memory/commitment ledger. Core memories and commitments are
 * canonical facts, not copies of relationship values or private AI summaries.
 *
 * SocialEngine owns external effects (relationship, player belief, EventBus).
 * This owner only validates, writes, and projects its own records. This makes
 * #187 semantic provenance explicit without duplicating social authority.
 */
export class SocialMemoryLedger {
  private readonly memories = new Map<string, CoreMemory[]>();
  private readonly promises = new Map<string, PromiseRecord[]>();

  constructor(
    private readonly normalizeId: (rawId: string) => string,
    private readonly actorExists: (id: string) => boolean,
  ) {}

  public forget(rawId: string): void {
    const id = this.normalizeId(rawId);
    this.memories.delete(id);
    this.promises.delete(id);
  }

  /** Snapshot/persistence boundary only; keep current SocialEngineState shape. */
  public exportState(): Pick<SocialEngineState, 'coreMemories' | 'promises'> {
    const coreMemories: Record<string, CoreMemory[]> = {};
    for (const [id, items] of this.memories) {
      coreMemories[id] = items.map(m => ({
        ...m, ...(m.meaning ? { meaning: parseCoreMemoryMeaning(m.meaning) } : {}),
      }));
    }
    const promises: Record<string, PromiseRecord[]> = {};
    for (const [id, items] of this.promises) promises[id] = items.map(p => ({ ...p }));
    return { coreMemories, promises };
  }

  public restoreState(source: Pick<SocialEngineState, 'coreMemories' | 'promises'>): void {
    this.memories.clear();
    if (source.coreMemories) {
      for (const [rawId, items] of Object.entries(source.coreMemories)) {
        const id = this.normalizeId(rawId);
        if (!Array.isArray(items)) continue;
        const clean: CoreMemory[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const text = sanitize(String((item as CoreMemory).text ?? ''), 160);
          const kind = (item as CoreMemory).kind;
          if (text.length < 3 || !validKind(kind)) continue;
          if (clean.some(c => c.text.toLowerCase() === text.toLowerCase())) continue;
          const meaning = parseCoreMemoryMeaning((item as CoreMemory).meaning);
          clean.push({
            id: String((item as CoreMemory).id || `cm_${clean.length}`), text, kind,
            day: Number.isFinite((item as CoreMemory).day)
              ? Math.max(1, Math.floor((item as CoreMemory).day)) : 1,
            ...(meaning ? { meaning } : {}),
          });
          if (clean.length >= MAX_CORE_MEMORIES) break;
        }
        if (clean.length > 0) this.memories.set(id, clean);
      }
    }
    this.promises.clear();
    if (source.promises) {
      for (const [rawId, items] of Object.entries(source.promises)) {
        const id = this.normalizeId(rawId);
        if (!Array.isArray(items)) continue;
        const clean: PromiseRecord[] = [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const text = sanitize(String((item as PromiseRecord).text ?? ''), 140);
          const status = (item as PromiseRecord).status;
          if (text.length < 8 || (status !== 'open' && status !== 'kept' && status !== 'broken')) continue;
          const dueDay = (item as PromiseRecord).dueDay;
          clean.push({
            id: String((item as PromiseRecord).id || `pr_${clean.length}`),
            text, status,
            createdDay: Number.isFinite((item as PromiseRecord).createdDay)
              ? Math.max(1, Math.floor((item as PromiseRecord).createdDay)) : 1,
            ...(Number.isFinite(dueDay) ? { dueDay: Math.max(1, Math.floor(dueDay as number)) } : {}),
          });
        }
        if (clean.length > 0) this.promises.set(id, clean);
      }
    }
  }

  public addMemory(rawBuddyId: string,
    memory: { text: string; kind: CoreMemory['kind']; day: number; meaning?: CoreMemory['meaning'] },
  ): CoreMemory | null {
    const id = this.normalizeId(rawBuddyId);
    if (!this.actorExists(id) || !validKind(memory.kind)) return null;
    const text = sanitize(memory.text, 160);
    if (text.length < 3) return null;
    const existing = this.memories.get(id) || [];
    if (existing.some(m => m.text.toLowerCase() === text.toLowerCase())) return null;
    const record: CoreMemory = {
      id: `cm_${id}_${socialHashText(`${id}:${memory.kind}:${memory.day}:${text}`).toString(36)}`,
      text, kind: memory.kind,
      day: Math.max(1, Math.floor(memory.day) || 1),
      ...(memory.meaning && parseCoreMemoryMeaning(memory.meaning)
        ? { meaning: parseCoreMemoryMeaning(memory.meaning) } : {}),
    };
    const next = [...existing, record];
    while (next.length > MAX_CORE_MEMORIES) {
      const evictIndex = next.findIndex(m => m.kind !== 'first_meeting');
      next.splice(evictIndex === -1 ? 0 : evictIndex, 1);
    }
    this.memories.set(id, next);
    return { ...record, ...(record.meaning ? { meaning: parseCoreMemoryMeaning(record.meaning) } : {}) };
  }

  public getMemories(rawBuddyId: string): CoreMemory[] {
    return (this.memories.get(this.normalizeId(rawBuddyId)) || []).map(m => ({
      ...m, ...(m.meaning ? { meaning: parseCoreMemoryMeaning(m.meaning) } : {}),
    }));
  }

  public photoCount(rawBuddyId: string): number {
    return (this.memories.get(this.normalizeId(rawBuddyId)) ?? [])
      .filter(m => m.kind === 'shared_photo').length;
  }

  public addPromise(rawBuddyId: string, text: string, createdDay: number, dueDay?: number): PromiseRecord | null {
    const id = this.normalizeId(rawBuddyId);
    if (!this.actorExists(id)) return null;
    const clean = sanitize(text, 140);
    if (clean.length < 8) return null;
    const existing = this.promises.get(id) || [];
    if (existing.some(p => p.status === 'open' && p.text.toLowerCase() === clean.toLowerCase())) return null;
    const record: PromiseRecord = {
      id: `pr_${id}_${socialHashText(`${id}:${createdDay}:${clean}`).toString(36)}`,
      text: clean, status: 'open',
      createdDay: Math.max(1, Math.floor(createdDay) || 1),
      ...(Number.isFinite(dueDay) ? { dueDay: Math.max(1, Math.floor(dueDay as number)) } : {}),
    };
    const next = [...existing, record];
    const open = next.filter(p => p.status === 'open');
    while (open.length > MAX_OPEN_PROMISES) {
      const oldest = open.shift()!;
      const index = next.indexOf(oldest);
      if (index !== -1) next.splice(index, 1);
    }
    this.promises.set(id, next);
    return { ...record };
  }

  public getPromises(rawBuddyId: string): PromiseRecord[] {
    return (this.promises.get(this.normalizeId(rawBuddyId)) ?? []).map(p => ({ ...p }));
  }

  public getOpenPromises(rawBuddyId: string): PromiseRecord[] {
    return this.getPromises(rawBuddyId).filter(p => p.status === 'open');
  }

  /** Ledger transition only; caller owns the one semantic side-effect transaction. */
  public closePromise(rawBuddyId: string, promiseId: string, kept: boolean): PromiseRecord | null {
    const list = this.promises.get(this.normalizeId(rawBuddyId));
    if (!list) return null;
    const record = list.find(p => p.id === promiseId);
    if (!record || record.status !== 'open') return null;
    record.status = kept ? 'kept' : 'broken';
    return { ...record };
  }

  /** Returns only due records, copied before SocialEngine applies any effects. */
  public overdue(day: number): Array<{ buddyId: string; promiseId: string }> {
    const due: Array<{ buddyId: string; promiseId: string }> = [];
    for (const [buddyId, list] of this.promises) {
      for (const promise of list) {
        if (promise.status !== 'open' || promise.dueDay === undefined || promise.dueDay >= day) continue;
        due.push({ buddyId, promiseId: promise.id });
      }
    }
    return due;
  }

  public buildLongTermContext(rawBuddyId: string): string {
    const memories = this.getMemories(rawBuddyId);
    const open = this.getOpenPromises(rawBuddyId);
    const memoryLine = memories.length > 0
      ? memories.map(m => `[${m.kind} d${m.day}] ${m.text}`).join(' | ')
      : 'No long-term memories yet.';
    const promiseLine = open.length > 0
      ? open.map(p => `"${p.text}"${p.dueDay !== undefined ? ` (due d${p.dueDay})` : ''}`).join(' | ')
      : 'No open promises.';
    return `LongTerm: ${memoryLine} | OpenPromises: ${promiseLine}`;
  }
}
