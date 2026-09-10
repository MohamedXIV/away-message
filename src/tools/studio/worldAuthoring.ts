export function normalizeWorldContentId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildDistrictRow(name: string) {
  return {
    name: name.trim(),
    mapX: 50,
    mapY: 50,
    tags: '[]',
  };
}

export function buildPlaceRow(name: string, districtId: string, districtIds: readonly string[]) {
  if (!districtIds.includes(districtId)) {
    throw new Error(`Unknown district '${districtId}'`);
  }

  return {
    districtId,
    name: name.trim(),
    transitAccess: '[]',
  };
}
