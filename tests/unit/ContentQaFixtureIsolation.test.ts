// tests/unit/ContentQaFixtureIsolation.test.ts
//
// Issue #167 / PR #198 review item 2 — the QA spike fixture (`room_spike_a`,
// `spike_room_main`, `spike_room_view`) lives in the same canonical catalog
// as player-facing world content, so its isolation must be enforced by the
// content pipeline itself, not by convention.
//
// These tests prove three things:
//   1. The shipped store validates with zero errors and the spike place is
//      an explicitly marked QA fixture with no player-facing hooks.
//   2. The generated registries carry the marker, and the player-facing
//      surfaces (town map, spatial presence, housing, transit) stay clean.
//   3. Every leak a future edit could introduce is rejected loudly by the
//      validators (spatial geometry, transit stop, legacy alias, housing
//      offer, shop fixture, venue station, view-neighbor crossing).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseContentJson, validateContent } from '../../src/tools/content/codegen';
import type { ContentTables } from '../../src/tools/content/shared';
import {
  GENERATED_PLACES,
  GENERATED_SPACES,
  GENERATED_VIEWS,
} from '../../src/engine/worldContent.generated';
import { GENERATED_SPATIAL_WORLD } from '../../src/engine/spatial/GeneratedSpatialWorld';

const SPIKE_PLACE = 'room_spike_a';
const SPIKE_SPACE = 'spike_room_main';
const SPIKE_VIEW = 'spike_room_view';

type Row = Record<string, unknown>;
type Table = Record<string, Row>;

function loadStoreTables(): ContentTables {
  const json = readFileSync(new URL('../../content/store.json', import.meta.url), 'utf8');
  return parseContentJson(json);
}

const tableOf = (tables: ContentTables, name: string): Table =>
  (tables as unknown as Record<string, Table>)[name]!;

/**
 * Validate a fresh copy of the real store with one leak introduced. The
 * mutation runs against the copy, so nothing can leak back into later tests.
 */
function withLeak(introduce: (tables: ContentTables) => void): string[] {
  const tables = loadStoreTables();
  introduce(tables);
  return validateContent(tables);
}

describe('shipped QA fixture content', () => {
  it('the real store passes every validator, including the QA isolation rules', () => {
    expect(validateContent(loadStoreTables())).toEqual([]);
  });

  it('the spike place is an explicit QA fixture with no player-facing hooks', () => {
    const place = GENERATED_PLACES.find((candidate) => candidate.id === SPIKE_PLACE);
    expect(place).toBeDefined();
    expect(place?.qaFixture).toBe(true);
    expect(place?.transitAccess).toEqual([]);
    expect(place?.legacyIds).toEqual([]);
    expect(place?.spatialBounds).toBeUndefined();
    expect(place?.entryPosition).toBeUndefined();

    const space = GENERATED_SPACES.find((candidate) => candidate.id === SPIKE_SPACE);
    expect(space?.placeId).toBe(SPIKE_PLACE);
    expect(space?.spatialBounds).toBeUndefined();
    expect(space?.entryPosition).toBeUndefined();

    const view = GENERATED_VIEWS.find((candidate) => candidate.id === SPIKE_VIEW);
    expect(view?.spaceId).toBe(SPIKE_SPACE);
    expect(view?.neighbors).toEqual([]);
  });

  it('marks exactly one place in the catalog as a QA fixture', () => {
    const flagged = GENERATED_PLACES.filter((place) => place.qaFixture === true);
    expect(flagged.map((place) => place.id)).toEqual([SPIKE_PLACE]);
  });

  it('keeps the spike out of the player-facing town map and spatial presence', () => {
    const entries = [...GENERATED_SPATIAL_WORLD.places, ...GENERATED_SPATIAL_WORLD.spaces];
    expect(entries.some((entry) => entry.placeId === SPIKE_PLACE)).toBe(false);
  });

  it('keeps the spike unreachable through housing, shops, venues, transit, and aliases', () => {
    const rows = (name: string) => Object.entries(tableOf(loadStoreTables(), name));
    expect(rows('housingOffers').some(([, row]) => row['placeId'] === SPIKE_PLACE)).toBe(false);
    expect(rows('shopFixtures').some(([, row]) => row['placeId'] === SPIKE_PLACE)).toBe(false);
    expect(
      rows('venueStations').some(([, row]) => row['placeId'] === SPIKE_PLACE || row['spaceId'] === SPIKE_SPACE),
    ).toBe(false);
    expect(rows('transitStops').some(([, row]) => row['placeId'] === SPIKE_PLACE)).toBe(false);
    expect(
      rows('places').some(
        ([id, row]) => id !== SPIKE_PLACE && Array.isArray(row['legacyIds']) && row['legacyIds'].includes(SPIKE_PLACE),
      ),
    ).toBe(false);
    // The fixture view is an island: it has no neighbors, and no
    // player-facing view links into it.
    for (const [id, row] of rows('views')) {
      const neighbors = Array.isArray(row['neighbors']) ? (row['neighbors'] as unknown[]) : [];
      if (id === SPIKE_VIEW) expect(neighbors).toEqual([]);
      else expect(neighbors).not.toContain(SPIKE_VIEW);
    }
  });

  it('carries the qaFixture marker through the generated registry source', () => {
    const source = readFileSync(new URL('../../src/engine/worldContent.generated.ts', import.meta.url), 'utf8');
    expect(source).toContain('qaFixture: true,');
    // Only emitted when true, so no churn on the other rows.
    expect(source.match(/qaFixture: true,/g)).toHaveLength(1);
  });
});

