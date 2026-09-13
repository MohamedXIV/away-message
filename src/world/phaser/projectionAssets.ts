// src/world/phaser/projectionAssets.ts
//
// Generic projection production-asset load plan.
//
// Resolves the diffuse image assets (and their linked normal maps) selected
// by a WorldSceneProjection — the active view asset plus every authored
// sibling view asset — from the generated content registries. The plan is
// deliberately generic: it never names a place, view, or asset id, never
// falls back to technical-fixture / procedural / random art, and reports
// invalid references as errors while leaving those slots assetless.
//
// Production boundary: only explicitly production-tagged image assets are
// queued over HTTP. Procedural technical-fixture assets (which carry no
// production tag) stay procedural — they must never cause loader requests
// for their placeholder URIs. The fixture's own canvas textures remain the
// sole source for those keys (see technicalFixture.ensureFixtureTextures).

import { GENERATED_ASSETS } from '../../engine/worldContent.generated';
import type { WorldSceneProjection } from './types';

export interface ProjectionAssetLoadEntry {
  /** Texture key (the generated asset id). */
  key: string;
  /** Relative Vite/itch-compatible URL for the diffuse image. */
  url: string;
  /** Linked normal-map texture key, or null when the asset has none. */
  normalMapKey: string | null;
  /** Relative URL for the linked normal map, or null when there is none. */
  normalMapUrl: string | null;
}

export interface ProjectionAssetLoadPlan {
  /** One entry per unique production diffuse image asset. */
  entries: ProjectionAssetLoadEntry[];
  /** Deduplicated linked normal-map assets (a shared normal map loads once). */
  normalMaps: Array<{ key: string; url: string }>;
  /** Human-readable errors for references that resolve to nothing loadable. */
  errors: string[];
}

/**
 * Resolves a generated asset uri (e.g. "assets/world/atrium/view.png") to a
 * relative URL that works under both Vite dev/preview and the itch.io
 * iframe (which serves the game from a subpath, so absolute "/..." URLs
 * would 404). Public-dir files are copied to dist/ preserving this path.
 */
