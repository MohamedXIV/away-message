// GENERATED — do not edit by hand.
// Source: content/store.json. Regenerate: npm run content:pull.

export interface GeneratedDistrictDefinition { id: string; displayName: string; mapX: number; mapY: number }
export interface GeneratedPlaceAccessStop { stopId: string; walkMinutes: number }
export interface GeneratedPlaceDefinition { id: string; displayName: string; districtId: string; accessStops: GeneratedPlaceAccessStop[] }
export interface GeneratedTransitStopDefinition { id: string; displayName: string; districtId: string; placeId: string }
export interface GeneratedBusLineDefinition { id: string; displayName: string; stopIds: string[]; segmentMinutes: number[]; serviceStartMinute: number; serviceEndMinute: number; headwayMinutes: number; fareCents: number }

export const GENERATED_DISTRICTS: GeneratedDistrictDefinition[] = [
];

export const GENERATED_PLACES: GeneratedPlaceDefinition[] = [
];

export const GENERATED_TRANSIT_STOPS: GeneratedTransitStopDefinition[] = [
];

export const GENERATED_BUS_LINES: GeneratedBusLineDefinition[] = [
];