describe('QA fixture isolation leaks fail validation loudly', () => {
  it('rejects town-map geometry on a fixture place', () => {
    const errors = withLeak((tables) => {
      tableOf(tables, 'places')[SPIKE_PLACE]!['spatialBounds'] = {
        polygon: [{ x: 15, y: 55 }, { x: 25, y: 55 }, { x: 25, y: 65 }, { x: 15, y: 65 }],
        minZ: 0,
        maxZ: 0,
        priority: 0,
      };
    });
    expect(errors.some((e) => e.includes(`places/${SPIKE_PLACE}`) && e.includes('spatialBounds'))).toBe(true);
  });

  it('rejects a spatial-presence entry point on a fixture place', () => {
    const errors = withLeak((tables) => {
      tableOf(tables, 'places')[SPIKE_PLACE]!['entryPosition'] = { x: 20, y: 60, z: 0 };
    });
    expect(errors.some((e) => e.includes(`places/${SPIKE_PLACE}`) && e.includes('entryPosition'))).toBe(true);
  });

  it('rejects a transit stop that points at the fixture place', () => {
    const errors = withLeak((tables) => {
      const stops = tableOf(tables, 'transitStops');
      stops[Object.keys(stops)[0]!]!['placeId'] = SPIKE_PLACE;
    });
    expect(errors.some((e) => e.includes('transitStops/') && e.includes(SPIKE_PLACE))).toBe(true);
  });

  it('rejects a legacy alias that would smuggle the fixture place into lookups', () => {
    const errors = withLeak((tables) => {
      const places = tableOf(tables, 'places');
      const other = Object.entries(places).find(([id, row]) => id !== SPIKE_PLACE && row['qaFixture'] !== true);
      (other![1]['legacyIds'] as string[]).push(SPIKE_PLACE);
    });
    expect(errors.some((e) => e.includes('legacyIds') && e.includes(SPIKE_PLACE))).toBe(true);
  });

  it('rejects a housing offer that targets the fixture place', () => {
    const errors = withLeak((tables) => {
      tableOf(tables, 'housingOffers')['starter_room_104']!['placeId'] = SPIKE_PLACE;
    });
    expect(errors.some((e) => e.includes('housingOffers/') && e.includes(SPIKE_PLACE))).toBe(true);
  });

  it('rejects a shop fixture that targets the fixture place', () => {
    const errors = withLeak((tables) => {
      const fixtures = tableOf(tables, 'shopFixtures');
      fixtures[Object.keys(fixtures)[0]!]!['placeId'] = SPIKE_PLACE;
    });
    expect(errors.some((e) => e.includes('shopFixtures/') && e.includes(SPIKE_PLACE))).toBe(true);
  });

  it('rejects a venue station placed on the fixture place or space', () => {
    const viaPlace = withLeak((tables) => {
      const stations = tableOf(tables, 'venueStations');
      stations[Object.keys(stations)[0]!]!['placeId'] = SPIKE_PLACE;
    });
    expect(viaPlace.some((e) => e.includes('venueStations/') && e.includes(SPIKE_PLACE))).toBe(true);

    const viaSpace = withLeak((tables) => {
      const stations = tableOf(tables, 'venueStations');
      stations[Object.keys(stations)[0]!]!['spaceId'] = SPIKE_SPACE;
    });
    expect(viaSpace.some((e) => e.includes('venueStations/') && e.includes('QA fixture space'))).toBe(true);
  });

  it('rejects a player-facing view that links into the fixture view', () => {
    const errors = withLeak((tables) => {
      (tableOf(tables, 'views')['view_a1']!['neighbors'] as string[]).push(SPIKE_VIEW);
    });
    expect(errors.some((e) => e.includes('views/view_a1.neighbors') && e.includes(SPIKE_VIEW))).toBe(true);
  });

  it('rejects a fixture view that links out into the player-facing graph', () => {
    const errors = withLeak((tables) => {
      tableOf(tables, 'views')[SPIKE_VIEW]!['neighbors'] = ['view_a1'];
    });
    expect(errors.some((e) => e.includes(`views/${SPIKE_VIEW}.neighbors`) && e.includes('player-facing view graph'))).toBe(true);
  });

  it('does not flag a place that is not marked as a fixture', () => {
    // The invariants key off the qaFixture marker only: ordinary content
    // keeps its town-map geometry and player-facing links untouched.
    const errors = withLeak((tables) => {
      tableOf(tables, 'places')['place_a1']!['name'] = 'Renamed Real Place';
    });
    expect(errors.filter((e) => e.includes('QA fixture'))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