export function resolveProductionAssetUrl(uri: string): string {
  const clean = uri.replace(/^\.\//, '').replace(/^\/+/, '');
  return `./${clean}`;
}

function findGeneratedAsset(id: string) {
  return GENERATED_ASSETS.find((asset) => asset.id === id) ?? null;
}

/**
 * Generic production boundary: a generated asset is loadable as production
 * runtime art only when its registry tags explicitly include "production".
 * Technical-fixture / procedural assets carry no such tag and are therefore
 * never queued over HTTP by this module.
 */
function isProductionTagged(tags: unknown): boolean {
  return Array.isArray(tags) && (tags as unknown[]).includes('production');
}

/**
 * Builds the production load plan for a projection: the active asset plus
 * every authored sibling asset from availableViews. Unknown or non-image
 * references are reported in errors and queued nowhere — the projection
 * stays assetless for those slots instead of borrowing another visual.
 * Assetless (null/empty) references are valid and skipped silently.
 */
export function buildProjectionAssetLoadPlan(
  projection: WorldSceneProjection,
): ProjectionAssetLoadPlan {
  const errors: string[] = [];
  const entries: ProjectionAssetLoadEntry[] = [];
  const normalMaps: Array<{ key: string; url: string }> = [];
  const seenDiffuse = new Set<string>();
  const seenNormal = new Set<string>();

  const candidateIds: string[] = [];
  if (projection.assetId) candidateIds.push(projection.assetId);
  for (const view of projection.availableViews ?? []) {
    if (view.assetId) candidateIds.push(view.assetId);
  }

  for (const assetId of candidateIds) {
    if (seenDiffuse.has(assetId)) continue;
    seenDiffuse.add(assetId);

    const def = findGeneratedAsset(assetId);
    if (!def) {
      errors.push(
        `Projection asset '${assetId}' is not a known generated asset; leaving the projection assetless rather than substituting another visual.`,
      );
      continue;
    }
    if (def.kind !== 'image') {
      errors.push(
        `Projection asset '${assetId}' has kind '${def.kind}' and cannot be queued as production runtime art; leaving the projection assetless rather than substituting another visual.`,
      );
      continue;
    }
    if (!isProductionTagged(def.tags)) {
      errors.push(
        `Projection asset '${assetId}' is not production-tagged and cannot be queued as production runtime art; leaving the projection assetless rather than substituting another visual.`,
      );
      continue;
    }

    let normalMapKey: string | null = null;
    let normalMapUrl: string | null = null;
    if (def.normalMapAssetId) {
      const normalDef = findGeneratedAsset(def.normalMapAssetId);
      if (!normalDef) {
        errors.push(
          `Normal map '${def.normalMapAssetId}' for asset '${assetId}' is not a known generated asset; loading '${assetId}' without a normal map.`,
        );
      } else if (normalDef.kind !== 'image') {
        errors.push(
          `Normal map '${def.normalMapAssetId}' for asset '${assetId}' is not an image asset; loading '${assetId}' without a normal map.`,
        );
      } else if (!isProductionTagged(normalDef.tags)) {
        errors.push(
          `Normal map '${def.normalMapAssetId}' for asset '${assetId}' is not production-tagged; loading '${assetId}' without a normal map.`,
        );
      } else {
        normalMapKey = normalDef.id;
        normalMapUrl = resolveProductionAssetUrl(normalDef.uri);
        if (!seenNormal.has(normalDef.id)) {
          seenNormal.add(normalDef.id);
          normalMaps.push({ key: normalDef.id, url: normalMapUrl });
        }
      }
    }

    entries.push({
      key: def.id,
      url: resolveProductionAssetUrl(def.uri),
      normalMapKey,
      normalMapUrl,
    });
  }

  return { entries, normalMaps, errors };
}

export interface ProjectionLoadQueueScene {
  textures: { exists(key: string): boolean };
  load: {
    image(key: string, url?: string | string[]): unknown;
  };
}

/**
 * Queues every file in a load plan exactly once, skipping texture keys the
 * scene already holds. Plan errors are reported loudly; nothing is queued
 * in place of an invalid reference. Returns the queued texture keys.
 */
export function queueProjectionAssetLoads(
  scene: ProjectionLoadQueueScene,
  plan: ProjectionAssetLoadPlan,
): string[] {
  for (const message of plan.errors) {
    console.error(`[projection-assets] ${message}`);
  }

  const queued: string[] = [];
  const queuedKeys = new Set<string>();
  const queueOne = (key: string, url: string, normalMapUrl?: string): void => {
    if (queuedKeys.has(key)) return;
    queuedKeys.add(key);
    if (scene.textures.exists(key)) return;
    // Phaser links a normal map through the array form [diffuse, normal]
    // (see ImageFile: url[1] becomes the linked normalMap file).
    if (normalMapUrl) {
      scene.load.image(key, [url, normalMapUrl]);
    } else {
      scene.load.image(key, url);
    }
    queued.push(key);
  };

  for (const entry of plan.entries) {
    queueOne(entry.key, entry.url, entry.normalMapUrl ?? undefined);
  }
  for (const normal of plan.normalMaps) {
    queueOne(normal.key, normal.url);
  }
  return queued;
}

/**
 * Minimal Phaser Loader file shape used for loud production-asset failure
 * reporting. Phaser 4 passes the full File (key/url/src); the fields are
 * optional here so unit tests can use plain mocks. Kept in this Phaser-free
 * module so Node unit tests can cover reporting without a browser harness.
 */
export interface ProjectionAssetLoadErrorFile {
  key?: unknown;
  url?: unknown;
  src?: unknown;
}

/**
 * Formats a loud production-asset failure message including the file key
 * and resolved URL when Phaser provides them. Never substitutes another
 * visual — callers leave the projection assetless.
 */
export function formatProjectionAssetLoadError(file: ProjectionAssetLoadErrorFile | null | undefined): string {
  const key = String(file?.key ?? 'unknown');
  const url = String(file?.src ?? file?.url ?? 'unknown');
  return (
    `[projection-assets] Failed to load production asset '${key}' from '${url}'; ` +
    `leaving the projection assetless rather than substituting another visual.`
  );
}

/**
 * Minimal texture-manager shape needed to verify a linked normal map.
 * Phaser 4 stores an array-linked normal map as Texture.dataSource
 * (see ImageFile.addToCache -> TextureManager.addImage -> setDataSource).
 */
export interface NormalMapTextureLookup {
  exists(key: string): boolean;
  get?(key: string): unknown;
}

/**
 * Returns true only when the diffuse texture exists AND carries a linked
 * data-source entry (the Phaser 4 normal-map slot). A failed normal-map
 * load leaves the diffuse key missing or without a data source, so it can
 * never be reported as successful normal-map lighting through this gate.
 */
export function textureHasLinkedNormalMap(
  textures: NormalMapTextureLookup | undefined | null,
  textureKey: string,
): boolean {
  try {
    if (!textures || typeof textures.exists !== 'function') return false;
    if (!textures.exists(textureKey)) return false;
    if (typeof textures.get !== 'function') return false;
    const tex = textures.get(textureKey) as { key?: unknown; dataSource?: unknown } | null | undefined;
    if (!tex || typeof tex !== 'object') return false;
    // TextureManager.get returns the __MISSING fallback for unknown keys;
    // exists() already guards this, but double-check the key when visible.
    if (typeof tex.key === 'string' && tex.key !== textureKey) return false;
    if (!Array.isArray(tex.dataSource)) return false;
    return tex.dataSource.some((entry) => entry !== null && entry !== undefined);
  } catch {
    return false;
  }
}

/**
 * Minimal loader/scene shape for safe post-boot projection asset refresh.
 * All loader methods are optional so the helper degrades gracefully when
 * Phaser APIs are unavailable (tests, headless, or unexpected states).
 */
export interface RefreshableProjectionLoadScene {
  textures: { exists(key: string): boolean };
  load: {
    image(key: string, url?: string | string[]): unknown;
    once?(event: string, fn: (...args: never[]) => void, context?: unknown): unknown;
    off?(event: string, fn?: (...args: never[]) => void, context?: unknown): unknown;
    start?(): unknown;
    isReady?(): boolean;
  };
}

interface DynamicProjectionRefreshState {
  pendingKeys: Set<string>;
  onComplete: () => void;
  completeHandler: () => void;
}

// A Phaser texture is not visible through textures.exists() until its file
// has completed. Keep a per-scene in-flight set so rapid projection updates
// cannot enqueue the same diffuse/normal pair more than once.
const dynamicProjectionRefreshStates = new WeakMap<object, DynamicProjectionRefreshState>();

/**
 * Generic post-boot refresh: queues any missing production assets for the
 * new projection and re-renders once Phaser's loader completes. Safe to
 * call repeatedly: repeated view updates coalesce into a single pending
 * refresh, an in-flight loader is never force-restarted, and loader edge
 * cases never break the view update itself.
 *
 * Boot loading remains preload()-owned; this only covers projections that
 * arrive later via updateProjection (e.g. a view whose asset was not part
 * of the boot sibling set).
 */
export function queueMissingProjectionAssetsForUpdate(
  scene: RefreshableProjectionLoadScene,
  projection: WorldSceneProjection,
  onComplete: () => void,
): string[] {
  let state = dynamicProjectionRefreshStates.get(scene);
  if (!state) {
    const created = {} as DynamicProjectionRefreshState;
    created.pendingKeys = new Set<string>();
    created.onComplete = onComplete;
    created.completeHandler = () => {
      created.pendingKeys.clear();
      created.onComplete();
    };
    dynamicProjectionRefreshStates.set(scene, created);
    state = created;
  } else {
    state.onComplete = onComplete;
  }

  const plan = buildProjectionAssetLoadPlan(projection);
  const queueScene: ProjectionLoadQueueScene = {
    textures: {
      exists: (key) => state!.pendingKeys.has(key) || scene.textures.exists(key),
    },
    load: scene.load,
  };
  const queued = queueProjectionAssetLoads(queueScene, plan);
  for (const key of queued) {
    state.pendingKeys.add(key);
  }
  if (queued.length === 0) return queued;
  try {
    const load = scene.load;
    try {
      load.off?.('complete', state.completeHandler as (...args: never[]) => void);
    } catch {
      // Ignore listener-cleanup edge cases; the refresh itself is best-effort.
    }
    try {
      if (typeof load.once === 'function') {
        load.once('complete', state.completeHandler as (...args: never[]) => void);
      } else {
        // Without a completion event there is no safe way to know when these
        // keys become cache-visible; release the in-flight guard and let the
        // next projection update retry instead of permanently suppressing it.
        for (const key of queued) state.pendingKeys.delete(key);
        return queued;
      }
    } catch {
      // If once() is unavailable, the sprite stays as setupSprites left it
      // (assetless with a loud error) until the next view update.
      for (const key of queued) state.pendingKeys.delete(key);
      return queued;
    }
    // Phaser 4: start() only when the loader is ready (IDLE/COMPLETE). When
    // a load is already in flight, the queued files join it and its own
    // `complete` fires our refresh — never force-restart it.
    let ready = true;
    try {
      ready = typeof load.isReady === 'function' ? load.isReady() : true;
    } catch {
      ready = true;
    }
    if (ready) {
      try {
        load.start?.();
      } catch {
        // Loader start failures are reported via loaderror/complete; the
        // current sprite state already reflects the pre-load projection.
      }
    }
  } catch {
    // Never let loader bookkeeping break a view update.
  }
  return queued;
}
