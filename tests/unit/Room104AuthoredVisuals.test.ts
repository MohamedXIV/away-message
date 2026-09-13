// tests/unit/Room104AuthoredVisuals.test.ts
// PR #80 Room 104 authored visual presentation slice (RED-first).
//
// Contract under test:
// - Each Room 104 view carries a unique non-null production image assetId
//   from the normal content pipeline (content/store.json -> generated
//   registries), with a linked shared normal map.
// - A generic projection asset load plan resolves the active/sibling
//   production image assets and linked normal maps, deduplicates the shared
//   normal-map load, emits relative Vite/itch-compatible URLs, and never
//   special-cases Room 104 or falls back to fixture/random/procedural art.
// - Invalid (missing / non-image / non-production) view references are
//   reported and left assetless; invalid or fixture URIs are never queued as
//   production art. Production loading is gated on an explicit
//   "production" tag, so procedural fixture assets never cause HTTP requests.
// - The existing assetless/no-fixture-fallback behavior is preserved
//   (see WorldSceneProjectionCamera.test.ts — not duplicated here).

import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import {
  GENERATED_ASSETS,
  GENERATED_VIEWS,
} from '../../src/engine/worldContent.generated';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';
import type { WorldSceneProjection } from '../../src/world/phaser/types';
import {
  buildProjectionAssetLoadPlan,
  formatProjectionAssetLoadError,
  queueMissingProjectionAssetsForUpdate,
  queueProjectionAssetLoads,
  resolveProductionAssetUrl,
  textureHasLinkedNormalMap,
} from '../../src/world/phaser/projectionAssets';
import { validateContent } from '../../src/tools/content/codegen';
import { cloneTables as clone, validAssetTables } from './worldFixtures';

const DESK_VIEW = 'room104_desk_window';
const BED_VIEW = 'room104_bed_wardrobe';
const ENTRY_VIEW = 'room104_entrance_kitchenette';

const ROOM104_PLATE_FILES = [
  'public/assets/world/room104/room104-desk-window.png',
  'public/assets/world/room104/room104-bed-wardrobe.png',
  'public/assets/world/room104/room104-entrance-kitchenette.png',
];
const ROOM104_NORMAL_FILE = 'public/assets/world/room104/room104-flat-normal.png';

function room104Projection(viewId: string): WorldSceneProjection {
  return createWorldSceneProjection({ placeId: 'room_104', viewId });
}

/**
 * Decodes PNG IHDR dimensions (width/height as big-endian UInt32 at bytes
 * 16/20) after verifying signature + IHDR chunk type. Avoids asserting mere
 * file existence/signature.
 */
function readPngIhdr(bytes: Buffer, file: string): { width: number; height: number; bitDepth: number; colorType: number } {
  expect([...bytes.subarray(0, 8)], `bad PNG signature in ${file}`).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  expect(bytes.subarray(12, 16).toString('ascii'), `missing IHDR in ${file}`).toBe('IHDR');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24]!,
    colorType: bytes[25]!,
  };
}

/** Concatenates IDAT payloads for pixel verification. */
function collectPngIdat(bytes: Buffer): Buffer {
  let pos = 8;
  const parts: Buffer[] = [];
  while (pos + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.subarray(pos + 4, pos + 8).toString('ascii');
    const data = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IDAT') parts.push(Buffer.from(data));
    if (type === 'IEND') break;
    pos += 12 + length;
  }
  return Buffer.concat(parts);
}

