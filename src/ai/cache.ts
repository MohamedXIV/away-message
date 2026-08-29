import { db } from '../persistence/db';
import type { AICacheRecord } from '../persistence/schema';

export const AI_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000;

export async function readAICache<T>(key: string): Promise<AICacheRecord & { payload: T } | null> {
  const record = await db.ai_cache.get(key);
  if (!record) return null;

  if (record.expiresAt <= Date.now()) {
    await db.ai_cache.delete(key);
    return null;
  }

  return record as AICacheRecord & { payload: T };
}

export async function writeAICache(
  record: Omit<AICacheRecord, 'createdAt' | 'expiresAt'> & Partial<Pick<AICacheRecord, 'createdAt' | 'expiresAt'>>
): Promise<void> {
  const now = Date.now();
  await db.ai_cache.put({
    ...record,
    createdAt: record.createdAt ?? now,
    expiresAt: record.expiresAt ?? now + AI_CACHE_TTL_MS,
  });
}

export async function pruneAICache(): Promise<number> {
  const expired = await db.ai_cache.where('expiresAt').belowOrEqual(Date.now()).toArray();
  if (expired.length > 0) {
    await db.ai_cache.bulkDelete(expired.map((record) => record.key));
  }
  return expired.length;
}
