// src/engine/PulseCatalog.ts
// Pulse Messenger version lineage — mirrors OsCatalog but for the IM client.
// Each release is installable, has requirements, and can be AI-generated.

import type { OsVersion } from './types';

export type PulseFamily = '5.x' | '6.x';
export type PulseKind = 'major' | 'minor' | 'patch' | 'beta' | 'hotfix';
export type PulseChannel = 'stable' | 'beta' | 'hotfix';

export interface PulseRelease {
  id: string; // e.g. 'pulse_5.2', 'pulse_6.0', 'pulse_5.3-beta'
  version: string; // "5.2", "5.3", "6.0"
  build: string; // "5.2.1", "6.0.0"
  displayName: string; // "Pulse Messenger 5.2"
  family: PulseFamily;
  kind: PulseKind;
  channel: PulseChannel;
  releaseDay: number;
  releaseHour?: number;
  changelog: string[];
  requirements: {
    minOs: OsVersion;
    minRamMB: number;
    minDiskMB: number;
  };
  installSizeMB: number;
  blurb?: string;
  isProcedural?: boolean;
  sourceEventId?: string;
}

export const STATIC_PULSE_CATALOG: PulseRelease[] = [
  {
    id: 'pulse_5.2',
    version: '5.2',
    build: '5.2.1',
    displayName: 'Pulse Messenger 5.2',
    family: '5.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 1,
    changelog: ['Custom away messages', 'Tabbed chats', 'Sound alerts'],
    requirements: { minOs: 'Orion_4.8' as OsVersion, minRamMB: 64, minDiskMB: 32 },
    installSizeMB: 6,
    blurb: 'The definitive classic — your friends are only a click away.',
  },
  {
    id: 'pulse_5.2.1',
    version: '5.2.1',
    build: '5.2.1',
    displayName: 'Pulse Messenger 5.2.1',
    family: '5.x',
    kind: 'patch',
    channel: 'stable',
    releaseDay: 4,
    changelog: ['Fix away-message truncation', 'Faster buddy list paint'],
    requirements: { minOs: 'Orion_4.8' as OsVersion, minRamMB: 512, minDiskMB: 2 },
    installSizeMB: 2,
    blurb: 'Patch — away messages no longer cut off.',
  },
  {
    id: 'pulse_5.3-beta',
    version: '5.3-beta',
    build: '5.3.0-beta',
    displayName: 'Pulse Messenger 5.3 Beta',
    family: '5.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 7,
    changelog: ['Typing indicators', 'New emoticon palette'],
    requirements: { minOs: 'Orion_4.8' as OsVersion, minRamMB: 512, minDiskMB: 5 },
    installSizeMB: 5,
    blurb: 'Beta — see who is typing.',
  },
  {
    id: 'pulse_5.3',
    version: '5.3',
    build: '5.3.0',
    displayName: 'Pulse Messenger 5.3',
    family: '5.x',
    kind: 'minor',
    channel: 'stable',
    releaseDay: 9,
    changelog: ['Typing indicators stable', 'Emoticon palette +12', 'Offline queue'],
    requirements: { minOs: 'Orion_4.8' as OsVersion, minRamMB: 512, minDiskMB: 8 },
    installSizeMB: 8,
    blurb: 'Minor — typing dots are here to stay.',
  },
  {
    id: 'pulse_6.0-beta',
    version: '6.0-beta',
    build: '6.0.0-beta',
    displayName: 'Pulse Messenger 6.0 Beta',
    family: '6.x',
    kind: 'beta',
    channel: 'beta',
    releaseDay: 11,
    changelog: ['Display pictures (96x96)', 'Richer layout', 'Requires Orion 6.0'],
    requirements: { minOs: 'Orion_6.0' as OsVersion, minRamMB: 768, minDiskMB: 12 },
    installSizeMB: 12,
    blurb: 'Beta — display pics, warmer layout.',
  },
  {
    id: 'pulse_6.0',
    version: '6.0',
    build: '6.0.0',
    displayName: 'Pulse Messenger 6.0',
    family: '6.x',
    kind: 'major',
    channel: 'stable',
    releaseDay: 13,
    changelog: ['Display pictures', 'Buddy signature colors', 'Animated emoticons +12', 'File transfer resume', 'Webcam indicator'],
    requirements: { minOs: 'Orion_6.0' as OsVersion, minRamMB: 768, minDiskMB: 18 },
    installSizeMB: 18,
    blurb: 'The 6.0 — your face, 96 pixels at a time, now in your own color.',
  },
  {
    id: 'pulse_6.0.1',
    version: '6.0.1',
    build: '6.0.1',
    displayName: 'Pulse Messenger 6.0.1',
    family: '6.x',
    kind: 'hotfix',
    channel: 'hotfix',
    releaseDay: 15,
    changelog: ['Fix file-transfer stall on 256k', 'Away history scroll fix'],
    requirements: { minOs: 'Orion_6.0' as OsVersion, minRamMB: 768, minDiskMB: 2 },
    installSizeMB: 2,
    blurb: 'Hotfix — transfers no longer stall.',
  },
];

const proceduralReleases: Map<string, PulseRelease> = new Map();

export function registerProceduralPulseRelease(release: PulseRelease): PulseRelease {
  if (!/^[a-z0-9_.-]+$/.test(release.id)) throw new Error('Invalid Pulse id');
  if (proceduralReleases.has(release.id) || STATIC_PULSE_CATALOG.some((r) => r.id === release.id)) {
    throw new Error(`Pulse id exists: ${release.id}`);
  }
  proceduralReleases.set(release.id, { ...release, isProcedural: true });
  return release;
}

export function getProceduralPulseReleases(): PulseRelease[] {
  return Array.from(proceduralReleases.values());
}

export function clearProceduralPulseReleases(): void {
  proceduralReleases.clear();
}

export function restoreProceduralPulseReleases(releases: PulseRelease[]): void {
  clearProceduralPulseReleases();
  for (const r of releases) proceduralReleases.set(r.id, { ...r, isProcedural: true });
}

export function getAllPulseReleases(): PulseRelease[] {
  return [...STATIC_PULSE_CATALOG, ...Array.from(proceduralReleases.values())].sort((a, b) => a.releaseDay - b.releaseDay || a.version.localeCompare(b.version));
}

export function getPulseReleaseById(id: string): PulseRelease | undefined {
  return getAllPulseReleases().find((r) => r.id === id);
}

export function getPulseReleasesForFamily(family: PulseFamily): PulseRelease[] {
  return getAllPulseReleases().filter((r) => r.family === family);
}

export type PulseFeature = 'buddy-colors' | 'animated-emoticons';

/**
 * Feature gate for the Pulse 6 generation (MSN-era colors + motion).
 * 6.x stable/hotfix (and betas) carry them; 5.x never does — the upgrade
 * stays meaningful. Unknown or absent ids read as 5.x (offline-safe default).
 */
export function pulseHasFeature(releaseId: string | null | undefined, feature: PulseFeature): boolean {
  void feature;
  if (!releaseId) return false;
  const release = getPulseReleaseById(releaseId);
  if (!release) return false;
  return release.family === '6.x';
}

export function comparePulseVersions(a: string, b: string): number {
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