describe('Room 104 authored visual production assets (content pipeline)', () => {
  it('ships the three authored plates at 1600x900 plus a flat normal map as runtime files', () => {
    for (const file of ROOM104_PLATE_FILES) {
      expect(existsSync(new URL(`../../${file}`, import.meta.url)), `missing runtime asset file ${file}`).toBe(true);
      const bytes = readFileSync(new URL(`../../${file}`, import.meta.url));
      expect(bytes.length).toBeGreaterThan(0);
      const ihdr = readPngIhdr(bytes, file);
      expect(`${file}: ${ihdr.width}x${ihdr.height}`).toBe(`${file}: 1600x900`);
    }
    // Shared flat normal map: small, power-of-two, tangent-space flat
    // (128, 128, 255). Kept as a pixel check, not mere existence.
    expect(existsSync(new URL(`../../${ROOM104_NORMAL_FILE}`, import.meta.url))).toBe(true);
    const normalBytes = readFileSync(new URL(`../../${ROOM104_NORMAL_FILE}`, import.meta.url));
    expect(normalBytes.length).toBeGreaterThan(0);
    const normalIhdr = readPngIhdr(normalBytes, ROOM104_NORMAL_FILE);
    expect(normalIhdr.width).toBe(64);
    expect(normalIhdr.height).toBe(64);
    expect(normalIhdr.bitDepth).toBe(8);
    expect(normalIhdr.colorType).toBe(2);
    const raw = inflateSync(collectPngIdat(normalBytes));
    const { width, height } = normalIhdr;
    // RGB8: each scanline is 1 filter byte + width*3 bytes.
    expect(raw.length).toBe((width * 3 + 1) * height);
    for (let y = 0; y < height; y += 1) {
      const rowStart = y * (width * 3 + 1);
      for (let x = 0; x < width; x += 1) {
        const r = raw[rowStart + 1 + x * 3]!;
        const g = raw[rowStart + 2 + x * 3]!;
        const b = raw[rowStart + 3 + x * 3]!;
        expect([r, g, b]).toEqual([128, 128, 255]);
      }
    }
  });

  it('gives each Room 104 view a unique non-null production image assetId', () => {
    const byId = new Map(GENERATED_VIEWS.map((view) => [view.id, view]));
    const views = [DESK_VIEW, BED_VIEW, ENTRY_VIEW].map((id) => byId.get(id));
    for (const view of views) {
      expect(view, 'Room 104 view missing from generated registry').toBeDefined();
      expect(typeof view!.assetId).toBe('string');
      expect(view!.assetId).toBeTruthy();
    }
    expect(new Set(views.map((view) => view!.assetId)).size).toBe(3);
  });

  it('resolves each Room 104 assetId to a production image under assets/world/room104/', () => {
    const assets = new Map(GENERATED_ASSETS.map((asset) => [asset.id, asset]));
    const byId = new Map(GENERATED_VIEWS.map((view) => [view.id, view]));
    for (const viewId of [DESK_VIEW, BED_VIEW, ENTRY_VIEW]) {
      const asset = assets.get(byId.get(viewId)!.assetId!);
      expect(asset, `no generated asset for view ${viewId}`).toBeDefined();
      expect(asset!.kind).toBe('image');
      expect(asset!.uri).toMatch(/^assets\/world\/room104\/room104-.*\.png$/);
      expect(asset!.tags).toContain('production');
    }
  });

  it('keeps production Room 104 assets distinguishable from technical fixture assets', () => {
    const assets = new Map(GENERATED_ASSETS.map((asset) => [asset.id, asset]));
    const byId = new Map(GENERATED_VIEWS.map((view) => [view.id, view]));
    const roomAssetIds = [DESK_VIEW, BED_VIEW, ENTRY_VIEW].map((id) => byId.get(id)!.assetId!);
    expect(roomAssetIds).not.toContain('asset_a1');
    expect(roomAssetIds).not.toContain('asset_a1_n');
    // Fixture assets carry no production tag.
    expect(assets.get('asset_a1')!.tags).not.toContain('production');
  });

  it('links every Room 104 diffuse asset to one shared image normal map', () => {
    const assets = new Map(GENERATED_ASSETS.map((asset) => [asset.id, asset]));
    const byId = new Map(GENERATED_VIEWS.map((view) => [view.id, view]));
    const normalIds = [DESK_VIEW, BED_VIEW, ENTRY_VIEW].map(
      (id) => assets.get(byId.get(id)!.assetId!)!.normalMapAssetId,
    );
    for (const normalId of normalIds) {
      expect(normalId).toBeTruthy();
    }
    expect(new Set(normalIds).size).toBe(1);
    const normal = assets.get(normalIds[0]!)!;
    expect(normal.kind).toBe('image');
    expect(normal.uri).toBe('assets/world/room104/room104-flat-normal.png');
  });

  it('projects every Room 104 view to its authored asset plus normal map', () => {
    for (const viewId of [DESK_VIEW, BED_VIEW, ENTRY_VIEW]) {
      const projection = room104Projection(viewId);
      expect(projection.assetId).toBeTruthy();
      expect(projection.normalMapAssetId).toBeTruthy();
    }
  });
});

