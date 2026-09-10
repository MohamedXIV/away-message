export function buildLightProfileRow(
  name: string,
  timeOfDay: string,
  colorTint: string,
  intensity: number,
) {
  return {
    name: name.trim(),
    timeOfDay: timeOfDay.trim(),
    colorTint: colorTint.trim(),
    intensity,
    tags: '[]',
  };
}

export function buildAudioProfileRow(
  name: string,
  kind: 'ambience' | 'sfx' | 'music' | 'other',
  assetId: string,
  volume: number,
  assetIds: readonly string[],
) {
  if (assetId && !assetIds.includes(assetId)) {
    throw new Error(`Unknown audio asset '${assetId}'`);
  }
  return {
    name: name.trim(),
    kind,
    assetId: assetId.trim(),
    volume,
    tags: '[]',
  };
}

export function buildAmbientProfileRow(
  name: string,
  weather: string,
  timeOfDay: string,
  density: number,
) {
  return {
    name: name.trim(),
    weather: weather.trim(),
    timeOfDay: timeOfDay.trim(),
    density,
    tags: '[]',
  };
}
