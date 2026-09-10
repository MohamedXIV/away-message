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