describe('generic projection asset load plan (no Room 104 special-casing)', () => {
  it('resolves the active view plus authored siblings from generated content', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(DESK_VIEW));
    expect(plan.errors).toEqual([]);
    expect(plan.entries.map((entry) => entry.key).sort()).toEqual(
      [DESK_VIEW, BED_VIEW, ENTRY_VIEW]
        .map((id) => GENERATED_VIEWS.find((view) => view.id === id)!.assetId!)
        .sort(),
    );
  });

  it('deduplicates the shared normal-map load across sibling views', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(BED_VIEW));
    expect(plan.errors).toEqual([]);
    expect(plan.normalMaps).toHaveLength(1);
    expect(plan.normalMaps[0]!.url).toContain('assets/world/room104/room104-flat-normal.png');
    for (const entry of plan.entries) {
      expect(entry.normalMapKey).toBe(plan.normalMaps[0]!.key);
    }
  });

  it('emits relative Vite/itch-compatible URLs for every queued file', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(ENTRY_VIEW));
    const urls = [
      ...plan.entries.map((entry) => entry.url),
      ...plan.normalMaps.map((normal) => normal.url),
    ];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith('/')).toBe(false);
      expect(url).not.toMatch(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
      expect(url).toContain('assets/world/room104/');
    }
  });

  it('resolves production URLs to relative paths without absolute fallbacks', () => {
    expect(resolveProductionAssetUrl('assets/world/room104/room104-desk-window.png')).toBe(
      './assets/world/room104/room104-desk-window.png',
    );
    expect(resolveProductionAssetUrl('/assets/world/room104/room104-desk-window.png')).toBe(
      './assets/world/room104/room104-desk-window.png',
    );
  });

  it('queues each unique texture key once and skips already-loaded keys', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(DESK_VIEW));
    const calls: Array<{ key: string; url: string; raw: unknown }> = [];
    const scene = {
      textures: { exists: (key: string) => key === plan.normalMaps[0]!.key },
      load: {
        image: (key: string, url?: string | string[]) => {
          calls.push({ key, url: Array.isArray(url) ? (url[0] ?? '') : (url ?? ''), raw: url });
        },
      },
    };
    queueProjectionAssetLoads(scene, plan);
    // The pre-existing shared normal map is skipped; every diffuse is queued once.
    expect(calls.map((call) => call.key).sort()).toEqual(
      plan.entries.map((entry) => entry.key).sort(),
    );
    for (const call of calls) {
      expect(call.url.startsWith('/')).toBe(false);
      expect(call.url).toContain('assets/world/room104/');
    }
    // Each diffuse is queued with its linked normal map via Phaser's
    // [diffuse, normal] array form.
    for (const entry of plan.entries) {
      const call = calls.find((candidate) => candidate.key === entry.key);
      expect(call!.raw).toEqual([entry.url, entry.normalMapUrl]);
    }
  });

  it('never queues fixture, procedural, or random art for production projections', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(DESK_VIEW));
    const calls: string[] = [];
    const scene = {
      textures: { exists: () => false },
      load: {
        image: (key: string) => {
          calls.push(key);
        },
      },
    };
    queueProjectionAssetLoads(scene, plan);
    expect(calls.length).toBeGreaterThan(0);
    for (const key of calls) {
      expect(key.toLowerCase()).not.toContain('fixture');
      expect(key).not.toBe('asset_a1');
      expect(key).not.toBe('asset_a1_n');
    }
  });

  it('excludes non-production technical-fixture assets from production loading', () => {
    // Generic registry/tag rule (no Room 104 branch): asset_a1 / asset_a1_n
    // carry no production tag, so the production loader must never request
    // their placeholder URIs. The fixture stays procedural via
    // ensureFixtureTextures; production stays assetless for those keys.
    const projection = createWorldSceneProjection({ placeId: 'place_a1', viewId: 'view_a1' });
    expect(projection.assetId).toBe('asset_a1');
    const plan = buildProjectionAssetLoadPlan(projection);
    expect(plan.entries).toEqual([]);
    expect(plan.normalMaps).toEqual([]);
    expect(plan.errors.join(' ')).toContain('asset_a1');
    expect(plan.errors.join(' ')).toMatch(/production-tagged/i);
    const queuedUrls: unknown[] = [];
    const scene = {
      textures: { exists: () => false },
      load: {
        image: vi.fn((_key: string, url?: string | string[]) => {
          queuedUrls.push(url);
        }),
      },
    };
    const queued = queueProjectionAssetLoads(scene, plan);
    expect(queued).toEqual([]);
    expect(scene.load.image).not.toHaveBeenCalled();
    expect(JSON.stringify(queuedUrls)).not.toContain('assets/world/a1.png');
    expect(JSON.stringify(queuedUrls)).not.toContain('assets/world/a1_n.png');
  });

  it('still queues production Room 104 assets and the shared production normal', () => {
    const plan = buildProjectionAssetLoadPlan(room104Projection(DESK_VIEW));
    expect(plan.errors).toEqual([]);
    expect(plan.entries.length).toBe(3);
    expect(plan.normalMaps).toHaveLength(1);
    const queuedUrls: string[] = [];
    const scene = {
      textures: { exists: () => false },
      load: {
        image: (_key: string, url?: string | string[]) => {
          queuedUrls.push(Array.isArray(url) ? (url[0] ?? '') : (url ?? ''));
          queuedUrls.push(Array.isArray(url) ? (url[1] ?? '') : '');
        },
      },
    };
    queueProjectionAssetLoads(scene, plan);
    const joined = queuedUrls.join(' ');
    expect(joined).toContain('assets/world/room104/room104-desk-window.png');
    expect(joined).toContain('assets/world/room104/room104-flat-normal.png');
    expect(joined).not.toContain('assets/world/a1.png');
  });

  it('leaves assetless projections empty without fixture fallback', () => {
    const projection: WorldSceneProjection = {
      ...room104Projection(DESK_VIEW),
      assetId: null,
      normalMapAssetId: null,
      availableViews: [],
    };
    const plan = buildProjectionAssetLoadPlan(projection);
    expect(plan.entries).toEqual([]);
    expect(plan.normalMaps).toEqual([]);
    expect(plan.errors).toEqual([]);
  });

  it('reports unknown asset references and queues nothing in their place', () => {
    const projection: WorldSceneProjection = {
      ...room104Projection(DESK_VIEW),
      assetId: 'asset_ghost',
      normalMapAssetId: null,
      availableViews: [],
    };
    const plan = buildProjectionAssetLoadPlan(projection);
    expect(plan.entries).toEqual([]);
    expect(plan.errors.join(' ')).toContain('asset_ghost');
    const scene = {
      textures: { exists: () => false },
      load: { image: vi.fn() },
    };
    queueProjectionAssetLoads(scene, plan);
    expect(scene.load.image).not.toHaveBeenCalled();
  });

  it('reports non-image asset references and never queues the fixture URI as art', () => {
    const projection: WorldSceneProjection = {
      ...room104Projection(DESK_VIEW),
      assetId: 'asset_a2',
      normalMapAssetId: null,
      availableViews: [],
    };
    const plan = buildProjectionAssetLoadPlan(projection);
    expect(plan.entries).toEqual([]);
    expect(plan.errors.join(' ')).toContain('asset_a2');
    const scene = {
      textures: { exists: () => false },
      load: { image: vi.fn() },
    };
    queueProjectionAssetLoads(scene, plan);
    expect(scene.load.image).not.toHaveBeenCalled();
  });
});

