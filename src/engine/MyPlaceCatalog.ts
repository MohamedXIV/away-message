// src/engine/MyPlaceCatalog.ts
// Heavy catalog for MyPlace — server-side social network that evolves like Orion OS.
// Each release unlocks features: Top 8, music, tiler, glitter, etc.

export type MyPlaceFamily = '1.x' | '2.x';
export type MyPlaceKind = 'major' | 'minor' | 'patch' | 'beta' | 'hotfix';
export type MyPlaceChannel = 'stable' | 'beta' | 'hotfix';

export interface MyPlaceFeatureSet {
  top8: boolean;
  profileMusic: boolean;
  tiler: boolean;
  glitter: boolean;
  guestbookThreaded: boolean;
  autoplay: boolean;
  videoEmbed: boolean;
}

export interface MyPlaceRelease {
  id: string; // e.g. 'myplace_2.0'
  version: string; // "2.0", "2.1"
  build: string; // "2.0.0"
  displayName: string; // "MyPlace 2.0 — Top 8"
  family: MyPlaceFamily;
  kind: MyPlaceKind;
  channel: MyPlaceChannel;
  releaseDay: number;
  releaseHour?: number;
  changelog: string[];
  features: MyPlaceFeatureSet;
  blurb?: string;
  isProcedural?: boolean;
  sourceEventId?: string;
}

export const STATIC_MYPLACE_CATALOG: MyPlaceRelease[] = [
  {
    id: 'myplace_1.0',
    version: '1.0',
    build: '1.0.0',
    displayName: 'MyPlace 1.0',
    family: '1.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 1,
    changelog: ['Basic profiles', 'Bio + interests', 'Guestbook flat'],
    features: { top8: false, profileMusic: false, tiler: false, glitter: false, guestbookThreaded: false, autoplay: false, videoEmbed: false },
    blurb: 'The plain one — just you and your words.',
  },
  {
    id: 'myplace_2.0',
    version: '2.0',
    build: '2.0.0',
    displayName: 'MyPlace 2.0 — Top 8',
    family: '2.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 3,
    changelog: ['Top 8 friends', 'Profile song', 'Online status dot'],
    features: { top8: true, profileMusic: true, tiler: false, glitter: false, guestbookThreaded: false, autoplay: false, videoEmbed: false },
    blurb: 'Rank your friends. Play your song.',
  },
  {
    id: 'myplace_2.0.1',
    version: '2.0.1',
    build: '2.0.1',
    displayName: 'MyPlace 2.0.1',
    family: '2.x',
    kind: 'patch',
    channel: 'stable',
    releaseDay: 5,
    changelog: ['Fix Top 8 drag reorder', 'Guestbook threaded replies'],
    features: { top8: true, profileMusic: true, tiler: false, glitter: false, guestbookThreaded: true, autoplay: false, videoEmbed: false },
    blurb: 'Patch — Top 8 finally draggable.',
  },
  {
    id: 'myplace_2.1-beta',
    version: '2.1-beta',
    build: '2.1.0-beta',
    displayName: 'MyPlace 2.1 Beta — Tiler',
    family: '2.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 7,
    changelog: ['Tiled backgrounds (100×100)', 'Neighborhood maps'],
    features: { top8: true, profileMusic: true, tiler: true, glitter: false, guestbookThreaded: true, autoplay: false, videoEmbed: false },
    blurb: 'Beta — tile tiny stars across your page.',
  },
  {
    id: 'myplace_2.1',
    version: '2.1',
    build: '2.1.0',
    displayName: 'MyPlace 2.1',
    family: '2.x',
    kind: 'minor',
    channel: 'stable',
    releaseDay: 9,
    changelog: ['Tiler stable', 'Maps on profiles', 'Song chart'],
    features: { top8: true, profileMusic: true, tiler: true, glitter: false, guestbookThreaded: true, autoplay: false, videoEmbed: false },
    blurb: 'Minor — stars that tile.',
  },
  {
    id: 'myplace_2.2-beta',
    version: '2.2-beta',
    build: '2.2.0-beta',
    displayName: 'MyPlace 2.2 Beta — Glitter',
    family: '2.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 11,
    changelog: ['Glitter GIFs', 'Autoplay toggle (hidden)'],
    features: { top8: true, profileMusic: true, tiler: true, glitter: true, guestbookThreaded: true, autoplay: true, videoEmbed: false },
    blurb: 'Beta — glitter that kills 56k.',
  },
  {
    id: 'myplace_2.2',
    version: '2.2',
    build: '2.2.0',
    displayName: 'MyPlace 2.2 — Glitter',
    family: '2.x',
    kind: 'minor',
    channel: 'stable',
    releaseDay: 13,
    changelog: ['Glitter packing', 'Autoplay anthems', 'Guestbook spam wave'],
    features: { top8: true, profileMusic: true, tiler: true, glitter: true, guestbookThreaded: true, autoplay: true, videoEmbed: false },
    blurb: 'Gloss for your page.',
  },
  {
    id: 'myplace_2.3-beta',
    version: '2.3-beta',
    build: '2.3.0-beta',
    displayName: 'MyPlace 2.3 Beta — Video',
    family: '2.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 15,
    changelog: ['Video embed (320×240)', 'Top 8 drama dashboard'],
    features: { top8: true, profileMusic: true, tiler: true, glitter: true, guestbookThreaded: true, autoplay: true, videoEmbed: true },
    blurb: 'Beta — moving pictures.',
  },
];

const proceduralReleases: Map<string, MyPlaceRelease> = new Map();

export function registerProceduralMyPlaceRelease(release: MyPlaceRelease): MyPlaceRelease {
  if (!/^[a-z0-9_.-]+$/.test(release.id)) throw new Error('Invalid MyPlace id');
  if (proceduralReleases.has(release.id) || STATIC_MYPLACE_CATALOG.some((r) => r.id === release.id)) {
    throw new Error(`MyPlace id exists: ${release.id}`);
  }
  proceduralReleases.set(release.id, { ...release, isProcedural: true });
  return release;
}

export function getProceduralMyPlaceReleases(): MyPlaceRelease[] {
  return Array.from(proceduralReleases.values());
}

export function clearProceduralMyPlaceReleases(): void {
  proceduralReleases.clear();
}

export function restoreProceduralMyPlaceReleases(releases: MyPlaceRelease[]): void {
  clearProceduralMyPlaceReleases();
  for (const r of releases) proceduralReleases.set(r.id, { ...r, isProcedural: true });
}

export function getAllMyPlaceReleases(): MyPlaceRelease[] {
  return [...STATIC_MYPLACE_CATALOG, ...Array.from(proceduralReleases.values())].sort((a, b) => a.releaseDay - b.releaseDay || a.version.localeCompare(b.version));
}

export function getMyPlaceReleaseById(id: string): MyPlaceRelease | undefined {
  return getAllMyPlaceReleases().find((r) => r.id === id);
}

export function compareMyPlaceVersions(a: string, b: string): number {
  const pa = a.replace(/[^0-9.]/g, '.').split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.replace(/[^0-9.]/g, '.').split('.').map((p) => parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  const aBeta = a.toLowerCase().includes('beta') ? -1 : 0;
  const bBeta = b.toLowerCase().includes('beta') ? -1 : 0;
  return aBeta - bBeta;
}
