// src/engine/OsCatalog.ts
// Core OS catalog — canonical lineage 4.8 → 5.0 → 6.0 → 7.0 plus patches/betas.
// Each release is a real installable artifact with requirements, theme, overhead.
// AI-generated releases are injected here via registerProceduralRelease() and validated.

import type { OsVersion } from './types';

export type OsFamily = '4.x' | '5.x' | '6.x' | '7.x';
export type OsKind = 'major' | 'minor' | 'patch' | 'beta' | 'hotfix';
export type OsChannel = 'stable' | 'beta' | 'hotfix';
export type OsThemeId = 'orion48' | 'orion50' | 'orion60' | 'orion70';

export interface OsRelease {
  id: OsVersion;              // unique key, e.g. 'Orion_7.0', 'Orion_6.1', 'Orion_7.0-beta2'
  version: string;            // "7.0", "6.1", "4.8"
  build: string;              // "7.0.3421", "6.1.1844"
  codename?: string;          // "Gloss", "Canal"
  displayName: string;        // "Orion OS 7.0 — Gloss Edition"
  family: OsFamily;
  kind: OsKind;
  channel: OsChannel;
  releaseDay: number;         // sandbox day it becomes available
  releaseHour?: number;       // 0..23
  changelog: string[];        // 2-6 bullet points
  requirements: {
    minRamMB: number;
    minCpuTier: number;
    minDiskGB: number;
    requiresOs?: OsVersion;   // must be on this first (for patches)
    requiresFamily?: OsFamily;
  };
  installSizeGB: number;      // disk cost
  ramOverheadMB: number;      // resident after boot
  bootTimeSeconds: number;    // simulated boot
  theme: OsThemeId;
  price?: number;             // TechMart price, 0 = free patch
  blurb?: string;             // marketing one-liner
  isProcedural?: boolean;
  sourceEventId?: string;     // linked WorldEvent id if AI-generated
}

// Canonical static lineage — era-locked, beige-box realistic
export const STATIC_OS_CATALOG: OsRelease[] = [
  {
    id: 'Orion_4.8' as OsVersion,
    version: '4.8',
    build: '4.8.1129',
    codename: 'Brick',
    displayName: 'Orion OS 4.8',
    family: '4.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 1,
    changelog: ['Beveled chrome, 64MB baseline, V90 dial-up wizard'],
    requirements: { minRamMB: 256, minCpuTier: 1, minDiskGB: 1.2 },
    installSizeGB: 1.2,
    ramOverheadMB: 64,
    bootTimeSeconds: 38,
    theme: 'orion48',
    price: 0,
    blurb: 'Compact, beveled, dense — the motel baseline.',
  },
  {
    id: 'Orion_5.0' as OsVersion,
    version: '5.0',
    build: '5.0.1511',
    codename: 'Aperture',
    displayName: 'Orion OS 5.0',
    family: '5.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 6,
    changelog: ['Cleaner start menu, 96MB baseline, improved IDE driver', 'Early MyPlace tiler support'],
    requirements: { minRamMB: 512, minCpuTier: 1, minDiskGB: 1.4, requiresFamily: '4.x' },
    installSizeGB: 1.4,
    ramOverheadMB: 96,
    bootTimeSeconds: 42,
    theme: 'orion50',
    price: 29.0,
    blurb: 'Bridge release — less bevel, more breathing room.',
  },
  {
    id: 'Orion_6.0' as OsVersion,
    version: '6.0',
    build: '6.0.2419',
    codename: 'Canal',
    displayName: 'Orion OS 6.0',
    family: '6.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 8,
    changelog: ['Warm XP-like shell, richer icons, PhotoBox 2.0 unlock', 'New progress dialog, Canal At Night saver'],
    requirements: { minRamMB: 768, minCpuTier: 1, minDiskGB: 2.0, requiresFamily: '4.x' },
    installSizeGB: 1.8,
    ramOverheadMB: 160,
    bootTimeSeconds: 48,
    theme: 'orion60',
    price: 45.0,
    blurb: 'Warmer, friendlier, still beige.',
  },
  {
    id: 'Orion_6.1' as OsVersion,
    version: '6.1',
    build: '6.1.2601',
    codename: 'Canal SP1',
    displayName: 'Orion OS 6.1 Patch',
    family: '6.x',
    kind: 'patch',
    channel: 'stable',
    releaseDay: 10,
    changelog: ['Faster file copy, “Canal At Night” saver fix', '99% dialog jitter patch'],
    requirements: { minRamMB: 512, minCpuTier: 1, minDiskGB: 0.3, requiresOs: 'Orion_6.0' as OsVersion },
    installSizeGB: 0.3,
    ramOverheadMB: 162,
    bootTimeSeconds: 46,
    theme: 'orion60',
    price: 0,
    blurb: 'Free patch — less anxious progress bar.',
  },
  {
    id: 'Orion_7.0-beta' as OsVersion,
    version: '7.0-beta',
    build: '7.0.3102',
    codename: 'Gloss',
    displayName: 'Orion OS 7.0 Beta',
    family: '7.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 7,
    changelog: ['Glossy dock leak, new wallpapers (BMP zip)', 'Requires 768MB min, unstable on 512MB'],
    requirements: { minRamMB: 768, minCpuTier: 1, minDiskGB: 2.2 },
    installSizeGB: 2.2,
    ramOverheadMB: 185,
    bootTimeSeconds: 54,
    theme: 'orion70',
    price: 0,
    blurb: 'Beta — glossy, hungry, beautiful.',
  },
  {
    id: 'Orion_7.0' as OsVersion,
    version: '7.0',
    build: '7.0.3421',
    codename: 'Gloss',
    displayName: 'Orion OS 7.0',
    family: '7.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 11,
    changelog: ['Glossy dock, candy progress, pipe + aquarium savers', '1GB recommended, 768MB min, 2.6GB install'],
    requirements: { minRamMB: 768, minCpuTier: 1, minDiskGB: 2.6 },
    installSizeGB: 2.6,
    ramOverheadMB: 195,
    bootTimeSeconds: 58,
    theme: 'orion70',
    price: 59.0,
    blurb: 'The glossy one — two reboots for drama.',
  },
  {
    id: 'Orion_7.0.1' as OsVersion,
    version: '7.0.1',
    build: '7.0.3522',
    codename: 'Gloss Hotfix',
    displayName: 'Orion OS 7.0.1 Hotfix',
    family: '7.x',
    kind: 'hotfix',
    channel: 'hotfix',
    releaseDay: 13,
    changelog: ['Fix 99% file-copy freeze (copy in batches workaround)', 'Dock backport note for 6.0'],
    requirements: { minRamMB: 768, minCpuTier: 1, minDiskGB: 0.2, requiresOs: 'Orion_7.0' as OsVersion },
    installSizeGB: 0.2,
    ramOverheadMB: 196,
    bootTimeSeconds: 55,
    theme: 'orion70',
    price: 0,
    blurb: 'Day-2 hotfix for the 99% freeze.',
  },
];

