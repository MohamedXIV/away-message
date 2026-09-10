type PlaceRows = Record<string, { districtId?: unknown }>;

export function buildTransitStopRow(
  name: string,
  districtId: string,
  placeId: string,
  districtIds: readonly string[],
  places: PlaceRows,
) {
  if (!districtIds.includes(districtId)) {
    throw new Error(`Unknown district '${districtId}'`);
  }
  if (placeId) {
    const place = places[placeId];
    if (!place) throw new Error(`Unknown place '${placeId}'`);
    const placeDistrictId = String(place.districtId ?? '');
    if (placeDistrictId !== districtId) {
      throw new Error(`Place '${placeId}' belongs to district '${placeDistrictId}'`);
    }
  }

  return {
    districtId,
    name: name.trim(),
    placeId,
    mapX: 50,
    mapY: 50,
  };
}

export function resizeSegmentMinutes(current: readonly number[], stopCount: number): number[] {
  const required = Math.max(0, stopCount - 1);
  return Array.from({ length: required }, (_, index) => current[index] ?? 10);
}

export function buildBusLineRow(
  name: string,
  stopIds: readonly string[],
  availableStopIds: readonly string[],
) {
  if (stopIds.length < 2) throw new Error('A bus line needs at least two stops');
  for (const stopId of stopIds) {
    if (!availableStopIds.includes(stopId)) throw new Error(`Unknown transit stop '${stopId}'`);
  }

  return {
    name: name.trim(),
    stopIds: JSON.stringify(stopIds),
    serviceStartMinute: 360,
    serviceEndMinute: 1380,
    headwayMinutes: 20,
    segmentMinutes: JSON.stringify(resizeSegmentMinutes([], stopIds.length)),
    fare: 2,
  };
}

export function parseStringList(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function parseNumberList(value: unknown): number[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export interface TransitAccessLink {
  stopId: string;
  walkMinutes: number;
}

export function parseTransitAccess(value: unknown): TransitAccessLink[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is { stopId?: unknown; walkMinutes?: unknown } => Boolean(entry && typeof entry === 'object'))
      .map((entry) => ({
        stopId: String(entry.stopId ?? ''),
        walkMinutes: typeof entry.walkMinutes === 'number' && Number.isFinite(entry.walkMinutes) ? entry.walkMinutes : 5,
      }))
      .filter((link) => link.stopId.length > 0);
  } catch {
    return [];
  }
}

export function serializeTransitAccess(links: readonly TransitAccessLink[]): string {
  return JSON.stringify(
    links.map((link) => ({
      stopId: link.stopId.trim(),
      walkMinutes: Math.max(1, Math.round(link.walkMinutes || 1)),
    })),
  );
}

export function reorderBusLineStops(
  currentStops: readonly string[],
  currentSegments: readonly number[],
  fromIndex: number,
  toIndex: number,
): { stops: string[]; segments: number[] } {
  if (
    fromIndex < 0 ||
    fromIndex >= currentStops.length ||
    toIndex < 0 ||
    toIndex >= currentStops.length ||
    fromIndex === toIndex
  ) {
    return {
      stops: [...currentStops],
      segments: resizeSegmentMinutes(currentSegments, currentStops.length),
    };
  }

  const pairDurations = new Map<string, number>();
  for (let i = 0; i < currentStops.length - 1; i++) {
    const key = `${currentStops[i]}__${currentStops[i + 1]}`;
    if (currentSegments[i] !== undefined) {
      pairDurations.set(key, currentSegments[i]!);
      const revKey = `${currentStops[i + 1]}__${currentStops[i]}`;
      if (!pairDurations.has(revKey)) {
        pairDurations.set(revKey, currentSegments[i]!);
      }
    }
  }

  const nextStops = [...currentStops];
  const [moved] = nextStops.splice(fromIndex, 1);
  nextStops.splice(toIndex, 0, moved!);

  const nextSegments: number[] = [];
  for (let i = 0; i < nextStops.length - 1; i++) {
    const key = `${nextStops[i]}__${nextStops[i + 1]}`;
    const known = pairDurations.get(key);
    nextSegments.push(known !== undefined ? known : (currentSegments[i] ?? 10));
  }

  return {
    stops: nextStops,
    segments: nextSegments,
  };
}

