export function buildSpaceRow(
  name: string,
  placeId: string,
  placeIds: readonly string[],
) {
  if (!placeIds.includes(placeId)) {
    throw new Error(`Unknown place '${placeId}'`);
  }
  return {
    placeId,
    name: name.trim(),
    tags: '[]',
  };
}

export function buildViewRow(
  name: string,
  spaceId: string,
  spaceIds: readonly string[],
  assetId: string,
  assetIds: readonly string[],
) {
  if (!spaceIds.includes(spaceId)) {
    throw new Error(`Unknown space '${spaceId}'`);
  }
  if (assetId && !assetIds.includes(assetId)) {
    throw new Error(`Unknown asset '${assetId}'`);
  }
  return {
    spaceId,
    name: name.trim(),
    neighbors: '[]',
    assetId,
    tags: '[]',
  };
}

export function buildAnchorRow(
  name: string,
  viewId: string,
  viewIds: readonly string[],
  x: number,
  y: number,
) {
  if (!viewIds.includes(viewId)) {
    throw new Error(`Unknown view '${viewId}'`);
  }
  if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1) {
    throw new Error('Anchor coordinates must be between 0 and 1');
  }
  return {
    viewId,
    name: name.trim(),
    x,
    y,
    tags: '[]',
  };
}

export function buildInteractionRow(
  name: string,
  anchorId: string,
  anchorIds: readonly string[],
  capability: string,
) {
  if (!anchorIds.includes(anchorId)) {
    throw new Error(`Unknown anchor '${anchorId}'`);
  }
  if (!capability.trim()) {
    throw new Error('Interaction requires a capability');
  }
  return {
    anchorId,
    capability: capability.trim(),
    name: name.trim(),
    tags: '[]',
  };
}