// Stored procedural releases (AI-generated, governed)
const proceduralReleases: Map<string, OsRelease> = new Map();

export function registerProceduralRelease(release: OsRelease): OsRelease {
  // Governance: sanitize
  if (!/^[A-Za-z0-9_.-]+$/.test(release.id as string)) throw new Error('Invalid OS id');
  if (proceduralReleases.has(release.id as string) || STATIC_OS_CATALOG.some((r) => r.id === release.id)) {
    throw new Error(`OS id already exists: ${release.id}`);
  }
  proceduralReleases.set(release.id as string, { ...release, isProcedural: true });
  return release;
}

export function getProceduralReleases(): OsRelease[] {
  return Array.from(proceduralReleases.values());
}

export function clearProceduralReleases(): void {
  proceduralReleases.clear();
}

export function restoreProceduralReleases(releases: OsRelease[]): void {
  clearProceduralReleases();
  for (const r of releases) {
    // Bypass duplicate check for restore
    proceduralReleases.set(r.id as string, { ...r, isProcedural: true });
  }
}

export function getAllReleases(): OsRelease[] {
  return [...STATIC_OS_CATALOG, ...Array.from(proceduralReleases.values())].sort((a, b) => a.releaseDay - b.releaseDay || a.version.localeCompare(b.version));
}

export function getReleaseById(id: OsVersion): OsRelease | undefined {
  return getAllReleases().find((r) => r.id === id);
}

export function getReleasesForFamily(family: OsFamily): OsRelease[] {
  return getAllReleases().filter((r) => r.family === family);
}

// Version ordering — supports "4.8", "6.1", "7.0-beta", "7.0.1"
export function parseVersionParts(v: string): number[] {
  const clean = v.toLowerCase().replace(/[^0-9.]/g, '.');
  return clean.split('.').map((p) => parseInt(p, 10) || 0).filter((n) => Number.isFinite(n));
}

export function compareOsVersions(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  // beta < stable if same numeric
  const aBeta = a.toLowerCase().includes('beta') ? -1 : 0;
  const bBeta = b.toLowerCase().includes('beta') ? -1 : 0;
  return aBeta - bBeta;
}

export function isOsAtLeast(current: OsVersion, required: OsVersion): boolean {
  const cur = getReleaseById(current);
  const req = getReleaseById(required);
  if (!cur || !req) {
    // Fallback to string compare if unknown procedural id
    return compareOsVersions(current as string, required as string) >= 0;
  }
  // Family ordering then version
  const familyOrder: Record<OsFamily, number> = { '4.x': 4, '5.x': 5, '6.x': 6, '7.x': 7 };
  if (familyOrder[cur.family] !== familyOrder[req.family]) return familyOrder[cur.family] > familyOrder[req.family];
  return compareOsVersions(cur.version, req.version) >= 0;
}

// For SoftwareRequirement.minOs string like "Orion_6.0" → compare
export function isMinOsSatisfied(current: OsVersion, minOs: OsVersion): boolean {
  return isOsAtLeast(current, minOs);
}
