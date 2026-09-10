import type { ContentTables } from './codegen';

function q(value: unknown): string {
  return JSON.stringify(String(value ?? ''));
}

function jsonArray<T>(value: unknown): T[] {
  const parsed: unknown = JSON.parse(String(value ?? '[]'));
  return Array.isArray(parsed) ? parsed as T[] : [];
}

/** Deterministic TypeScript runtime registry for authored physical geography. */
export function generateWorldRegistrySource(tables: ContentTables): string {
  const districts = tables['districtDefinitions'] ?? {};
  const places = tables['placeDefinitions'] ?? {};
  const stops = tables['transitStopDefinitions'] ?? {};
  const lines = tables['busLineDefinitions'] ?? {};
  const out: string[] = [
    '// GENERATED — do not edit by hand.',
    '// Source: content/store.json. Regenerate: npm run content:pull.',
    '',
    'export interface GeneratedDistrictDefinition { id: string; displayName: string; mapX: number; mapY: number }',
    'export interface GeneratedPlaceAccessStop { stopId: string; walkMinutes: number }',
    'export interface GeneratedPlaceDefinition { id: string; displayName: string; districtId: string; accessStops: GeneratedPlaceAccessStop[] }',
    'export interface GeneratedTransitStopDefinition { id: string; displayName: string; districtId: string; placeId: string }',
    'export interface GeneratedBusLineDefinition { id: string; displayName: string; stopIds: string[]; segmentMinutes: number[]; serviceStartMinute: number; serviceEndMinute: number; headwayMinutes: number; fareCents: number }',
    '',
    'export const GENERATED_DISTRICTS: GeneratedDistrictDefinition[] = [',
  ];

  for (const id of Object.keys(districts).sort()) {
    const row = districts[id]!;
    out.push(`  { id: ${q(id)}, displayName: ${q(row['displayName'])}, mapX: ${Number(row['mapX'] ?? 0)}, mapY: ${Number(row['mapY'] ?? 0)} },`);
  }
  out.push('];', '', 'export const GENERATED_PLACES: GeneratedPlaceDefinition[] = [');
  for (const id of Object.keys(places).sort()) {
    const row = places[id]!;
    const access = jsonArray<{ stopId: string; walkMinutes: number }>(row['accessStops']);
    out.push(`  { id: ${q(id)}, displayName: ${q(row['displayName'])}, districtId: ${q(row['districtId'])}, accessStops: ${JSON.stringify(access)} },`);
  }
  out.push('];', '', 'export const GENERATED_TRANSIT_STOPS: GeneratedTransitStopDefinition[] = [');
  for (const id of Object.keys(stops).sort()) {
    const row = stops[id]!;
    out.push(`  { id: ${q(id)}, displayName: ${q(row['displayName'])}, districtId: ${q(row['districtId'])}, placeId: ${q(row['placeId'])} },`);
  }
  out.push('];', '', 'export const GENERATED_BUS_LINES: GeneratedBusLineDefinition[] = [');
  for (const id of Object.keys(lines).sort()) {
    const row = lines[id]!;
    const stopIds = jsonArray<string>(row['stopIds']);
    const segmentMinutes = jsonArray<number>(row['segmentMinutes']);
    out.push(`  { id: ${q(id)}, displayName: ${q(row['displayName'])}, stopIds: ${JSON.stringify(stopIds)}, segmentMinutes: ${JSON.stringify(segmentMinutes)}, serviceStartMinute: ${Number(row['serviceStartMinute'])}, serviceEndMinute: ${Number(row['serviceEndMinute'])}, headwayMinutes: ${Number(row['headwayMinutes'])}, fareCents: ${Number(row['fareCents'])} },`);
  }
  out.push('];', '');
  return `${out.join('\n')}\n`;
}
