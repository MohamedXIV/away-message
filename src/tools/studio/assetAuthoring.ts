export function validateNormalMapReference(
  normalMapAssetId: string,
  assetIds: readonly string[],
): boolean {
  if (!normalMapAssetId) return true;
  return assetIds.includes(normalMapAssetId);
}

export function buildAssetRow(
  name: string,
  kind: 'image' | 'model' | 'audio' | 'other',
  uri: string,
  normalMapAssetId: string,
  assetIds: readonly string[],
) {
  if (normalMapAssetId && !validateNormalMapReference(normalMapAssetId, assetIds)) {
    throw new Error(`Unknown normal-map asset '${normalMapAssetId}'`);
  }
  return {
    name: name.trim(),
    kind,
    uri: uri.trim(),
    normalMapAssetId: normalMapAssetId.trim(),
    tags: '[]',
  };
}
