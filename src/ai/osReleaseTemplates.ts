// src/ai/osReleaseTemplates.ts
// Offline fallback for OS releases — deterministic, era-correct, governed.

import type { OsRelease } from '../engine/OsCatalog';

export interface OsTemplateEntry {
  version: string;
  codename: string;
  displayName: string;
  family: OsRelease['family'];
  kind: OsRelease['kind'];
  channel: OsRelease['channel'];
  changelog: string[];
  blurb: string;
  installSizeGB: number;
  ramOverheadMB: number;
  bootTimeSeconds: number;
  theme: OsRelease['theme'];
  price?: number;
}

const OS_TEMPLATES: Record<string, OsTemplateEntry[]> = {
  '5.x': [
    {
      version: '5.0',
      codename: 'Aperture',
      displayName: 'Orion OS 5.0',
      family: '5.x',
      kind: 'major',
      channel: 'stable',
      changelog: ['Cleaner start menu, 96MB baseline', 'MyPlace tiler support, IDE driver fix'],
      blurb: 'Bridge release — less bevel, more air.',
      installSizeGB: 1.4,
      ramOverheadMB: 96,
      bootTimeSeconds: 42,
      theme: 'orion50',
      price: 29,
    },
    {
      version: '5.1',
      codename: 'Aperture SP1',
      displayName: 'Orion OS 5.1 Patch',
      family: '5.x',
      kind: 'patch',
      channel: 'stable',
      changelog: ['Start menu search fix', 'USB thumb driver pack'],
      blurb: 'Small patch — thumbs now mount first try.',
      installSizeGB: 0.25,
      ramOverheadMB: 98,
      bootTimeSeconds: 41,
      theme: 'orion50',
      price: 0,
    },
  ],
  '6.x': [
    {
      version: '6.1',
      codename: 'Canal SP1',
      displayName: 'Orion OS 6.1',
      family: '6.x',
      kind: 'patch',
      channel: 'stable',
      changelog: ['Faster copy, Canal At Night saver fix', '99% dialog jitter patch'],
      blurb: 'Free patch — less anxious.',
      installSizeGB: 0.3,
      ramOverheadMB: 162,
      bootTimeSeconds: 46,
      theme: 'orion60',
      price: 0,
    },
    {
      version: '6.2',
      codename: 'Canal SP2',
      displayName: 'Orion OS 6.2',
      family: '6.x',
      kind: 'patch',
      channel: 'stable',
      changelog: ['Pipe screensaver pack', 'Dial-up wizard remembers last init string'],
      blurb: 'Screensavers that hum like the canal.',
      installSizeGB: 0.35,
      ramOverheadMB: 165,
      bootTimeSeconds: 45,
      theme: 'orion60',
      price: 0,
    },
  ],
  '7.x': [
    {
      version: '7.0-beta2',
      codename: 'Gloss B2',
      displayName: 'Orion OS 7.0 Beta 2',
      family: '7.x',
      kind: 'beta',
      channel: 'beta',
      changelog: ['Glossy dock pinned, translucency toggle', 'Still hungry on 512MB'],
      blurb: 'Beta 2 — more gloss, same hunger.',
      installSizeGB: 2.3,
      ramOverheadMB: 188,
      bootTimeSeconds: 55,
      theme: 'orion70',
      price: 0,
    },
    {
      version: '7.1',
      codename: 'Gloss SP1',
      displayName: 'Orion OS 7.1',
      family: '7.x',
      kind: 'minor',
      channel: 'stable',
      changelog: ['Dock backport for 6.0 as skin', 'Patch for 99% freeze, faster cache'],
      blurb: 'Polished gloss — faster on 1GB.',
      installSizeGB: 0.45,
      ramOverheadMB: 198,
      bootTimeSeconds: 52,
      theme: 'orion70',
      price: 19,
    },
    {
      version: '7.0.1',
      codename: 'Gloss Hotfix',
      displayName: 'Orion OS 7.0.1 Hotfix',
      family: '7.x',
      kind: 'hotfix',
      channel: 'hotfix',
      changelog: ['99% freeze workaround baked in', 'Canal saver exported as .scr'],
      blurb: 'Day-2 hotfix.',
      installSizeGB: 0.2,
      ramOverheadMB: 196,
      bootTimeSeconds: 54,
      theme: 'orion70',
      price: 0,
    },
    {
      version: '7.2',
      codename: 'Gloss SP2',
      displayName: 'Orion OS 7.2',
      family: '7.x',
      kind: 'minor',
      channel: 'stable',
      changelog: ['Aquarium saver, MyPlace tiler integration', 'DSL throttle awareness'],
      blurb: 'Gloss that knows your modem.',
      installSizeGB: 0.6,
      ramOverheadMB: 202,
      bootTimeSeconds: 50,
      theme: 'orion70',
      price: 0,
    },
  ],
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function pickOsTemplate(seed: string, family: OsRelease['family'], currentDay: number): OsTemplateEntry {
  const pool = OS_TEMPLATES[family] ?? OS_TEMPLATES['7.x']!;
  const idx = hashString(`${seed}:${family}:${currentDay}`) % pool.length;
  return pool[idx]!;
}

export function templateToRelease(entry: OsTemplateEntry, releaseDay: number, sourceEventId?: string): OsRelease {
  const id = `Orion_${entry.version}` as OsRelease['id'];
  return {
    id,
    version: entry.version,
    build: `${entry.version}.${1000 + (hashString(entry.version) % 9000)}`,
    codename: entry.codename,
    displayName: entry.displayName,
    family: entry.family,
    kind: entry.kind,
    channel: entry.channel,
    releaseDay,
    changelog: [...entry.changelog],
    requirements: {
      minRamMB: entry.family === '7.x' ? (entry.kind === 'beta' ? 768 : 768) : entry.family === '6.x' ? 512 : 512,
      minCpuTier: 1,
      minDiskGB: entry.installSizeGB + 0.2,
      requiresOs: entry.kind === 'patch' || entry.kind === 'hotfix' ? (`Orion_${entry.family.charAt(0)}.0` as any) : undefined,
    },
    installSizeGB: entry.installSizeGB,
    ramOverheadMB: entry.ramOverheadMB,
    bootTimeSeconds: entry.bootTimeSeconds,
    theme: entry.theme,
    price: entry.price ?? 0,
    blurb: entry.blurb,
    isProcedural: false,
    sourceEventId,
  };
}