describe('generic asset/view validation for production art', () => {
  it('rejects a view assetId that does not resolve to an image asset', () => {
    const tables = clone(validAssetTables());
    (tables['assets']!['asset_sfx'] as unknown) = {
      name: 'Sfx',
      kind: 'audio',
      uri: 'assets/world/sfx.mp3',
      normalMapAssetId: '',
      tags: '[]',
    };
    (tables['views']!['view_a1']! as Record<string, unknown>)['assetId'] = 'asset_sfx';
    const errors = validateContent(tables);
    expect(errors.some((error) => error.includes('views/view_a1') && error.includes('assetId'))).toBe(true);
  });
});

describe('production loaderror reporting (key/URL)', () => {
  it('includes the Phaser file key and resolved URL when provided', () => {
    expect(formatProjectionAssetLoadError({ key: 'room104_desk_window_art', url: './assets/world/room104/x.png' })).toContain(
      'room104_desk_window_art',
    );
    expect(formatProjectionAssetLoadError({ key: 'room104_desk_window_art', url: './assets/world/room104/x.png' })).toContain(
      './assets/world/room104/x.png',
    );
    // Phaser File exposes the resolved src; prefer it over the raw url.
    expect(
      formatProjectionAssetLoadError({ key: 'k', url: 'raw-url', src: 'resolved-src' }),
    ).toContain('resolved-src');
  });

  it('degrades gracefully when Phaser provides no key/URL', () => {
    expect(formatProjectionAssetLoadError(null)).toContain('unknown');
    expect(formatProjectionAssetLoadError({})).toContain('unknown');
  });
});

