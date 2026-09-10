export function buildItemRow(name: string) {
  return {
    name: name.trim(),
    kind: 'misc',
    portable: true,
    volume: 1,
    assetId: '',
    tags: '[]',
  };
}

export function buildContainerRow(name: string) {
  return {
    name: name.trim(),
    capacity: 1,
    allowedItemKinds: '[]',
    tags: '[]',
  };
}

export function serializeSemanticList(values: readonly string[]): string {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return JSON.stringify(normalized);
}

export function parseSemanticList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}
