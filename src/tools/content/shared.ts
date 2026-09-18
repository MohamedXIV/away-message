// Shared contracts and deterministic helpers for the authored-content compiler.
// Phase A (#99): behavior-preserving extraction from codegen.ts.

export type ContentTables = Record<string, Record<string, Record<string, unknown>>>;

export function validateCharacterId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'Character id must be a non-empty string.' };
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return { ok: false, error: 'Character id must be snake_case: start with a letter, a-z/0-9/_, 2..32 chars.' };
  }
  const reserved = ['player', 'system', 'you', 'me', 'unknown'];
  if (reserved.includes(id)) return { ok: false, error: `Character id '${id}' is reserved.` };
  return { ok: true };
}

/** Stable world-content ids (districts, places, stops, lines): same shape as character ids. */
export function validateWorldId(id: string): { ok: boolean; error?: string } {
  if (!id || typeof id !== 'string') return { ok: false, error: 'World id must be a non-empty string.' };
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(id)) {
    return { ok: false, error: 'World id must be snake_case: start with a letter, a-z/0-9/_, 2..32 chars.' };
  }
  return { ok: true };
}


/** Parse raw JSON text into tables (structural check only). */
export function parseContentJson(raw: string): ContentTables {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('content/store.json is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('content/store.json must be a tables object.');
  }
  return parsed as ContentTables;
}


/** Stable 8-hex digest of canonical tables (the content version stamp). */
export function contentHash(tables: ContentTables): string {
  const str = JSON.stringify(canonicalize(tables));
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')).slice(0, 8);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function tsString(value: string): string {
  return JSON.stringify(value);
}