describe('normal-map lighting gate (texture state, not projection claims)', () => {
  it('requires an existing texture with a linked data source', () => {
    expect(textureHasLinkedNormalMap(undefined, 'any')).toBe(false);
    expect(textureHasLinkedNormalMap({ exists: () => false }, 'any')).toBe(false);
    // Exists but no get(): cannot verify a linked normal map.
    expect(textureHasLinkedNormalMap({ exists: () => true }, 'any')).toBe(false);
    // Exists with an empty data source: diffuse without a normal map.
    expect(
      textureHasLinkedNormalMap({ exists: () => true, get: () => ({ key: 'k', dataSource: [] }) }, 'k'),
    ).toBe(false);
    // Phaser __MISSING fallback (key mismatch) is never treated as lit.
    expect(
      textureHasLinkedNormalMap(
        { exists: () => true, get: () => ({ key: '__MISSING', dataSource: [{ image: {} }] }) },
        'k',
      ),
    ).toBe(false);
    // Valid Phaser 4 array-linked or procedural setDataSource texture.
    expect(
      textureHasLinkedNormalMap(
        { exists: () => true, get: () => ({ key: 'k', dataSource: [{ image: {} }] }) },
        'k',
      ),
    ).toBe(true);
  });

  it('leaves sibling ghost views assetless without touching valid entries', () => {
    const projection: WorldSceneProjection = {
      ...room104Projection(DESK_VIEW),
      availableViews: [
        ...room104Projection(DESK_VIEW).availableViews,
        { id: 'ghost_view', name: 'Ghost', assetId: 'asset_ghost', neighbors: [] },
      ],
    };
    const plan = buildProjectionAssetLoadPlan(projection);
    // The three valid production entries still queue; only the ghost errors.
    expect(plan.entries.length).toBe(3);
    expect(plan.errors.join(' ')).toContain('asset_ghost');
  });
});

describe('post-boot dynamic projection refresh (generic, loader-safe)', () => {
  function mockLoader() {
    const events = new Map<string, Array<() => void>>();
    return {
      image: vi.fn(),
      once: vi.fn((event: string, fn: () => void) => {
        const list = events.get(event) ?? [];
        list.push(fn);
        events.set(event, list);
      }),
      off: vi.fn((event: string, fn?: () => void) => {
        if (!fn) events.delete(event);
        else events.set(event, (events.get(event) ?? []).filter((f) => f !== fn));
      }),
      start: vi.fn(),
      isReady: vi.fn(() => true),
      emitComplete: () => {
        for (const fn of [...(events.get('complete') ?? [])]) fn();
        events.delete('complete');
      },
      pendingCompleteCount: () => (events.get('complete') ?? []).length,
    };
  }

  it('queues missing production assets and refreshes once the loader completes', () => {
    const projection = room104Projection(DESK_VIEW);
    const loader = mockLoader();
    const scene = { textures: { exists: () => false }, load: loader };
    const onComplete = vi.fn();
    const queued = queueMissingProjectionAssetsForUpdate(scene, projection, onComplete);
    expect(queued.length).toBeGreaterThan(0);
    expect(loader.image).toHaveBeenCalled();
    expect(loader.once).toHaveBeenCalledWith('complete', expect.any(Function));
    expect(loader.start).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    loader.emitComplete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does nothing when every production asset is already cached', () => {
    const projection = room104Projection(DESK_VIEW);
    const loader = mockLoader();
    const scene = { textures: { exists: () => true }, load: loader };
    const queued = queueMissingProjectionAssetsForUpdate(scene, projection, vi.fn());
    expect(queued).toEqual([]);
    expect(loader.image).not.toHaveBeenCalled();
    expect(loader.once).not.toHaveBeenCalled();
    expect(loader.start).not.toHaveBeenCalled();
  });

  it('never force-starts an in-flight loader and coalesces repeated updates', () => {
    const projection = room104Projection(DESK_VIEW);
    const loader = mockLoader();
    loader.isReady.mockReturnValue(false);
    const scene = { textures: { exists: () => false }, load: loader };
    // WorldScene passes a stable refresh handler, so repeated view updates
    // replace (not stack) the pending refresh.
    const onComplete = vi.fn();
    queueMissingProjectionAssetsForUpdate(scene, projection, onComplete);
    const firstQueueCount = loader.image.mock.calls.length;
    queueMissingProjectionAssetsForUpdate(scene, projection, onComplete);
    // Queued files join the in-flight load; no restart.
    expect(loader.start).not.toHaveBeenCalled();
    expect(loader.image).toHaveBeenCalledTimes(firstQueueCount);
    expect(loader.pendingCompleteCount()).toBe(1);
    loader.emitComplete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('queues nothing for unknown views and never starts the loader', () => {
    const projection: WorldSceneProjection = {
      ...room104Projection(DESK_VIEW),
      assetId: 'asset_ghost',
      normalMapAssetId: null,
      availableViews: [],
    };
    const loader = mockLoader();
    const scene = { textures: { exists: () => false }, load: loader };
    const queued = queueMissingProjectionAssetsForUpdate(scene, projection, vi.fn());
    expect(queued).toEqual([]);
    expect(loader.image).not.toHaveBeenCalled();
    expect(loader.start).not.toHaveBeenCalled();
  });
});
